const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

const setCookieAndRespond = (res, user, statusCode = 200) => {
  const token = signToken(user._id);

  // Set cookie (works when frontend & backend share a domain / same-origin proxy)
  res.cookie('ops_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Also return the token in the body so the frontend can store it
  // as a Bearer token when running cross-origin (e.g. localhost → Render)
  res.status(statusCode).json({
    success: true,
    token,
    user: user.toSafeObject(),
  });
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({ name, email, password, role });
    setCookieAndRespond(res, user, 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    setCookieAndRespond(res, user);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('ops_token');
  res.json({ success: true, message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).populate('activeRooms', 'title status priority');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, role },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/users/search?email=foo@bar.com
// Returns up to 10 matching users (excludes the caller)
exports.searchUsers = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email || email.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Provide at least 2 characters to search' });
    }

    const users = await User.find({
      email:   { $regex: email.trim(), $options: 'i' },
      _id:     { $ne: req.userId }, // exclude self
    })
      .select('name email avatarColor role')
      .limit(10)
      .lean();

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};
