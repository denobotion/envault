import * as fs from 'fs';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface DeleteOptions {
  env: string;
  key: string;
  vaultPath?: string;
  keystorePath?: string;
}

export interface DeleteResult {
  deleted: boolean;
  key: string;
  env: string;
}

export async function deleteKey(options: DeleteOptions): Promise<DeleteResult> {
  const { env, key, vaultPath, keystorePath } = options;

  const resolvedVaultPath = resolveVaultPath(vaultPath);

  if (!fs.existsSync(resolvedVaultPath)) {
    throw new Error(`Vault file not found: ${resolvedVaultPath}`);
  }

  const masterKey = await getKey(env, keystorePath);
  if (!masterKey) {
    throw new Error(`No master key found for environment: ${env}`);
  }

  const vaultData = parseVaultFile(resolvedVaultPath);

  if (!vaultData[env]) {
    throw new Error(`Environment '${env}' not found in vault`);
  }

  const encryptedPayload = vaultData[env];
  const decrypted = await decryptFromString(encryptedPayload, masterKey);
  const entries: Record<string, string> = JSON.parse(decrypted);

  if (!(key in entries)) {
    return { deleted: false, key, env };
  }

  delete entries[key];

  const { encryptToString } = await import('../crypto');
  const updatedEncrypted = await encryptToString(JSON.stringify(entries), masterKey);

  vaultData[env] = updatedEncrypted;
  writeVaultFile(resolvedVaultPath, vaultData);

  return { deleted: true, key, env };
}
