import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { encrypt } from '../crypto';
import * as path from 'path';
import * as os from 'os';

export interface SetOptions {
  vaultDir?: string;
  keystoreDir?: string;
}

export interface SetResult {
  env: string;
  key: string;
  updated: boolean;
}

export async function setEntry(
  env: string,
  key: string,
  value: string,
  options: SetOptions = {}
): Promise<SetResult> {
  const vaultDir = options.vaultDir ?? process.cwd();
  const keystoreDir = options.keystoreDir ?? path.join(os.homedir(), '.envault');

  const masterKey = await getKey(env, keystoreDir);
  if (!masterKey) {
    throw new Error(`No master key found for environment "${env}". Run envault init first.`);
  }

  const vaultPath = resolveVaultPath(env, vaultDir);
  const vault = parseVaultFile(vaultPath);

  const existing = vault.entries.find((e) => e.key === key);
  const encrypted = await encrypt(value, masterKey);

  if (existing) {
    existing.value = encrypted;
    existing.updatedAt = new Date().toISOString();
  } else {
    vault.entries.push({
      key,
      value: encrypted,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  writeVaultFile(vaultPath, vault);

  return { env, key, updated: !!existing };
}
