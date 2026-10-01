// Boot-time environment validation. Called once from instrumentation.ts so a
// misconfigured deployment fails fast instead of on the first login/AI call.

export function validateEnv(): void {
  const problems: string[] = [];
  const jwt = process.env.JWT_SECRET || "";
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is not set");
  }

  if (isProd) {
    if (jwt.length < 32) {
      problems.push("JWT_SECRET must be set to at least 32 characters in production");
    }
    if (!process.env.NEXT_PUBLIC_BASE_URL) {
      problems.push("NEXT_PUBLIC_BASE_URL is required in production (webhook URLs / public links)");
    }
    if (!process.env.SECRETS_ENCRYPTION_KEY && jwt.length >= 32) {
      console.warn(
        "[env] SECRETS_ENCRYPTION_KEY is not set — provider keys/channel credentials fall back to JWT_SECRET. " +
          "Set a dedicated key so JWT rotation does not lock encrypted secrets."
      );
    }
  }

  if (problems.length > 0) {
    const message = `Invalid environment configuration:\n- ${problems.join("\n- ")}`;
    if (isProd) throw new Error(message);
    console.warn(`[env] ${message}`);
  }
}
