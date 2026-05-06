import * as crypto from 'crypto';
import * as readline from 'readline';

const KEY_LENGTH = 32;
const ENCODING = 'hex';

/**
 * Generates a cryptographically secure random master key.
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString(ENCODING);
}

/**
 * Validates that a master key is the correct format (64 hex chars = 32 bytes).
 */
export function validateMasterKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Prompts the user to enter a master key securely from stdin.
 */
export async function promptMasterKey(prompt = 'Enter master key: '): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise((resolve, reject) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!validateMasterKey(trimmed)) {
        reject(new Error('Invalid master key format. Expected 64 hex characters.'));
      } else {
        resolve(trimmed);
      }
    });
  });
}

/**
 * Resolves a master key from env var or prompts the user.
 */
export async function resolveMasterKey(envVar = 'ENVAULT_MASTER_KEY'): Promise<string> {
  const fromEnv = process.env[envVar];
  if (fromEnv) {
    if (!validateMasterKey(fromEnv)) {
      throw new Error(`Environment variable ${envVar} contains an invalid master key.`);
    }
    return fromEnv;
  }
  return promptMasterKey();
}
