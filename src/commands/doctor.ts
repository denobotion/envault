import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { loadKeyStore } from '../keys/keystore';
import { decryptFromString } from '../crypto';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  healthy: boolean;
}

export async function runDoctor(
  vaultPath: string,
  keystorePath: string
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];

  // Check 1: vault file exists
  const resolvedVault = resolveVaultPath(vaultPath);
  if (!fs.existsSync(resolvedVault)) {
    checks.push({ name: 'vault-exists', status: 'error', message: `Vault file not found at ${resolvedVault}` });
  } else {
    checks.push({ name: 'vault-exists', status: 'ok', message: `Vault file found at ${resolvedVault}` });
  }

  // Check 2: vault file is valid JSON
  let vault: ReturnType<typeof parseVaultFile> | null = null;
  if (fs.existsSync(resolvedVault)) {
    try {
      vault = parseVaultFile(resolvedVault);
      checks.push({ name: 'vault-valid', status: 'ok', message: 'Vault file is valid' });
    } catch {
      checks.push({ name: 'vault-valid', status: 'error', message: 'Vault file is corrupted or invalid JSON' });
    }
  }

  // Check 3: keystore exists
  const ksPath = path.resolve(keystorePath);
  if (!fs.existsSync(ksPath)) {
    checks.push({ name: 'keystore-exists', status: 'warn', message: `Keystore not found at ${ksPath}` });
  } else {
    checks.push({ name: 'keystore-exists', status: 'ok', message: `Keystore found at ${ksPath}` });
  }

  // Check 4: keystore has at least one key
  if (fs.existsSync(ksPath)) {
    const ks = loadKeyStore(ksPath);
    const keyCount = Object.keys(ks.keys).length;
    if (keyCount === 0) {
      checks.push({ name: 'keystore-has-keys', status: 'warn', message: 'Keystore exists but contains no keys' });
    } else {
      checks.push({ name: 'keystore-has-keys', status: 'ok', message: `Keystore contains ${keyCount} key(s)` });
    }

    // Check 5: vault entries are decryptable with active key
    if (vault && ks.activeKey) {
      const masterKey = ks.keys[ks.activeKey];
      const entries = Object.entries(vault.entries);
      let failCount = 0;
      for (const [, entry] of entries) {
        try {
          await decryptFromString(entry.ciphertext, masterKey);
        } catch {
          failCount++;
        }
      }
      if (failCount === 0) {
        checks.push({ name: 'entries-decryptable', status: 'ok', message: `All ${entries.length} entry(ies) decryptable with active key` });
      } else {
        checks.push({ name: 'entries-decryptable', status: 'error', message: `${failCount}/${entries.length} entry(ies) failed decryption` });
      }
    }
  }

  const healthy = checks.every(c => c.status !== 'error');
  return { checks, healthy };
}
