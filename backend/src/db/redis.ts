import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisInstance: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    redisInstance.on('connect', () => {
      console.log('✅ Connected to Redis successfully');
    });

    redisInstance.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });
  }

  return redisInstance;
}
