const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const timelineEntrySchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ['user_joined', 'user_left', 'status_changed', 'severity_changed', 'room_created'],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'War-Room title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'high',
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
    },
    status: {
      type: String,
      enum: ['active', 'monitoring', 'resolved'],
      default: 'active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    actionItems: [actionItemSchema],
    timeline: [timelineEntrySchema],
    attachments: [attachmentSchema],
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String, trim: true }],
    // Invite-only access control: only users in this list can join.
    // The creator is always added when the room is created.
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Index for fast lookups
roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ 'participants.user': 1 });

// Virtual: time elapsed
roomSchema.virtual('timeElapsed').get(function () {
  const start = this.createdAt;
  const end = this.resolvedAt || new Date();
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  return `${Math.floor(diffHours / 24)}d`;
});

roomSchema.set('toJSON', { virtuals: true });
roomSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Room', roomSchema);
