import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';
import { encryptToString } from '../crypto';
import * as fs from 'fs';

export interface CloneOptions {
  vaultDir?: string;
  keystoreDir?: string;
}

export async function cloneEnvironment(
  sourceEnv: string,
  targetEnv: string,
  masterKey: string,
  options: CloneOptions = {}
): Promise<void> {
  const sourceVaultPath = resolveVaultPath(sourceEnv, options.vaultDir);

  if (!fs.existsSync(sourceVaultPath)) {
    throw new Error(`Source environment "${sourceEnv}" does not exist.`);
  }

  const targetVaultPath = resolveVaultPath(targetEnv, options.vaultDir);

  if (fs.existsSync(targetVaultPath)) {
    throw new Error(`Target environment "${targetEnv}" already exists. Use merge or delete first.`);
  }

  const key = await getKey(masterKey, options.keystoreDir);
  const sourceVault = parseVaultFile(sourceVaultPath);

  const clonedEntries: Record<string, string> = {};

  for (const [k, encryptedValue] of Object.entries(sourceVault.entries)) {
    const plaintext = await decryptFromString(encryptedValue, key);
    clonedEntries[k] = await encryptToString(plaintext, key);
  }

  const targetVault = {
    version: sourceVault.version,
    entries: clonedEntries,
    tags: sourceVault.tags ? { ...sourceVault.tags } : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeVaultFile(targetVaultPath, targetVault);
}
