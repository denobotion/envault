import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface EnvExportOptions {
  environment?: string;
  keyName?: string;
  keystorePath?: string;
  vaultPath?: string;
  shell?: 'bash' | 'fish' | 'json';
  keys?: string[];
}

export interface EnvExportResult {
  output: string;
  count: number;
}

/**
 * Exports decrypted env vars as shell export statements or JSON
 * suitable for eval or direct sourcing.
 */
export async function exportEnvVars(
  options: EnvExportOptions = {}
): Promise<EnvExportResult> {
  const {
    environment = 'default',
    keyName = 'default',
    keystorePath,
    vaultPath,
    shell = 'bash',
    keys,
  } = options;

  const resolvedVault = resolveVaultPath(vaultPath);
  if (!fs.existsSync(resolvedVault)) {
    throw new Error(`Vault not found at: ${resolvedVault}`);
  }

  const vault = parseVaultFile(resolvedVault);
  const entry = vault.environments[environment];
  if (!entry) {
    throw new Error(`Environment "${environment}" not found in vault.`);
  }

  const masterKey = await getKey(keyName, keystorePath);
  if (!masterKey) {
    throw new Error(`Key "${keyName}" not found in keystore.`);
  }

  const decrypted = await decryptFromString(entry.ciphertext, masterKey);
  const lines = decrypted.split('\n').filter(Boolean);

  const pairs: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!keys || keys.includes(k)) {
      pairs[k] = v;
    }
  }

  const entries = Object.entries(pairs);
  let output: string;

  if (shell === 'json') {
    output = JSON.stringify(pairs, null, 2);
  } else if (shell === 'fish') {
    output = entries
      .map(([k, v]) => `set -x ${k} ${v};`)
      .join('\n');
  } else {
    output = entries
      .map(([k, v]) => `export ${k}=${v}`)
      .join('\n');
  }

  return { output, count: entries.length };
}
