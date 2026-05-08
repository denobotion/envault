import * as fs from 'fs';
import * as path from 'path';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';
import { encryptToString } from '../crypto';

export interface MergeOptions {
  vaultPath?: string;
  keystorePath?: string;
  overwrite?: boolean;
}

export interface MergeResult {
  added: string[];
  skipped: string[];
  overwritten: string[];
}

export async function mergeEnvIntoVault(
  envFilePath: string,
  environment: string,
  masterKeyAlias: string,
  options: MergeOptions = {}
): Promise<MergeResult> {
  const resolvedVaultPath = resolveVaultPath(options.vaultPath);

  if (!fs.existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${envFilePath}`);
  }

  const rawEnv = fs.readFileSync(envFilePath, 'utf-8');
  const incoming = parseDotEnvLines(rawEnv);

  const vault = fs.existsSync(resolvedVaultPath)
    ? parseVaultFile(resolvedVaultPath)
    : { version: 1, environments: {} };

  const masterKey = await getKey(masterKeyAlias, options.keystorePath);
  if (!masterKey) {
    throw new Error(`Master key '${masterKeyAlias}' not found in keystore`);
  }

  if (!vault.environments[environment]) {
    vault.environments[environment] = { entries: [] };
  }

  const env = vault.environments[environment];
  const result: MergeResult = { added: [], skipped: [], overwritten: [] };

  for (const [key, value] of Object.entries(incoming)) {
    const existingIndex = env.entries.findIndex((e: any) => e.key === key);

    if (existingIndex !== -1 && !options.overwrite) {
      result.skipped.push(key);
      continue;
    }

    const encryptedValue = await encryptToString(value, masterKey);
    const entry = { key, value: encryptedValue, updatedAt: new Date().toISOString() };

    if (existingIndex !== -1) {
      env.entries[existingIndex] = entry;
      result.overwritten.push(key);
    } else {
      env.entries.push(entry);
      result.added.push(key);
    }
  }

  writeVaultFile(resolvedVaultPath, vault);
  return result;
}

function parseDotEnvLines(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = value;
  }
  return result;
}
