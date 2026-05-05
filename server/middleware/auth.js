const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Accept token from either:
  // 1. Authorization: Bearer <token>  (used when frontend & backend are on different domains)
  // 2. Cookie: ops_token              (used when same-origin / proxy setup)
  let token = req.cookies.ops_token;

  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Verify socket token — returns userId or null
const verifySocketToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
};

module.exports = { authMiddleware, verifySocketToken };
