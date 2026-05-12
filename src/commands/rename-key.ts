import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString, encryptToString } from '../crypto';

export interface RenameKeyOptions {
  vaultPath?: string;
  keystorePath?: string;
}

export async function renameKey(
  env: string,
  oldKey: string,
  newKey: string,
  masterKey: string,
  options: RenameKeyOptions = {}
): Promise<{ renamed: boolean; oldKey: string; newKey: string }> {
  if (!oldKey || !newKey) {
    throw new Error('Both old and new key names are required');
  }

  if (oldKey === newKey) {
    throw new Error('Old and new key names must be different');
  }

  if (!/^[A-Z0-9_]+$/i.test(newKey)) {
    throw new Error('New key name must contain only alphanumeric characters and underscores');
  }

  const vaultPath = resolveVaultPath(env, options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  if (!vault.entries || Object.keys(vault.entries).length === 0) {
    throw new Error(`Vault "${env}" is empty`);
  }

  if (!(oldKey in vault.entries)) {
    throw new Error(`Key "${oldKey}" not found in vault "${env}"`);
  }

  if (newKey in vault.entries) {
    throw new Error(`Key "${newKey}" already exists in vault "${env}"`);
  }

  const encryptedValue = vault.entries[oldKey];
  const decrypted = await decryptFromString(encryptedValue, masterKey);
  const reEncrypted = await encryptToString(decrypted, masterKey);

  const updatedEntries: Record<string, string> = {};
  for (const [k, v] of Object.entries(vault.entries)) {
    if (k === oldKey) {
      updatedEntries[newKey] = reEncrypted;
    } else {
      updatedEntries[k] = v;
    }
  }

  vault.entries = updatedEntries;
  vault.updatedAt = new Date().toISOString();

  writeVaultFile(vaultPath, vault);

  return { renamed: true, oldKey, newKey };
}
