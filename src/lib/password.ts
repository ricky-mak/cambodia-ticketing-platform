import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing with Argon2id (the plan's preferred algorithm).
 * @node-rs/argon2 defaults to the Argon2id variant and ships prebuilt
 * binaries, so there is no native node-gyp build step.
 *
 * Parameters follow current OWASP guidance for Argon2id.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return verify(hashed, plain);
}
