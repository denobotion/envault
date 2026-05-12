import { resolveVaultPath, parseVaultFile } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface VaultStats {
  environment: string;
  totalKeys: number;
  totalSize: number;
  avgValueLength: number;
  emptyValues: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function getVaultStats(
  environment: string,
  keystorePath: string
): Promise<VaultStats> {
  const vaultPath = resolveVaultPath(environment);
  const vault = parseVaultFile(vaultPath);

  const masterKey = await getKey(keystorePath, environment);
  if (!masterKey) {
    throw new Error(`No key found for environment: ${environment}`);
  }

  const plaintext = await decryptFromString(vault.ciphertext, masterKey);
  const lines = plaintext.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

  let totalSize = 0;
  let emptyValues = 0;
  let totalValueLength = 0;

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const value = line.slice(eqIdx + 1).trim();
    totalSize += Buffer.byteLength(line, 'utf8');
    totalValueLength += value.length;
    if (value === '') emptyValues++;
  }

  const totalKeys = lines.filter((l) => l.includes('=')).length;

  return {
    environment,
    totalKeys,
    totalSize,
    avgValueLength: totalKeys > 0 ? Math.round(totalValueLength / totalKeys) : 0,
    emptyValues,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
  };
}
