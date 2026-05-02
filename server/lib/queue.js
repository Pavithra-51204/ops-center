/**
 * lib/queue.js
 * Initialises the BullMQ Queue and exports an addNotification helper.
 *
 * Upstash Redis requirements:
 *  - tls: {}                  → TLS is mandatory for the public endpoint
 *  - maxRetriesPerRequest: null → BullMQ needs this; ioredis default breaks it
 */
const { Queue } = require('bullmq');

// ── Redis connection ──────────────────────────────────────────────────────────
// BullMQ accepts a raw ioredis-compatible connection options object.
const redisConnection = {
  url: process.env.REDIS_URL, // e.g. rediss://default:<token>@<host>:6379
  tls: {},                    // required for Upstash TLS endpoint
  maxRetriesPerRequest: null, // required by BullMQ
};

// ── Queue ─────────────────────────────────────────────────────────────────────
const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 }, // keep last 200 completed jobs for debugging
    removeOnFail: { count: 100 },
  },
});

notificationQueue.on('error', (err) =>
  console.error('❌ [Queue] BullMQ queue error:', err.message)
);

// ── Debounce / batching key strategy ─────────────────────────────────────────
// We use BullMQ's jobId deduplication + replace strategy so that multiple
// rapid assignments to the same user collapse into ONE delayed job.
//
// Key format: "notify:<type>:<userId>[:<contextId>]"
//   type      = 'assignment' | 'warroom_join'
//   userId    = the recipient
//   contextId = roomId (for warroom_join) or omitted (for assignment)
//
// DELAY: 2 minutes (120 000 ms). Each new event restarts the timer by
// updating the existing job, so the email fires 2 min after the LAST event.

const DEBOUNCE_DELAY_MS = 2 * 60 * 1000; // 2 minutes

/**
 * addNotification({ type, userId, payload })
 *
 * @param {string} type     - 'assignment' | 'warroom_join'
 * @param {string} userId   - MongoDB ObjectId string of the recipient
 * @param {object} payload  - Arbitrary context merged into the job data:
 *                              assignment  → { issueId, issueTitle, assignedBy }
 *                              warroom_join → { roomId, roomTitle, addedBy }
 *
 * The helper stores accumulated items so the worker can send a summary email
 * when multiple assignments land before the debounce fires.
 */
const addNotification = async ({ type, userId, payload }) => {
  if (!type || !userId) throw new Error('[queue] type and userId are required');

  // Build a stable job id so BullMQ deduplicates within the debounce window
  const contextId = payload?.roomId || payload?.issueId || 'global';
  // Replace colons with hyphens
  const jobId = `notify-${type}-${userId}-${contextId}`;

  // Attempt to retrieve any existing pending job
  const existingJob = await notificationQueue.getJob(jobId);

  let items = [];
  if (existingJob) {
    // Carry forward previously buffered items
    items = existingJob.data?.items || [];
    // Remove the old delayed job so we can re-add with a fresh delay
    await existingJob.remove();
  }

  // Append the new event
  items.push({ ...payload, enqueuedAt: new Date().toISOString() });

  await notificationQueue.add(
    type, // job name (used by the worker to branch logic)
    { type, userId, items },
    {
      jobId,
      delay: DEBOUNCE_DELAY_MS,
    }
  );

  console.log(
    `📬 [Queue] Buffered "${type}" for user ${userId} — ${items.length} item(s) pending`
  );
};

module.exports = { notificationQueue, addNotification, redisConnection };
