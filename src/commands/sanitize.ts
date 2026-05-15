import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface SanitizeResult {
  environment: string;
  removed: string[];
  updated: string[];
  total: number;
}

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /auth/i,
];

const PLACEHOLDER_PATTERN = /^(REPLACE_ME|TODO|CHANGEME|<.*>|\[.*\]|your[_-].*)$/i;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value.trim());
}

function isSensitiveKey(key: string): boolean {
  return SUSPICIOUS_PATTERNS.some((re) => re.test(key));
}

export async function sanitizeVault(
  environment: string,
  keystorePath: string,
  vaultDir: string,
  dryRun = false
): Promise<SanitizeResult> {
  const vaultPath = resolveVaultPath(vaultDir, environment);
  const vault = parseVaultFile(vaultPath);
  const masterKey = getKey(keystorePath, environment);

  if (!masterKey) {
    throw new Error(`No key found for environment: ${environment}`);
  }

  const removed: string[] = [];
  const updated: string[] = [];
  const sanitized: Record<string, string> = {};

  for (const [encKey, encValue] of Object.entries(vault.entries)) {
    const key = decryptFromString(encKey, masterKey);
    const value = decryptFromString(encValue, masterKey);

    if (isPlaceholder(value)) {
      removed.push(key);
      continue;
    }

    if (isSensitiveKey(key) && value.length < 8) {
      updated.push(key);
      // Keep the entry but flag it — in non-dry-run we still retain it
    }

    sanitized[encKey] = encValue;
  }

  if (!dryRun && removed.length > 0) {
    writeVaultFile(vaultPath, { ...vault, entries: sanitized });
  }

  return {
    environment,
    removed,
    updated,
    total: Object.keys(vault.entries).length,
  };
}
