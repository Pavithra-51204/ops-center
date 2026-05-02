const express = require('express');
const router = express.Router();
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  updateSeverity,
  getTimeline,
  joinRoom,
  inviteUser,
  uploadFile,
  addActionItem,
  toggleActionItem,
  deleteActionItem,
} = require('../controllers/roomController');
const { getMessages } = require('../controllers/messageController');
const { authMiddleware } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', getRooms);
router.post('/', createRoom);
router.get('/:id', getRoom);
router.patch('/:id', updateRoom);
router.patch('/:id/severity', updateSeverity);
router.get('/:id/timeline', getTimeline);
router.post('/:id/join', joinRoom);
router.post('/:id/invite', inviteUser);

// File upload
router.post('/:id/upload', (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, uploadFile);

// Action items
router.post('/:id/actions', addActionItem);
router.patch('/:id/actions/:actionId', toggleActionItem);
router.delete('/:id/actions/:actionId', deleteActionItem);

// Chat history
router.get('/:roomId/messages', getMessages);

module.exports = router;
