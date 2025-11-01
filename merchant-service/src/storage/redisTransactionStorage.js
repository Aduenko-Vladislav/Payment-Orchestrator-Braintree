import { getRedisClient } from "./redisClient.js";

class RedisTransactionStorage {
  async get(merchantReference, operation) {
    const client = await getRedisClient();
    const key = `${operation}:${merchantReference}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(merchantReference, data, operation) {
    const client = await getRedisClient();
    const key = `${operation}:${merchantReference}`;
    await client.set(key, JSON.stringify(data));
  }

  async has(merchantReference, operation) {
    const client = await getRedisClient();
    const key = `${operation}:${merchantReference}`;
    const exists = await client.exists(key);
    return exists === 1;
  }

  async delete(merchantReference, operation) {
    const client = await getRedisClient();
    const key = `${operation}:${merchantReference}`;
    const deleted = await client.del(key);
    return deleted === 1;
  }
}

export function createRedisTransactionStorage() {
  return new RedisTransactionStorage();
}
