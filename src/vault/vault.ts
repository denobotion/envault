import * as fs from 'fs';
import * as path from 'path';
import { encryptToString } from '../crypto/encrypt';
import { decryptFromString } from '../crypto/decrypt';

export const VAULT_EXTENSION = '.vault';

export interface VaultMeta {
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  meta: VaultMeta;
  payload: string;
}

export function parseVaultFile(filePath: string): VaultFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as VaultFile;
  } catch {
    throw new Error(`Failed to parse vault file at ${filePath}`);
  }
}

export function writeVaultFile(filePath: string, vaultFile: VaultFile): void {
  fs.writeFileSync(filePath, JSON.stringify(vaultFile, null, 2), 'utf-8');
}

export async function encryptEnvToVault(
  envFilePath: string,
  vaultFilePath: string,
  masterKey: string
): Promise<void> {
  if (!fs.existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${envFilePath}`);
  }
  const plaintext = fs.readFileSync(envFilePath, 'utf-8');
  const payload = await encryptToString(plaintext, masterKey);
  const now = new Date().toISOString();
  const existing = fs.existsSync(vaultFilePath)
    ? parseVaultFile(vaultFilePath)
    : null;
  const vaultFile: VaultFile = {
    meta: {
      version: 1,
      createdAt: existing?.meta.createdAt ?? now,
      updatedAt: now,
    },
    payload,
  };
  writeVaultFile(vaultFilePath, vaultFile);
}

export async function decryptVaultToEnv(
  vaultFilePath: string,
  envFilePath: string,
  masterKey: string
): Promise<void> {
  if (!fs.existsSync(vaultFilePath)) {
    throw new Error(`Vault file not found: ${vaultFilePath}`);
  }
  const vaultFile = parseVaultFile(vaultFilePath);
  const plaintext = await decryptFromString(vaultFile.payload, masterKey);
  fs.writeFileSync(envFilePath, plaintext, 'utf-8');
}

export function resolveVaultPath(envFilePath: string): string {
  const dir = path.dirname(envFilePath);
  const base = path.basename(envFilePath);
  return path.join(dir, `${base}${VAULT_EXTENSION}`);
}
