import { loadKeyStore, getKey } from '../keys/keystore';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault/vault';
import { decryptFromString } from '../crypto/decrypt';
import { encryptToString } from '../crypto/encrypt';

export interface RekeyOptions {
  vaultPath?: string;
  keystorePath?: string;
  oldKeyName: string;
  newKeyName: string;
}

export interface RekeyResult {
  rekeyedCount: number;
  skippedCount: number;
  environment: string;
}

export async function rekeyVault(
  environment: string,
  options: RekeyOptions
): Promise<RekeyResult> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const keystore = await loadKeyStore(options.keystorePath);

  const oldKey = getKey(keystore, options.oldKeyName);
  if (!oldKey) {
    throw new Error(`Old key "${options.oldKeyName}" not found in keystore`);
  }

  const newKey = getKey(keystore, options.newKeyName);
  if (!newKey) {
    throw new Error(`New key "${options.newKeyName}" not found in keystore`);
  }

  const vault = parseVaultFile(vaultPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault`);
  }

  const entries = vault.environments[environment];
  let rekeyedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    try {
      const plaintext = await decryptFromString(entry.value, oldKey);
      entry.value = await encryptToString(plaintext, newKey);
      rekeyedCount++;
    } catch {
      skippedCount++;
    }
  }

  vault.environments[environment] = entries;
  writeVaultFile(vaultPath, vault);

  return { rekeyedCount, skippedCount, environment };
}
