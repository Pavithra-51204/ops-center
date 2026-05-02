const { verifySocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { addTimelineEntry } = require('../controllers/roomController');
const {
  getRedisClient,
  getRedisSubscriber,
  setUserPresence,
  removeUserPresence,
  getRoomPresence,
} = require('../config/redis');

const CHANNEL = 'ops:messages';
const FILE_CHANNEL = 'ops:files';

module.exports = (io) => {
  const publisher = getRedisClient();
  const subscriber = getRedisSubscriber();

  // Subscribe to Redis channels and broadcast to Socket.io rooms
  subscriber.subscribe(CHANNEL, FILE_CHANNEL, (err) => {
    if (err) console.error('Redis subscribe error:', err);
  });

  subscriber.on('message', (channel, data) => {
    try {
      const payload = JSON.parse(data);
      if (channel === CHANNEL || channel === FILE_CHANNEL) {
        io.to(payload.roomId).emit('new_message', payload.message);
      }
    } catch (e) {
      console.error('Redis message parse error:', e);
    }
  });

  // Socket.io middleware for auth
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
      ?.split(';')
      .find((c) => c.trim().startsWith('ops_token='))
      ?.split('=')[1];

    if (!token) return next(new Error('Authentication required'));

    const userId = verifySocketToken(token);
    if (!userId) return next(new Error('Invalid token'));

    const user = await User.findById(userId).select('name avatarColor email');
    if (!user) return next(new Error('User not found'));

    socket.userId = userId;
    socket.user = { _id: userId, name: user.name, avatarColor: user.avatarColor, email: user.email };
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.name}`);

    // ── Join a war room ────────────────────────────────────────────────────────
    socket.on('join_room', async (roomId) => {
      socket.join(roomId);
      socket.currentRoom = roomId;

      await setUserPresence(roomId, socket.userId, socket.user);

      const online = await getRoomPresence(roomId);
      io.to(roomId).emit('presence_update', online);

      socket.to(roomId).emit('user_joined', {
        user: socket.user,
        timestamp: new Date(),
      });

      // Timeline entry
      try {
        const entry = await addTimelineEntry(roomId, {
          event: 'user_joined',
          actorId: socket.userId,
          meta: { userName: socket.user.name },
        });
        io.to(roomId).emit('timeline_update', entry);
      } catch (e) {
        console.error('Timeline entry error:', e);
      }
    });

    // ── Send a chat message ─────────────────────────────────────────────────────
    socket.on('send_message', async ({ roomId, content, messageType, meta }) => {
      if (!content?.trim()) return;

      try {
        const type = messageType || 'message';
        const msg = await Message.create({
          room: roomId,
          sender: socket.userId,
          content: content.trim(),
          type,
          meta: meta || null,
        });

        const populated = await Message.findById(msg._id)
          .populate('sender', 'name avatarColor')
          .lean();

        await publisher.publish(
          CHANNEL,
          JSON.stringify({ roomId, message: populated })
        );
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Broadcast uploaded file to room ─────────────────────────────────────────
    // Called by client after successful POST /api/rooms/:id/upload
    socket.on('file_uploaded', async ({ roomId, message }) => {
      io.to(roomId).emit('new_message', message);
    });

    // ── Presence heartbeat ──────────────────────────────────────────────────────
    socket.on('heartbeat', async ({ roomId }) => {
      if (roomId && socket.userId) {
        await setUserPresence(roomId, socket.userId, socket.user);
      }
    });

    // ── Action item toggled ─────────────────────────────────────────────────────
    socket.on('action_toggled', ({ roomId, actionItem }) => {
      io.to(roomId).emit('action_updated', actionItem);
    });

    // ── Room status changed ─────────────────────────────────────────────────────
    socket.on('room_status_changed', async ({ roomId, status }) => {
      io.to(roomId).emit('status_updated', { status, updatedBy: socket.user });

      try {
        const entry = await addTimelineEntry(roomId, {
          event: 'status_changed',
          actorId: socket.userId,
          meta: { status, changedBy: socket.user.name },
        });
        io.to(roomId).emit('timeline_update', entry);
      } catch (e) {
        console.error('Timeline entry error:', e);
      }
    });

    // ── Severity changed ────────────────────────────────────────────────────────
    socket.on('severity_change', async ({ roomId, severity }) => {
      const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validSeverities.includes(severity)) return;

      try {
        await Room.findByIdAndUpdate(roomId, { severity });

        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit('severity_updated', { severity, updatedBy: socket.user });

        const entry = await addTimelineEntry(roomId, {
          event: 'severity_changed',
          actorId: socket.userId,
          meta: { severity, changedBy: socket.user.name },
        });
        io.to(roomId).emit('timeline_update', entry);
      } catch (e) {
        console.error('Severity change error:', e);
      }
    });

    // ── Typing indicator ────────────────────────────────────────────────────────
    socket.on('typing_start', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', { user: socket.user });
    });

    socket.on('typing_stop', ({ roomId }) => {
      socket.to(roomId).emit('user_stopped_typing', { userId: socket.userId });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.user?.name}`);
      if (socket.currentRoom) {
        await removeUserPresence(socket.currentRoom, socket.userId);
        const online = await getRoomPresence(socket.currentRoom);
        io.to(socket.currentRoom).emit('presence_update', online);
        io.to(socket.currentRoom).emit('user_left', { user: socket.user });

        try {
          const entry = await addTimelineEntry(socket.currentRoom, {
            event: 'user_left',
            actorId: socket.userId,
            meta: { userName: socket.user.name },
          });
          io.to(socket.currentRoom).emit('timeline_update', entry);
        } catch (e) {
          console.error('Timeline entry error on disconnect:', e);
        }
      }
    });
  });
};
