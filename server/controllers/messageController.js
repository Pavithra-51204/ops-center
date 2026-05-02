const Message = require('../models/Message');

// GET /api/rooms/:roomId/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ room: req.params.roomId })
      .populate('sender', 'name avatarColor')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Message.countDocuments({ room: req.params.roomId });

    res.json({
      success: true,
      messages,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};
