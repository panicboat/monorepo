export interface ServiceConfig {
  awsRegion: string;
  bedrockModelId: string;
  basePath: string;
  glossary: readonly string[];
}

const requireEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const parseGlossary = (value: string | undefined): string[] =>
  value
    ?.split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

export const loadConfig = (env: NodeJS.ProcessEnv): ServiceConfig => {
  const basePath = requireEnv(env, "MEETING_BASE_PATH");
  if (!basePath.startsWith("/")) throw new Error("MEETING_BASE_PATH must start with /");

  return {
    awsRegion: requireEnv(env, "AWS_REGION"),
    bedrockModelId: requireEnv(env, "BEDROCK_MODEL_ID"),
    basePath,
    glossary: parseGlossary(env.TRANSLATION_GLOSSARY),
  };
};
