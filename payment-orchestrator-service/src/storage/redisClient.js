import { createClient } from "redis";
import logger from "../logger/winstonLogging.js";

let redisClient = null;

export async function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  let clientOptions;

  if (process.env.REDIS_URL) {
    clientOptions = { url: process.env.REDIS_URL };
  } else if (
    process.env.REDIS_HOST ||
    process.env.REDIS_USERNAME ||
    process.env.REDIS_PASSWORD
  ) {
    clientOptions = {
      username: process.env.REDIS_USERNAME || "default",
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT || 6379),
      },
    };
  } else {
    clientOptions = { url: "redis://localhost:6379" };
  }

  redisClient = createClient(clientOptions);

  redisClient.on("error", (err) => {
    logger.error("Redis Client Error", err);
  });

  await redisClient.connect();
  logger.info("Redis client connected successfully");
  return redisClient;
}
