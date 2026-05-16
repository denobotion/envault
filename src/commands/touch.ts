import * as path from 'path';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { encryptToString } from '../crypto';

export interface TouchOptions {
  vaultPath?: string;
  keystorePath?: string;
  env?: string;
}

export interface TouchResult {
  created: string[];
  skipped: string[];
}

/**
 * Ensures one or more keys exist in the vault with an empty string value.
 * Keys that already exist are skipped (not overwritten).
 */
export async function touchKeys(
  keys: string[],
  masterKeyName: string,
  options: TouchOptions = {}
): Promise<TouchResult> {
  if (!keys || keys.length === 0) {
    throw new Error('At least one key name must be provided');
  }

  for (const key of keys) {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      throw new Error(`Invalid key name: "${key}". Keys must be alphanumeric with underscores.`);
    }
  }

  const vaultFile = resolveVaultPath(options.vaultPath);
  const env = options.env ?? 'default';

  const masterKey = await getKey(masterKeyName, options.keystorePath);
  if (!masterKey) {
    throw new Error(`Master key "${masterKeyName}" not found in keystore`);
  }

  const vault = parseVaultFile(vaultFile);
  const envEntries = vault[env] ?? {};

  const result: TouchResult = { created: [], skipped: [] };

  for (const key of keys) {
    if (key in envEntries) {
      result.skipped.push(key);
    } else {
      const encrypted = await encryptToString('', masterKey);
      envEntries[key] = encrypted;
      result.created.push(key);
    }
  }

  vault[env] = envEntries;
  writeVaultFile(vaultFile, vault);

  return result;
}
