import { parseVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface CompareEntry {
  key: string;
  status: 'same' | 'different' | 'only_in_source' | 'only_in_target';
  sourceValue?: string;
  targetValue?: string;
}

export interface CompareResult {
  source: string;
  target: string;
  entries: CompareEntry[];
}

export async function compareEnvs(
  sourceEnv: string,
  targetEnv: string,
  masterKey: string,
  vaultPath?: string
): Promise<CompareResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  const sourceRecord = vault.envs[sourceEnv];
  if (!sourceRecord) throw new Error(`Environment "${sourceEnv}" not found in vault.`);

  const targetRecord = vault.envs[targetEnv];
  if (!targetRecord) throw new Error(`Environment "${targetEnv}" not found in vault.`);

  const sourceKey = await getKey(masterKey, sourceRecord.keyId);
  const targetKey = await getKey(masterKey, targetRecord.keyId);

  const sourcePlain = await decryptFromString(sourceRecord.ciphertext, sourceKey);
  const targetPlain = await decryptFromString(targetRecord.ciphertext, targetKey);

  const sourceMap = parsePlainEnv(sourcePlain);
  const targetMap = parsePlainEnv(targetPlain);

  const allKeys = new Set([...sourceMap.keys(), ...targetMap.keys()]);
  const entries: CompareEntry[] = [];

  for (const key of allKeys) {
    const inSource = sourceMap.has(key);
    const inTarget = targetMap.has(key);

    if (inSource && inTarget) {
      const sv = sourceMap.get(key)!;
      const tv = targetMap.get(key)!;
      entries.push({
        key,
        status: sv === tv ? 'same' : 'different',
        sourceValue: sv,
        targetValue: tv,
      });
    } else if (inSource) {
      entries.push({ key, status: 'only_in_source', sourceValue: sourceMap.get(key) });
    } else {
      entries.push({ key, status: 'only_in_target', targetValue: targetMap.get(key) });
    }
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));

  return { source: sourceEnv, target: targetEnv, entries };
}

function parsePlainEnv(plain: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of plain.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
    map.set(key, value);
  }
  return map;
}
