import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Application-level encryption for secrets at rest (AI provider keys, channel
// credentials). Uses AES-256-GCM. Legacy plaintext values are still readable
// and get encrypted the next time they are written.
// Prefer SECRETS_ENCRYPTION_KEY; fall back to JWT_SECRET in small deployments.

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[crypto] Neither SECRETS_ENCRYPTION_KEY nor JWT_SECRET is set — secrets stored with a well-known dev key!"
      );
    }
    return createHash("sha256").update("insecure-dev-secrets-key-change-me").digest();
  }
  return createHash("sha256").update(`${raw}:secrets-at-rest`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain || plain.startsWith(PREFIX)) return plain;
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
  } catch (e) {
    console.error("[crypto] encrypt failed", e);
    return plain;
  }
}

export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[crypto] decrypt failed — returning empty");
    return "";
  }
}
