import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();
// Connect to Redis Cloud using REDIS_URL
// Note: REDIS_URL is validated at application startup in src/index.js
const redis = new Redis(process.env.REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('Redis Cloud connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// OTP storage helpers
export const storeOTP = async (email, otp) => {
  const key = `otp:${email}`;
  // Store OTP with 5 minutes expiration (300 seconds)
  await redis.setex(key, 300, otp);
};

export const getOTP = async (email) => {
  const key = `otp:${email}`;
  return await redis.get(key);
};

export const deleteOTP = async (email) => {
  const key = `otp:${email}`;
  await redis.del(key);
};

// Email verification status storage
export const storeEmailVerification = async (email) => {
  const key = `verified:${email}`;
  // Store verification status for 30 minutes (1800 seconds)
  await redis.setex(key, 1800, 'true');
};

export const checkEmailVerification = async (email) => {
  const key = `verified:${email}`;
  const verified = await redis.get(key);
  return verified === 'true';
};

export const deleteEmailVerification = async (email) => {
  const key = `verified:${email}`;
  await redis.del(key);
};

export default redis;
