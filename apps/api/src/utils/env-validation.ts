/**
 * Environment variable validation — runs at startup.
 * Throws if critical variables are missing; warns for optional but recommended ones.
 */

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

const RECOMMENDED_VARS: Array<{ name: string; description: string }> = [
  { name: "HEALTH_DATA_ENCRYPTION_KEY", description: "AES-256 key (64 hex chars) for encrypting health records at rest" },
  { name: "ALLOWED_ORIGINS", description: "CORS allowed origins (defaults to localhost)" },
  { name: "SMTP_HOST", description: "Email delivery (appointment reminders, password reset)" },
  { name: "SMTP_USER", description: "Email delivery credentials" },
  { name: "SMTP_PASS", description: "Email delivery credentials" },
  { name: "SMSAPI_TOKEN", description: "SMS delivery (appointment reminders)" },
  { name: "VAPID_PUBLIC_KEY", description: "Web Push notifications" },
  { name: "VAPID_PRIVATE_KEY", description: "Web Push notifications" },
  { name: "FIO_API_KEY", description: "FIO Bank payment matching" },
];

const SECRET_MIN_LENGTH = 32;

export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const name of REQUIRED_VARS) {
    const val = process.env[name];
    if (!val || val.trim() === "") {
      errors.push(`Missing required env variable: ${name}`);
    } else if (name.includes("SECRET") && val.length < SECRET_MIN_LENGTH) {
      warnings.push(`${name} is shorter than ${SECRET_MIN_LENGTH} characters — consider using a stronger secret`);
    }
  }

  // Check JWT_SECRET isn't a known default
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const KNOWN_DEFAULTS = ["secret", "changeme", "your-secret-key", "jwt-secret", "supersecret"];
  if (KNOWN_DEFAULTS.includes(jwtSecret.toLowerCase())) {
    errors.push("JWT_SECRET is set to a known default value — this is insecure in production");
  }

  // Check recommended vars
  for (const { name, description } of RECOMMENDED_VARS) {
    if (!process.env[name]) {
      warnings.push(`Missing optional env: ${name} — ${description}`);
    }
  }

  if (process.env.NODE_ENV === "production" && !process.env.HEALTH_DATA_ENCRYPTION_KEY) {
    errors.push("HEALTH_DATA_ENCRYPTION_KEY is required in production");
  }

  // DATABASE_PATH should be absolute in production
  if (process.env.NODE_ENV === "production") {
    const dbPath = process.env.DATABASE_PATH;
    if (!dbPath) {
      warnings.push("DATABASE_PATH not set — using default in-process directory");
    } else if (!dbPath.startsWith("/")) {
      warnings.push("DATABASE_PATH should be an absolute path in production");
    }
  }

  return { errors, warnings };
}

/**
 * Validate env and throw if critical errors found.
 * Call this before buildApp() in production.
 */
export function assertEnvValid(log?: { info: (m: string) => void; warn: (m: string) => void }): void {
  const { errors, warnings } = validateEnv();
  const logger = log ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
  };

  for (const w of warnings) {
    logger.warn(`⚠️  ${w}`);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      logger.warn(`❌ ${e}`);
    }

    // In production, refuse to start with critical errors
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Environment validation failed with ${errors.length} error(s):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  }
}
