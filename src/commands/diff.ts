import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface DiffEntry {
  key: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  localValue?: string;
  vaultValue?: string;
}

export async function diffEnvWithVault(
  envFilePath: string,
  environment: string,
  keystorePath?: string
): Promise<DiffEntry[]> {
  const vaultPath = resolveVaultPath(envFilePath);

  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault file not found at: ${vaultPath}`);
  }

  if (!fs.existsSync(envFilePath)) {
    throw new Error(`.env file not found at: ${envFilePath}`);
  }

  const vault = parseVaultFile(vaultPath);
  const envEntry = vault.environments[environment];

  if (!envEntry) {
    throw new Error(`Environment '${environment}' not found in vault.`);
  }

  const masterKey = await getKey(environment, keystorePath);
  if (!masterKey) {
    throw new Error(`No master key found for environment '${environment}'.`);
  }

  const decrypted = await decryptFromString(envEntry.encrypted, masterKey);
  const vaultEnv = parseDotEnvString(decrypted);

  const localRaw = fs.readFileSync(envFilePath, 'utf-8');
  const localEnv = parseDotEnvString(localRaw);

  const allKeys = new Set([...Object.keys(localEnv), ...Object.keys(vaultEnv)]);
  const results: DiffEntry[] = [];

  for (const key of allKeys) {
    const inLocal = key in localEnv;
    const inVault = key in vaultEnv;

    if (inLocal && !inVault) {
      results.push({ key, status: 'added', localValue: localEnv[key] });
    } else if (!inLocal && inVault) {
      results.push({ key, status: 'removed', vaultValue: vaultEnv[key] });
    } else if (localEnv[key] !== vaultEnv[key]) {
      results.push({ key, status: 'changed', localValue: localEnv[key], vaultValue: vaultEnv[key] });
    } else {
      results.push({ key, status: 'unchanged', localValue: localEnv[key], vaultValue: vaultEnv[key] });
    }
  }

  return results.sort((a, b) => a.key.localeCompare(b.key));
}

function parseDotEnvString(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}
