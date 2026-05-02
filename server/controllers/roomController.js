const path = require('path');
const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const { getRoomPresence } = require('../config/redis');
const { addNotification } = require('../lib/queue');

// ---------- Internal helper ----------
const addTimelineEntry = async (roomId, { event, actorId, meta = {} }) => {
  const room = await Room.findByIdAndUpdate(
    roomId,
    {
      $push: {
        timeline: {
          event,
          actor: actorId || null,
          meta,
          timestamp: new Date(),
        },
      },
    },
    { new: true, select: 'timeline' }
  ).populate('timeline.actor', 'name avatarColor');

  const entries = room?.timeline || [];
  return entries[entries.length - 1];
};

exports.addTimelineEntry = addTimelineEntry;

// GET /api/rooms — list all rooms with presence counts
exports.getRooms = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const rooms = await Room.find(filter)
      .populate('createdBy', 'name avatarColor')
      .populate('participants.user', 'name avatarColor')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    // Attach live presence counts from Redis
    const roomsWithPresence = await Promise.all(
      rooms.map(async (room) => {
        const online = await getRoomPresence(room._id.toString());
        return { ...room, onlineCount: online.length, onlineUsers: online };
      })
    );

    res.json({ success: true, rooms: roomsWithPresence });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
exports.getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('createdBy', 'name avatarColor email')
      .populate('participants.user', 'name avatarColor email')
      .populate('actionItems.assignedTo', 'name avatarColor')
      .lean({ virtuals: true });

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const online = await getRoomPresence(req.params.id);
    res.json({ success: true, room: { ...room, onlineUsers: online } });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms — create war room
