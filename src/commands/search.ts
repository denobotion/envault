import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface SearchMatch {
  environment: string;
  key: string;
  value: string;
}

export interface SearchOptions {
  vaultPath?: string;
  keystorePath?: string;
  environment?: string;
  showValues?: boolean;
  caseSensitive?: boolean;
}

export async function searchKeys(
  pattern: string,
  masterKey: string,
  options: SearchOptions = {}
): Promise<SearchMatch[]> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  const environments = options.environment
    ? [options.environment]
    : Object.keys(vault.environments);

  const flags = options.caseSensitive ? '' : 'i';
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch {
    throw new Error(`Invalid search pattern: "${pattern}"`);
  }

  const matches: SearchMatch[] = [];

  for (const env of environments) {
    const envData = vault.environments[env];
    if (!envData) {
      throw new Error(`Environment "${env}" not found in vault`);
    }

    const keyName = getKey(envData.keyAlias, options.keystorePath);
    if (!keyName) {
      throw new Error(`Key alias "${envData.keyAlias}" not found in keystore`);
    }

    const decrypted = decryptFromString(envData.ciphertext, masterKey);
    const lines = decrypted.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();

      if (regex.test(key)) {
        matches.push({
          environment: env,
          key,
          value: options.showValues ? value : '***',
        });
      }
    }
  }

  return matches;
}
