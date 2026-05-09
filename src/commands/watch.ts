import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys';
import { encrypt, decrypt } from '../crypto';

export interface WatchOptions {
  env: string;
  keystorePath?: string;
  vaultPath?: string;
  debounceMs?: number;
}

export async function watchEnvFile(
  envFile: string,
  masterKey: string,
  options: WatchOptions
): Promise<() => void> {
  const { env, vaultPath, debounceMs = 300 } = options;

  if (!fs.existsSync(envFile)) {
    throw new Error(`File not found: ${envFile}`);
  }

  const resolvedVault = resolveVaultPath(vaultPath);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const handleChange = async () => {
    try {
      const raw = fs.readFileSync(envFile, 'utf-8');
      const vault = fs.existsSync(resolvedVault)
        ? parseVaultFile(fs.readFileSync(resolvedVault, 'utf-8'))
        : { version: 1, entries: {} };

      const keyBuffer = Buffer.from(masterKey, 'hex');
      const encrypted = await encrypt(raw, keyBuffer);

      vault.entries[env] = {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        updatedAt: new Date().toISOString(),
      };

      writeVaultFile(resolvedVault, vault);
    } catch (err) {
      // silently ignore transient read errors during watch
    }
  };

  const watcher = fs.watch(envFile, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleChange, debounceMs);
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
  };
}
