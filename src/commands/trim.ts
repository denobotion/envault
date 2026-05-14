import { loadKeyStore, getKey } from '../keys/keystore';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault/vault';
import { decryptFromString } from '../crypto/decrypt';
import { encryptToString } from '../crypto/encrypt';

export interface TrimResult {
  environment: string;
  removedKeys: string[];
  remainingCount: number;
}

/**
 * Removes all keys from an environment whose decrypted values are empty or whitespace-only.
 */
export async function trimEnvironment(
  environment: string,
  vaultPath?: string
): Promise<TrimResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault.`);
  }

  const keystore = await loadKeyStore();
  const masterKey = getKey(keystore, environment);

  if (!masterKey) {
    throw new Error(`No master key found for environment "${environment}".`);
  }

  const entries = vault.environments[environment];
  const removedKeys: string[] = [];
  const trimmedEntries: Record<string, string> = {};

  for (const [key, encryptedValue] of Object.entries(entries)) {
    const decrypted = await decryptFromString(encryptedValue, masterKey);
    if (decrypted.trim().length === 0) {
      removedKeys.push(key);
    } else {
      trimmedEntries[key] = encryptedValue;
    }
  }

  vault.environments[environment] = trimmedEntries;
  writeVaultFile(resolvedPath, vault);

  return {
    environment,
    removedKeys,
    remainingCount: Object.keys(trimmedEntries).length,
  };
}

/**
 * Removes specific keys from an environment by name.
 */
export async function trimKeys(
  environment: string,
  keys: string[],
  vaultPath?: string
): Promise<TrimResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault.`);
  }

  const entries = vault.environments[environment];
  const removedKeys: string[] = [];

  for (const key of keys) {
    if (key in entries) {
      delete entries[key];
      removedKeys.push(key);
    }
  }

  writeVaultFile(resolvedPath, vault);

  return {
    environment,
    removedKeys,
    remainingCount: Object.keys(entries).length,
  };
}
