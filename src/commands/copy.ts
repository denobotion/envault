import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString, encryptToString } from '../crypto';

export interface CopyOptions {
  vaultPath?: string;
  keystorePath?: string;
}

export async function copyEnvKey(
  sourceEnv: string,
  targetEnv: string,
  keyName: string,
  options: CopyOptions = {}
): Promise<void> {
  const sourcePath = resolveVaultPath(sourceEnv, options.vaultPath);
  const targetPath = resolveVaultPath(targetEnv, options.vaultPath);

  const sourceVault = await parseVaultFile(sourcePath);
  const targetVault = await parseVaultFile(targetPath);

  const sourceEntry = sourceVault.entries[keyName];
  if (!sourceEntry) {
    throw new Error(`Key "${keyName}" not found in environment "${sourceEnv}"`);
  }

  const sourceMasterKey = await getKey(sourceEnv, options.keystorePath);
  if (!sourceMasterKey) {
    throw new Error(`No master key found for environment "${sourceEnv}"`);
  }

  const targetMasterKey = await getKey(targetEnv, options.keystorePath);
  if (!targetMasterKey) {
    throw new Error(`No master key found for environment "${targetEnv}"`);
  }

  const decryptedValue = await decryptFromString(sourceEntry.value, sourceMasterKey);
  const reEncryptedValue = await encryptToString(decryptedValue, targetMasterKey);

  targetVault.entries[keyName] = {
    value: reEncryptedValue,
    updatedAt: new Date().toISOString(),
  };

  await writeVaultFile(targetPath, targetVault);
}

export async function copyAllKeys(
  sourceEnv: string,
  targetEnv: string,
  options: CopyOptions = {}
): Promise<string[]> {
  const sourcePath = resolveVaultPath(sourceEnv, options.vaultPath);
  const sourceVault = await parseVaultFile(sourcePath);
  const keys = Object.keys(sourceVault.entries);

  for (const key of keys) {
    await copyEnvKey(sourceEnv, targetEnv, key, options);
  }

  return keys;
}
