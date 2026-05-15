import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface DedupeResult {
  removed: string[];
  kept: number;
  total: number;
}

export async function dedupeVault(
  env: string,
  keystorePath: string,
  vaultPath?: string
): Promise<DedupeResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  const entry = vault.envs[env];
  if (!entry) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const masterKey = getKey(keystorePath, env);
  if (!masterKey) {
    throw new Error(`No key found for environment "${env}".`);
  }

  const plaintext = await decryptFromString(entry.encrypted, masterKey);
  const lines = plaintext.split('\n');

  const seen = new Map<string, number>();
  const removed: string[] = [];
  const deduped: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      deduped.push(line);
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      deduped.push(line);
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();

    if (seen.has(key)) {
      removed.push(key);
      // Replace the previously kept line with this (last-wins)
      const prevIndex = seen.get(key)!;
      deduped[prevIndex] = line;
    } else {
      seen.set(key, deduped.length);
      deduped.push(line);
    }
  }

  if (removed.length === 0) {
    return { removed: [], kept: seen.size, total: lines.length };
  }

  const { encryptToString } = await import('../crypto');
  const newEncrypted = await encryptToString(deduped.join('\n'), masterKey);

  vault.envs[env] = {
    ...entry,
    encrypted: newEncrypted,
    updatedAt: new Date().toISOString(),
  };

  writeVaultFile(resolvedPath, vault);

  return { removed, kept: seen.size, total: lines.length };
}
