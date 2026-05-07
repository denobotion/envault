import * as fs from 'fs';
import * as path from 'path';
import { decryptFromString } from '../crypto';
import { parseVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';

export interface ExportOptions {
  env?: string;
  output?: string;
  keyId?: string;
}

export async function exportEnv(
  vaultPath: string,
  options: ExportOptions = {}
): Promise<string> {
  const resolvedVault = resolveVaultPath(vaultPath);

  if (!fs.existsSync(resolvedVault)) {
    throw new Error(`Vault file not found: ${resolvedVault}`);
  }

  const raw = fs.readFileSync(resolvedVault, 'utf-8');
  const vault = parseVaultFile(raw);

  const env = options.env ?? vault.defaultEnv ?? 'default';
  const entry = vault.entries?.[env];

  if (!entry) {
    throw new Error(`No entry found for environment: ${env}`);
  }

  const keyId = options.keyId ?? entry.keyId;
  if (!keyId) {
    throw new Error('No keyId specified or found in vault entry');
  }

  const masterKey = await getKey(keyId);
  if (!masterKey) {
    throw new Error(`Master key not found for keyId: ${keyId}`);
  }

  const decrypted = await decryptFromString(entry.ciphertext, masterKey);

  if (options.output) {
    const outPath = path.resolve(options.output);
    fs.writeFileSync(outPath, decrypted, 'utf-8');
  }

  return decrypted;
}
