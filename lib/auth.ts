import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ACCOUNT_COOKIE = "neyvix_account";
export const SESSION_COOKIE = "neyvix_session";

export type AccountRecord = {
  email: string;
  name: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
};

export type SessionRecord = {
  email: string;
  name: string;
  iat: number;
  exp: number;
};

function getSecret() {
  const configured = process.env.NEYVIX_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "neyvix-development-only-secret-change-me";
  throw new Error("NEYVIX_SESSION_SECRET is required in production");
}

function encryptionKey() {
  return createHash("sha256").update(getSecret()).digest();
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function signature(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function sign<T>(value: T) {
  const payload = encode(value);
  return `${payload}.${signature(payload)}`;
}

function verify<T>(token?: string | null): T | null {
  if (!token) return null;
  const [payload, provided] = token.split(".");
  if (!payload || !provided) return null;

  const expected = signature(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return decode<T>(payload);
}

function encrypt<T>(value: T) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decrypt<T>(token?: string | null): T | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ivPart, tagPart, ciphertextPart] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("base64url");
}

export function createAccount(name: string, email: string, password: string) {
  const salt = randomBytes(16).toString("base64url");
  const account: AccountRecord = {
    name: name.trim().slice(0, 80),
    email: normalizeEmail(email),
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  return { account, token: encrypt(account) };
}

export function readAccount(token?: string | null) {
  return decrypt<AccountRecord>(token);
}

export function passwordMatches(account: AccountRecord, password: string) {
  const provided = Buffer.from(hashPassword(password, account.salt));
  const expected = Buffer.from(account.passwordHash);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function createSession(account: Pick<AccountRecord, "email" | "name">) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionRecord = {
    email: account.email,
    name: account.name,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
  };
  return sign(session);
}

export function readSession(token?: string | null) {
  const session = verify<SessionRecord>(token);
  if (!session || session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
