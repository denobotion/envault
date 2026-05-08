import * as fs from 'fs';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface PruneOptions {
  vaultPath?: string;
  keyName?: string;
  dryRun?: boolean;
}

export interface PruneResult {
  removed: string[];
  kept: string[];
  errors: string[];
}

/**
 * Prunes environments from the vault whose encrypted data cannot be
 * decrypted with the current key (i.e. orphaned / corrupted entries).
 */
export async function pruneVault(options: PruneOptions = {}): Promise<PruneResult> {
  const vaultFile = resolveVaultPath(options.vaultPath);

  if (!fs.existsSync(vaultFile)) {
    throw new Error(`Vault file not found: ${vaultFile}`);
  }

  const keyName = options.keyName ?? 'default';
  const masterKey = await getKey(keyName);

  if (!masterKey) {
    throw new Error(`Master key '${keyName}' not found in keystore.`);
  }

  const vault = parseVaultFile(vaultFile);
  const result: PruneResult = { removed: [], kept: [], errors: [] };
  const surviving: typeof vault.environments = {};

  for (const [envName, envData] of Object.entries(vault.environments)) {
    try {
      await decryptFromString(envData.encrypted, masterKey);
      surviving[envName] = envData;
      result.kept.push(envName);
    } catch {
      result.removed.push(envName);
    }
  }

  if (!options.dryRun && result.removed.length > 0) {
    vault.environments = surviving;
    writeVaultFile(vaultFile, vault);
  }

  return result;
}
