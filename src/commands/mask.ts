import { loadKeyStore, getKey } from '../keys/keystore';
import { decryptFromString } from '../crypto';
import { parseVaultFile, resolveVaultPath } from '../vault';

export interface MaskOptions {
  vaultPath?: string;
  keystorePath?: string;
  keyName?: string;
  char?: string;
  revealFirst?: number;
  revealLast?: number;
}

export interface MaskedEntry {
  key: string;
  masked: string;
  original?: string;
}

export function maskValue(
  value: string,
  char = '*',
  revealFirst = 0,
  revealLast = 0
): string {
  if (value.length === 0) return '';
  const total = value.length;
  const safeFirst = Math.min(revealFirst, total);
  const safeLast = Math.min(revealLast, total - safeFirst);
  const maskLen = total - safeFirst - safeLast;
  return (
    value.slice(0, safeFirst) +
    char.repeat(maskLen) +
    value.slice(total - safeLast)
  );
}

export async function maskEnv(
  env: string,
  masterKey: string,
  options: MaskOptions = {}
): Promise<MaskedEntry[]> {
  const {
    vaultPath,
    keystorePath,
    keyName = 'default',
    char = '*',
    revealFirst = 0,
    revealLast = 0,
  } = options;

  const resolvedPath = resolveVaultPath(env, vaultPath);
  const vault = parseVaultFile(resolvedPath);
  const keystore = loadKeyStore(keystorePath);
  const key = getKey(keystore, keyName);
  if (!key) throw new Error(`Key "${keyName}" not found in keystore`);

  const entries: MaskedEntry[] = [];

  for (const [k, encryptedValue] of Object.entries(vault.entries)) {
    const decrypted = await decryptFromString(encryptedValue, masterKey);
    entries.push({
      key: k,
      masked: maskValue(decrypted, char, revealFirst, revealLast),
    });
  }

  return entries;
}
