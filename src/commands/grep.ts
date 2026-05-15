import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface GrepMatch {
  env: string;
  key: string;
  value: string;
}

export interface GrepOptions {
  vaultPath?: string;
  keystorePath?: string;
  keyName?: string;
  keysOnly?: boolean;
  valuesOnly?: boolean;
  ignoreCase?: boolean;
}

export async function grepVault(
  pattern: string,
  options: GrepOptions = {}
): Promise<GrepMatch[]> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);
  const masterKey = getKey(options.keystorePath, options.keyName ?? 'default');

  if (!masterKey) {
    throw new Error('Master key not found. Run `envault init` first.');
  }

  const flags = options.ignoreCase ? 'i' : '';
  const regex = new RegExp(pattern, flags);
  const matches: GrepMatch[] = [];

  for (const [env, entry] of Object.entries(vault.envs)) {
    const decrypted = await decryptFromString(entry.encrypted, masterKey);
    const lines = decrypted.split('\n').filter(Boolean);

    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;

      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();

      const keyMatches = !options.valuesOnly && regex.test(key);
      const valueMatches = !options.keysOnly && regex.test(value);

      if (keyMatches || valueMatches) {
        matches.push({ env, key, value });
      }
    }
  }

  return matches;
}
