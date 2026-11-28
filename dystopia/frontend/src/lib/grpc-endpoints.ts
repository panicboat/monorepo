export function monolithUrl(env: NodeJS.ProcessEnv): string {
  return env.MONOLITH_URL || "http://localhost:9001";
}

export function mediaServiceUrl(env: NodeJS.ProcessEnv): string {
  return env.MEDIA_SERVICE_URL || monolithUrl(env);
}