exports.createRoom = async (req, res, next) => {
  try {
    const { title, description, priority, tags } = req.body;

    const room = await Room.create({
      title,
      description,
      priority,
      tags,
      createdBy: req.userId,
      participants: [{ user: req.userId }],
      // Creator is always pre-allowed
      allowedUsers: [req.userId],
    });

    // Add room to user's activeRooms
    await User.findByIdAndUpdate(req.userId, { $addToSet: { activeRooms: room._id } });

    const populated = await room.populate('createdBy', 'name avatarColor');

    // Initial timeline entry
    await addTimelineEntry(room._id, { event: 'room_created', actorId: req.userId });

    // Post system message
    await Message.create({
      room: room._id,
      sender: req.userId,
      content: `War-Room "${title}" launched`,
      type: 'system',
    });

    res.status(201).json({ success: true, room: populated });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rooms/:id — update status, metadata (io injected via req.app)
exports.updateRoom = async (req, res, next) => {
  try {
    const { status, title, description, priority } = req.body;

    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (priority !== undefined) update.priority = priority;

    if (status) {
      update.status = status;
      if (status === 'resolved') {
        update.resolvedAt = new Date();
        update.resolvedBy = req.userId;
      }
    }

    const room = await Room.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name avatarColor');

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Add status timeline entry (socket event emitted by client via socket.on('room_status_changed'))
    if (status) {
      await addTimelineEntry(req.params.id, {
        event: 'status_changed',
        actorId: req.userId,
        meta: { status },
      });
    }

    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rooms/:id/severity — change severity level
exports.updateSeverity = async (req, res, next) => {
  try {
    const { severity } = req.body;
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
      return res.status(400).json({ success: false, message: 'Invalid severity value' });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { severity },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name avatarColor');

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const entry = await addTimelineEntry(req.params.id, {
      event: 'severity_changed',
      actorId: req.userId,
      meta: { severity },
    });

    res.json({ success: true, room, timelineEntry: entry });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id/timeline
exports.getTimeline = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('timeline.actor', 'name avatarColor')
      .select('timeline')
      .lean();

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    res.json({ success: true, timeline: room.timeline });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/join — join a room (invite-only gate)
exports.joinRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // ── Invite-only access check ────────────────────────────────────────────
    // allowedUsers is empty for legacy rooms (created before this feature);
    // treat that as open-access so existing rooms keep working.
    const hasAllowList = room.allowedUsers && room.allowedUsers.length > 0;
    if (hasAllowList) {
      const isAllowed = room.allowedUsers.some(
        (uid) => uid.toString() === String(req.userId)
      );
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — you need an invitation to join this War-Room.',
        });
      }
    }

    const alreadyIn = room.participants.some(
      (p) => p.user.toString() === String(req.userId)
    );
    if (!alreadyIn) {
      room.participants.push({ user: req.userId });
      await room.save();
      await User.findByIdAndUpdate(req.userId, { $addToSet: { activeRooms: room._id } });
    }

    res.json({ success: true, message: 'Joined room' });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/invite — add a user to allowedUsers (invite-only)
exports.inviteUser = async (req, res, next) => {
  try {
    const { userId: inviteeId } = req.body;
    if (!inviteeId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Only the creator (or an existing participant) may invite others
    const callerIsParticipant = room.participants.some(
      (p) => p.user.toString() === String(req.userId)
    );
    if (!callerIsParticipant) {
      return res.status(403).json({ success: false, message: 'Only room participants can invite others' });
    }

    const invitee = await User.findById(inviteeId).select('name email').lean();
    if (!invitee) return res.status(404).json({ success: false, message: 'User not found' });

    // Idempotently add to allowedUsers
    await Room.findByIdAndUpdate(req.params.id, {
      $addToSet: { allowedUsers: inviteeId },
    });

    res.json({ success: true, message: `${invitee.name} has been invited` });

    // ── Email notification (fire-and-forget) ────────────────────────────────
    const actor = await User.findById(req.userId).select('name').lean();
    addNotification({
      type: 'warroom_join',
      userId: String(inviteeId),
      payload: {
        roomId:    String(room._id),
        roomTitle: room.title,
        addedBy:   actor?.name || 'Someone',
      },
    }).catch((err) => console.error('[Notify] inviteUser notification error:', err.message));
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/upload — upload file and create a 'file' message
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Persist message to DB
    const msg = await Message.create({
      room: req.params.id,
      sender: req.userId,
      content: req.file.originalname,
      type: 'file',
      meta: {
        url: fileUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });

    const populated = await Message.findById(msg._id)
      .populate('sender', 'name avatarColor')
      .lean();

    // Also store in room attachments
    await Room.findByIdAndUpdate(req.params.id, {
      $push: {
        attachments: {
          url: fileUrl,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          uploadedBy: req.userId,
        },
      },
    });

    res.status(201).json({ success: true, message: populated, fileUrl });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/actions — add action item
exports.addActionItem = async (req, res, next) => {
  try {
    const { text, assignedTo } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    room.actionItems.push({ text, assignedTo });
    await room.save();

    const updated = await Room.findById(req.params.id)
      .populate('actionItems.assignedTo', 'name avatarColor')
      .lean({ virtuals: true });

    res.status(201).json({ success: true, actionItems: updated.actionItems });

    // ── Email notification (fire-and-forget, non-blocking) ──────────────────
    if (assignedTo && String(assignedTo) !== String(req.userId)) {
      const actor = await User.findById(req.userId).select('name').lean();
      addNotification({
        type: 'assignment',
        userId: String(assignedTo),
        payload: {
          issueId:    String(room._id),
          issueTitle: text,
          assignedBy: actor?.name || 'Someone',
        },
      }).catch((err) => console.error('[Notify] addNotification error:', err.message));
    }
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rooms/:id/actions/:actionId — toggle action item
exports.toggleActionItem = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const item = room.actionItems.id(req.params.actionId);
    if (!item) return res.status(404).json({ success: false, message: 'Action item not found' });

    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date() : undefined;
    item.completedBy = item.completed ? req.userId : undefined;
    await room.save();

    res.json({ success: true, actionItem: item });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id/actions/:actionId
exports.deleteActionItem = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    room.actionItems = room.actionItems.filter(
      (item) => item._id.toString() !== req.params.actionId
    );
    await room.save();

    res.json({ success: true, message: 'Action item removed' });
  } catch (err) {
    next(err);
  }
};
