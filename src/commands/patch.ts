import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface PatchEntry {
  key: string;
  value: string;
}

export interface PatchResult {
  updated: string[];
  added: string[];
  skipped: string[];
}

/**
 * Apply a set of key=value patches to an existing vault environment.
 * Existing keys are updated, new keys are added, and keys with undefined
 * value (null sentinel) are left untouched when skipMissing is true.
 */
export async function patchVault(
  vaultPath: string,
  env: string,
  patches: PatchEntry[],
  masterKey: string,
  options: { overwrite?: boolean; dryRun?: boolean } = {}
): Promise<PatchResult> {
  const { overwrite = true, dryRun = false } = options;

  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[env]) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const keyEntry = await getKey(vaultPath, env);
  const activeKey = keyEntry ?? masterKey;

  const result: PatchResult = { updated: [], added: [], skipped: [] };
  const entries = vault.environments[env].entries as Record<string, string>;

  for (const { key, value } of patches) {
    const exists = key in entries;

    if (exists && !overwrite) {
      result.skipped.push(key);
      continue;
    }

    const encryptedValue = await import('../crypto').then((m) =>
      m.encryptToString(value, activeKey)
    );

    if (!dryRun) {
      entries[key] = encryptedValue;
    }

    if (exists) {
      result.updated.push(key);
    } else {
      result.added.push(key);
    }
  }

  if (!dryRun) {
    vault.environments[env].entries = entries;
    writeVaultFile(resolvedPath, vault);
  }

  return result;
}
