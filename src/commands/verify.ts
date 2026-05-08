import * as fs from 'fs';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface VerifyResult {
  environment: string;
  vaultPath: string;
  valid: boolean;
  keyAlias: string;
  entryCount: number;
  errors: string[];
}

export async function verifyVault(
  environment: string,
  keystorePath: string
): Promise<VerifyResult> {
  const errors: string[] = [];
  const vaultPath = resolveVaultPath(environment);

  if (!fs.existsSync(vaultPath)) {
    return {
      environment,
      vaultPath,
      valid: false,
      keyAlias: '',
      entryCount: 0,
      errors: [`Vault file not found: ${vaultPath}`],
    };
  }

  let vaultData: ReturnType<typeof parseVaultFile>;
  try {
    vaultData = parseVaultFile(vaultPath);
  } catch (err: any) {
    return {
      environment,
      vaultPath,
      valid: false,
      keyAlias: '',
      entryCount: 0,
      errors: [`Failed to parse vault file: ${err.message}`],
    };
  }

  const { keyAlias, entries } = vaultData;

  const masterKey = getKey(keystorePath, keyAlias);
  if (!masterKey) {
    return {
      environment,
      vaultPath,
      valid: false,
      keyAlias,
      entryCount: entries.length,
      errors: [`Key alias "${keyAlias}" not found in keystore`],
    };
  }

  for (const entry of entries) {
    try {
      await decryptFromString(entry.encryptedValue, masterKey);
    } catch {
      errors.push(`Failed to decrypt entry with key "${entry.key}"`);
    }
  }

  return {
    environment,
    vaultPath,
    valid: errors.length === 0,
    keyAlias,
    entryCount: entries.length,
    errors,
  };
}
