import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString, encryptToString } from '../crypto';

export interface RenameOptions {
  env?: string;
  vaultPath?: string;
}

export interface RenameResult {
  oldKey: string;
  newKey: string;
  env: string;
}

export async function renameKey(
  masterKeyName: string,
  oldKey: string,
  newKey: string,
  options: RenameOptions = {}
): Promise<RenameResult> {
  const env = options.env ?? 'default';
  const vaultPath = resolveVaultPath(options.vaultPath);

  const masterKey = await getKey(masterKeyName);
  if (!masterKey) {
    throw new Error(`Master key "${masterKeyName}" not found in keystore.`);
  }

  const vault = parseVaultFile(vaultPath);
  const envEntries = vault[env];

  if (!envEntries) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  if (!(oldKey in envEntries)) {
    throw new Error(`Key "${oldKey}" not found in environment "${env}".`);
  }

  if (newKey in envEntries) {
    throw new Error(`Key "${newKey}" already exists in environment "${env}".`);
  }

  const encryptedValue = envEntries[oldKey];
  const decrypted = await decryptFromString(encryptedValue, masterKey);
  const reEncrypted = await encryptToString(decrypted, masterKey);

  const updatedEntries = { ...envEntries };
  delete updatedEntries[oldKey];
  updatedEntries[newKey] = reEncrypted;

  vault[env] = updatedEntries;
  writeVaultFile(vaultPath, vault);

  return { oldKey, newKey, env };
}
