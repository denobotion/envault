import { loadKeyStore, getKey } from '../keys/keystore';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault/vault';
import { decryptFromString, encryptToString } from '../crypto';

export type CastType = 'string' | 'number' | 'boolean' | 'json';

export function castValue(value: string, type: CastType): string {
  switch (type) {
    case 'number': {
      const n = Number(value);
      if (isNaN(n)) throw new Error(`Value "${value}" cannot be cast to number`);
      return String(n);
    }
    case 'boolean': {
      const lower = value.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower))
        throw new Error(`Value "${value}" cannot be cast to boolean`);
      return ['true', '1', 'yes'].includes(lower) ? 'true' : 'false';
    }
    case 'json': {
      try {
        JSON.parse(value);
        return value;
      } catch {
        // Try wrapping as a JSON string
        return JSON.stringify(value);
      }
    }
    case 'string':
    default:
      return value;
  }
}

export interface CastOptions {
  env?: string;
  vaultDir?: string;
}

export async function castEntry(
  key: string,
  type: CastType,
  options: CastOptions = {}
): Promise<{ key: string; oldValue: string; newValue: string }> {
  const vaultPath = resolveVaultPath(options.env, options.vaultDir);
  const vault = parseVaultFile(vaultPath);
  const keyStore = loadKeyStore();
  const masterKey = getKey(keyStore, options.env ?? 'default');
  if (!masterKey) throw new Error('Master key not found. Run `envault init` first.');

  const entry = vault.entries.find((e) => e.key === key);
  if (!entry) throw new Error(`Key "${key}" not found in vault.`);

  const oldValue = decryptFromString(entry.value, masterKey);
  const newValue = castValue(oldValue, type);
  const encrypted = encryptToString(newValue, masterKey);

  vault.entries = vault.entries.map((e) =>
    e.key === key ? { ...e, value: encrypted } : e
  );
  writeVaultFile(vaultPath, vault);

  return { key, oldValue, newValue };
}
