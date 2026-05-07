import * as fs from 'fs';
import * as path from 'path';
import { getKey } from '../keys/keystore';
import { encryptToString } from '../crypto';
import { writeVaultFile, resolveVaultPath } from '../vault';

export interface ImportOptions {
  env?: string;
  keyName?: string;
  vaultPath?: string;
}

export interface ImportResult {
  success: boolean;
  keysImported: number;
  environment: string;
  vaultFile: string;
}

/**
 * Parses a .env file into a key-value record.
 */
export function parseDotEnv(content: string): Record<string, string> {
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

/**
 * Imports a .env file into the vault, encrypting its contents.
 */
export async function importEnvFile(
  envFilePath: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const environment = options.env ?? 'default';
  const keyName = options.keyName ?? 'default';

  const masterKey = await getKey(keyName);
  if (!masterKey) {
    throw new Error(`Master key "${keyName}" not found. Run envault init first.`);
  }

  const absoluteEnvPath = path.resolve(envFilePath);
  if (!fs.existsSync(absoluteEnvPath)) {
    throw new Error(`File not found: ${absoluteEnvPath}`);
  }

  const content = fs.readFileSync(absoluteEnvPath, 'utf-8');
  const parsed = parseDotEnv(content);
  const keysImported = Object.keys(parsed).length;

  if (keysImported === 0) {
    throw new Error('No valid key-value pairs found in the .env file.');
  }

  const plaintext = JSON.stringify(parsed);
  const encrypted = await encryptToString(plaintext, masterKey);

  const vaultFile = resolveVaultPath(options.vaultPath, environment);
  writeVaultFile(vaultFile, { environment, encrypted, keyName });

  return { success: true, keysImported, environment, vaultFile };
}
