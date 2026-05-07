import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface AuditEntry {
  key: string;
  exists: boolean;
  encrypted: boolean;
  decryptable: boolean;
  error?: string;
}

export interface AuditResult {
  vaultPath: string;
  envPath: string;
  entries: AuditEntry[];
  missingInEnv: string[];
  missingInVault: string[];
}

export async function auditVault(
  env: string,
  keystorePath: string,
  vaultDir: string
): Promise<AuditResult> {
  const vaultPath = resolveVaultPath(vaultDir, env);
  const envPath = path.resolve(process.cwd(), `.env.${env}`);

  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault file not found: ${vaultPath}`);
  }

  const masterKey = await getKey(keystorePath, env);
  if (!masterKey) {
    throw new Error(`No master key found for environment: ${env}`);
  }

  const vaultData = parseVaultFile(vaultPath);
  const entries: AuditEntry[] = [];

  for (const [key, encryptedValue] of Object.entries(vaultData)) {
    const entry: AuditEntry = { key, exists: true, encrypted: true, decryptable: false };
    try {
      await decryptFromString(encryptedValue, masterKey);
      entry.decryptable = true;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    entries.push(entry);
  }

  const envKeys: string[] = [];
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) envKeys.push(trimmed.slice(0, eqIdx).trim());
      }
    }
  }

  const vaultKeys = Object.keys(vaultData);
  const missingInEnv = vaultKeys.filter(k => !envKeys.includes(k));
  const missingInVault = envKeys.filter(k => !vaultKeys.includes(k));

  return { vaultPath, envPath, entries, missingInEnv, missingInVault };
}
