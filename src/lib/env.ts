export type RequiredEnvKey = "DATABASE_URL" | "LLM_API_KEY" | "GITHUB_TOKEN";
export type AppEnv = Record<RequiredEnvKey, string>;

export function getRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getAppEnv(): AppEnv {
  return {
    DATABASE_URL: getRequiredEnv("DATABASE_URL"),
    LLM_API_KEY: getRequiredEnv("LLM_API_KEY"),
    GITHUB_TOKEN: getRequiredEnv("GITHUB_TOKEN"),
  };
}
