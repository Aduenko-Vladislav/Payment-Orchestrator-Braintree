import axios from "axios";
import axiosRetry from "axios-retry";
import logger from "../logger/winstonLogging.js";

export function createOrchestratorClient(options = {}) {
  const baseURL = options.baseURL ?? process.env.ORCHESTRATOR_URL;
  const timeoutMs =
    options.timeoutMs ?? Number(process.env.HTTP_TIMEOUT_MS ?? 10_000);

  const client = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });

  //retry if network errors
  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    retryCondition: (error) =>
      axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error),
    onRetry: (retryCount, error, requestConfig) => {
      logger.warn(
        `Retry ${retryCount}/3 for ${
          requestConfig?.url ?? "unknown URL"
        } reason=${error?.message}`
      );
    },
  });

  return client;
}
