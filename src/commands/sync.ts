import fs from 'fs';
import path from 'path';
import { encryptToString } from '../crypto';
import { decryptFromString } from '../crypto';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';

export interface SyncOptions {
  envFile?: string;
  vaultFile?: string;
  profile?: string;
}

/**
 * Push: read .env file, encrypt it, write to vault
 */
export async function pushEnv(options: SyncOptions = {}): Promise<void> {
  const envPath = path.resolve(options.envFile ?? '.env');
  const vaultPath = resolveVaultPath(options.vaultFile);
  const profile = options.profile ?? 'default';

  if (!fs.existsSync(envPath)) {
    throw new Error(`Env file not found: ${envPath}`);
  }

  const masterKey = getKey(profile);
  if (!masterKey) {
    throw new Error(`No key found for profile "${profile}". Run: envault keys add ${profile}`);
  }

  const plaintext = fs.readFileSync(envPath, 'utf-8');
  const encrypted = await encryptToString(plaintext, masterKey);

  const vault = fs.existsSync(vaultPath) ? parseVaultFile(vaultPath) : { version: 1, entries: {} };
  vault.entries[profile] = { encrypted, updatedAt: new Date().toISOString() };
  writeVaultFile(vaultPath, vault);

  console.log(`✔ Pushed "${envPath}" → vault profile "${profile}"`);
}

/**
 * Pull: read vault, decrypt entry, write .env file
 */
export async function pullEnv(options: SyncOptions = {}): Promise<void> {
  const envPath = path.resolve(options.envFile ?? '.env');
  const vaultPath = resolveVaultPath(options.vaultFile);
  const profile = options.profile ?? 'default';

  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault file not found: ${vaultPath}`);
  }

  const masterKey = getKey(profile);
  if (!masterKey) {
    throw new Error(`No key found for profile "${profile}". Run: envault keys add ${profile}`);
  }

  const vault = parseVaultFile(vaultPath);
  const entry = vault.entries[profile];
  if (!entry) {
    throw new Error(`No entry for profile "${profile}" in vault.`);
  }

  const plaintext = await decryptFromString(entry.encrypted, masterKey);
  fs.writeFileSync(envPath, plaintext, 'utf-8');

  console.log(`✔ Pulled vault profile "${profile}" → "${envPath}"`);
}
