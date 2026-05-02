/**
 * worker.js  — run as a SEPARATE Node process:  node worker.js
 *
 * Responsibilities:
 *  1. Connect to Upstash Redis via BullMQ Worker
 *  2. Process debounced 'assignment' and 'warroom_join' jobs
 *  3. Look up the recipient's email from MongoDB
 *  4. Send a summary email via Nodemailer (SMTP / Gmail OAuth / any provider)
 *
 * Start alongside your API server:
 *   Terminal 1 → node index.js   (or nodemon index.js)
 *   Terminal 2 → node worker.js  (or nodemon worker.js)
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const mongoose   = require('mongoose');

// ── Re-use existing project modules ──────────────────────────────────────────
const connectDB              = require('./config/db');
const User                   = require('./models/User');
const { redisConnection }    = require('./lib/queue');

// ── Nodemailer transporter ────────────────────────────────────────────────────
// Configure via environment variables. Examples:
//
//  Gmail (App Password):
//    EMAIL_HOST=smtp.gmail.com  EMAIL_PORT=587
//    EMAIL_USER=you@gmail.com   EMAIL_PASS=<app-password>
//
//  Resend SMTP bridge:
//    EMAIL_HOST=smtp.resend.com  EMAIL_PORT=587
//    EMAIL_USER=resend           EMAIL_PASS=<resend-api-key>
//
//  MailHog (local dev):
//    EMAIL_HOST=localhost  EMAIL_PORT=1025
//    EMAIL_USER=           EMAIL_PASS=
//
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Helper: Fetch user email from MongoDB ─────────────────────────────────────
const getUserEmail = async (userId) => {
  const user = await User.findById(userId).select('email name').lean();
  if (!user) throw new Error(`User not found: ${userId}`);
  return user;
};

// ── Email builders ────────────────────────────────────────────────────────────

/**
 * Build the assignment summary email (handles 1 or N assignments).
 */
const buildAssignmentEmail = (recipientName, items) => {
  const count = items.length;
  const subject =
    count === 1
      ? `[Ops-Center] You've been assigned: ${items[0].issueTitle}`
      : `[Ops-Center] ${count} new assignments for you`;

  const listItems = items
    .map(
      (it, i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;font-weight:600;">${escHtml(it.issueTitle || 'Untitled')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;color:#94a3b8;">${escHtml(it.assignedBy || 'System')}</td>
        </tr>`
    )
    .join('');

  const html = emailWrapper(`
    <h2 style="color:#f8fafc;margin:0 0 8px;">👋 Hi ${escHtml(recipientName)},</h2>
    <p style="color:#94a3b8;margin:0 0 24px;">
      You have <strong style="color:#818cf8;">${count} new action item${count > 1 ? 's' : ''}</strong> assigned to you in Ops-Center.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#1e2130;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#2a2d3a;">
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">#</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">ISSUE</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">ASSIGNED BY</th>
        </tr>
      </thead>
      <tbody>${listItems}</tbody>
    </table>
    <p style="color:#64748b;margin:24px 0 0;font-size:13px;">
      Log in to <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="color:#818cf8;">Ops-Center</a> to view your queue.
    </p>
  `);

  return { subject, html };
};

/**
 * Build the war-room join notification email.
 */
const buildWarroomJoinEmail = (recipientName, items) => {
  const count = items.length;
  const subject =
    count === 1
      ? `[Ops-Center] You've been added to War-Room: ${items[0].roomTitle}`
      : `[Ops-Center] You've been added to ${count} War-Rooms`;

  const listItems = items
    .map(
      (it, i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;font-weight:600;">${escHtml(it.roomTitle || 'Unnamed Room')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2d3a;color:#94a3b8;">${escHtml(it.addedBy || 'System')}</td>
        </tr>`
    )
    .join('');

  const html = emailWrapper(`
    <h2 style="color:#f8fafc;margin:0 0 8px;">🚨 War-Room Alert</h2>
    <p style="color:#94a3b8;margin:0 0 24px;">
      Hi <strong style="color:#f8fafc;">${escHtml(recipientName)}</strong>,
      you have been added to <strong style="color:#f472b6;">${count} War-Room${count > 1 ? 's' : ''}</strong>.
      Your presence is needed immediately.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#1e2130;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#2a2d3a;">
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">#</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">WAR-ROOM</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;font-size:12px;">ADDED BY</th>
        </tr>
      </thead>
      <tbody>${listItems}</tbody>
    </table>
    <p style="color:#64748b;margin:24px 0 0;font-size:13px;">
      Join now at <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="color:#f472b6;">Ops-Center</a>.
    </p>
  `);

  return { subject, html };
};

// ── Shared HTML wrapper (dark-themed) ─────────────────────────────────────────
const emailWrapper = (body) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#161b27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#312e81,#1e1b4b);padding:24px 32px;">
            <span style="font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px;">
              ⚡ Ops-Center
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#0f1117;border-top:1px solid #2a2d3a;">
            <p style="color:#475569;font-size:12px;margin:0;">
              This is an automated notification from Ops-Center. Do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Simple HTML escaping ──────────────────────────────────────────────────────
const escHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ── BullMQ Worker ─────────────────────────────────────────────────────────────
const worker = new Worker(
  'notifications',
  async (job) => {
    const { type, userId, items } = job.data;

    console.log(
      `⚙️  [Worker] Processing job "${job.id}" | type=${type} | user=${userId} | items=${items.length}`
    );

    // 1. Fetch the recipient's info from MongoDB
    const recipient = await getUserEmail(userId);

    // 2. Build email based on notification type
    let emailPayload;
    if (type === 'assignment') {
      emailPayload = buildAssignmentEmail(recipient.name, items);
    } else if (type === 'warroom_join') {
      emailPayload = buildWarroomJoinEmail(recipient.name, items);
    } else {
      throw new Error(`[Worker] Unknown notification type: ${type}`);
    }

    // 3. Send the email
    const info = await transporter.sendMail({
      from: `"Ops-Center Alerts" <${process.env.EMAIL_USER}>`,
      to:   recipient.email,
      ...emailPayload,
    });

    console.log(`✅ [Worker] Email sent → ${recipient.email} | messageId=${info.messageId}`);
    return { messageId: info.messageId, recipient: recipient.email };
  },
  {
    connection: redisConnection,
    concurrency: 5, // process up to 5 jobs in parallel
  }
);

// ── Worker lifecycle events ───────────────────────────────────────────────────
worker.on('completed', (job, result) => {
  console.log(`✅ [Worker] Job ${job.id} completed — sent to ${result.recipient}`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
});

worker.on('error', (err) => {
  console.error('❌ [Worker] Worker error:', err.message);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async () => {
  await connectDB(); // connect to MongoDB Atlas
  console.log('🚀 [Worker] Notification worker is running and waiting for jobs…');

  // Verify SMTP credentials on startup (optional – comment out in production)
  try {
    await transporter.verify();
    console.log('📧 [Worker] SMTP connection verified');
  } catch (err) {
    console.warn('⚠️  [Worker] SMTP verify failed (emails may not send):', err.message);
  }
})();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n🛑 [Worker] Received ${signal}, shutting down gracefully…`);
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
