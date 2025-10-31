import axios from "axios";

export function createOrchestratorClient(options = {}) {
  const baseURL = options.baseURL ?? process.env.ORCHESTRATOR_URL;
  const timeoutMs =
    options.timeoutMs ?? Number(process.env.HTTP_TIMEOUT_MS ?? 10_000);

  return axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });
}
