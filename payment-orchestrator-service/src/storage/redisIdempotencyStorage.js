import { getRedisClient } from "./redisClient.js";

class RedisIdempotencyStorage {
  async get(idempotencyKey, operation) {
    const client = await getRedisClient();
    const key = `idempotency:${operation}:${idempotencyKey}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(idempotencyKey, result, operation) {
    const client = await getRedisClient();
    const key = `idempotency:${operation}:${idempotencyKey}`;
    await client.set(key, JSON.stringify(result), { EX: 86400 });
  }

  async has(idempotencyKey, operation) {
    const client = await getRedisClient();
    const key = `idempotency:${operation}:${idempotencyKey}`;
    const exists = await client.exists(key);
    return exists === 1;
  }

  async delete(idempotencyKey, operation) {
    const client = await getRedisClient();
    const key = `idempotency:${operation}:${idempotencyKey}`;
    const deleted = await client.del(key);
    return deleted === 1;
  }
}

export function createRedisIdempotencyStorage() {
  return new RedisIdempotencyStorage();
}
