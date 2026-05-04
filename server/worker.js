/**
 * worker.js  — run as a SEPARATE Node process on Render Web Service
 */

require('dotenv').config();
const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const express = require('express'); // Added for dummy server

// ── Re-use existing project modules ──────────────────────────────────────────
const connectDB = require('./config/db');
const User = require('./models/User');
const { redisConnection } = require('./lib/queue');

// ── Dummy Express Server for Render Free Tier ────────────────────────────────
/**
 * Render Web Services MUST bind to a port or the deployment will be marked as failed.
 * This tiny server keeps the "No open ports detected" error away.
 */
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Ops-Center Worker is active and listening for jobs.'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`👷 [Worker] Dummy health-check server listening on port ${PORT}`);
});

// ── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail', // Shortcut for Gmail on cloud environments
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Ensure this is your 16-char app password
  },
  connectionTimeout: 20000, // Increased for free tier stability
  family: 4 // Forces IPv4 to prevent ENETUNREACH errors on Render
});

// ── Helper: Fetch user email from MongoDB ─────────────────────────────────────
const getUserEmail = async (userId) => {
  const user = await User.findById(userId).select('email name').lean();
  if (!user) throw new Error(`User not found: ${userId}`);
  return user;
};

// ── Email builders (Dark-themed) ──────────────────────────────────────────────
const escHtml = (str = '') =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const emailWrapper = (body) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#161b27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">
        <tr>
          <td style="background:linear-gradient(135deg,#312e81,#1e1b4b);padding:24px 32px;">
            <span style="font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px;">⚡ Ops-Center</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr>
          <td style="padding:16px 32px;background:#0f1117;border-top:1px solid #2a2d3a;">
            <p style="color:#475569;font-size:12px;margin:0;">Automated notification. Do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buildAssignmentEmail = (recipientName, items) => {
  const count = items.length;
  const listItems = items.map((it, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;font-weight:600;">${escHtml(it.issueTitle)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;color:#94a3b8;">${escHtml(it.assignedBy)}</td>
    </tr>`).join('');

  return {
    subject: count === 1 ? `[Ops-Center] New Assignment: ${items[0].issueTitle}` : `[Ops-Center] ${count} new assignments`,
    html: emailWrapper(`
      <h2 style="color:#f8fafc;">👋 Hi ${escHtml(recipientName)},</h2>
      <p style="color:#94a3b8;">You have <strong>${count} new action item${count > 1 ? 's' : ''}</strong>.</p>
      <table width="100%" style="background:#1e2130;border-radius:8px;">${listItems}</table>
      <p style="margin-top:20px;"><a href="${process.env.CLIENT_URL}" style="color:#818cf8;">View in Ops-Center</a></p>
    `)
  };
};

const buildWarroomJoinEmail = (recipientName, items) => {
  const count = items.length;
  const listItems = items.map((it, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;font-weight:600;">${escHtml(it.roomTitle)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;color:#94a3b8;">${escHtml(it.addedBy)}</td>
    </tr>`).join('');

  return {
    subject: `[Ops-Center] War-Room Access Granted`,
    html: emailWrapper(`
      <h2 style="color:#f8fafc;">🚨 War-Room Alert</h2>
      <p style="color:#94a3b8;">Hi ${escHtml(recipientName)}, you've been added to <strong>${count} War-Room${count > 1 ? 's' : ''}</strong>.</p>
      <table width="100%" style="background:#1e2130;border-radius:8px;">${listItems}</table>
      <p style="margin-top:20px;"><a href="${process.env.CLIENT_URL}" style="color:#f472b6;">Join the Incident</a></p>
    `)
  };
};

// ── BullMQ Worker ─────────────────────────────────────────────────────────────
const worker = new Worker(
  'notifications',
  async (job) => {
    const { type, userId, items } = job.data;
    console.log(`⚙️ [Worker] Processing job "${job.id}" | type=${type}`);

    const recipient = await getUserEmail(userId);
    const emailPayload = type === 'assignment'
      ? buildAssignmentEmail(recipient.name, items)
      : buildWarroomJoinEmail(recipient.name, items);

    const info = await transporter.sendMail({
      from: `"Ops-Center Alerts" <${process.env.EMAIL_USER}>`,
      to: recipient.email,
      ...emailPayload,
    });

    console.log(`✅ [Worker] Email sent → ${recipient.email}`);
    return { messageId: info.messageId, recipient: recipient.email };
  },
  {
    connection: redisConnection,
    concurrency: 2, // Lower concurrency for free tier to save memory
  }
);

// ── Worker lifecycle events ───────────────────────────────────────────────────
worker.on('completed', (job, result) => console.log(`✅ Job ${job.id} done → ${result.recipient}`));
worker.on('failed', (job, err) => console.error(`❌ Job ${job?.id} failed: ${err.message}`));
worker.on('error', (err) => console.error('❌ Worker connection error:', err.message));

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async () => {
  await connectDB();
  console.log('🚀 [Worker] Notification worker is live');

  try {
    await transporter.verify();
    console.log('📧 [Worker] SMTP connection verified');
  } catch (err) {
    console.warn('⚠️ [Worker] SMTP verification failed:', err.message);
  }
})();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n🛑 [Worker] ${signal} received, shutting down...`);
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));