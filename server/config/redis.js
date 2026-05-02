const Redis = require('ioredis');

let redisClient;
let redisSubscriber;

const createRedisClient = () => {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  client.on('connect', () => console.log('✅ Redis connected'));
  client.on('error', (err) => console.error('❌ Redis error:', err.message));

  return client;
};

const getRedisClient = () => {
  if (!redisClient) redisClient = createRedisClient();
  return redisClient;
};

// Separate subscriber client (ioredis can't pub/sub on same connection)
const getRedisSubscriber = () => {
  if (!redisSubscriber) redisSubscriber = createRedisClient();
  return redisSubscriber;
};

// Room presence helpers
const PRESENCE_TTL = 30; // seconds

const setUserPresence = async (roomId, userId, userData) => {
  const client = getRedisClient();
  const key = `presence:${roomId}:${userId}`;
  await client.setex(key, PRESENCE_TTL, JSON.stringify(userData));
};

const removeUserPresence = async (roomId, userId) => {
  const client = getRedisClient();
  await client.del(`presence:${roomId}:${userId}`);
};

const getRoomPresence = async (roomId) => {
  const client = getRedisClient();
  const keys = await client.keys(`presence:${roomId}:*`);
  if (!keys.length) return [];
  const values = await client.mget(...keys);
  return values
    .filter(Boolean)
    .map((v) => JSON.parse(v));
};

const refreshPresence = async (roomId, userId, userData) => {
  await setUserPresence(roomId, userId, userData);
};

module.exports = {
  getRedisClient,
  getRedisSubscriber,
  setUserPresence,
  removeUserPresence,
  getRoomPresence,
  refreshPresence,
};
