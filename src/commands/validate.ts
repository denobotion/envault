import { parseVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface ValidationResult {
  env: string;
  key: string;
  valid: boolean;
  error?: string;
}

export interface ValidateOptions {
  vaultPath?: string;
  keystorePath?: string;
}

export async function validateEnv(
  env: string,
  masterKey: string,
  options: ValidateOptions = {}
): Promise<ValidationResult[]> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  const entry = vault.envs[env];
  if (!entry) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const results: ValidationResult[] = [];

  for (const [key, encryptedValue] of Object.entries(entry.values)) {
    try {
      const decrypted = await decryptFromString(encryptedValue, masterKey);
      results.push({
        env,
        key,
        valid: typeof decrypted === 'string' && decrypted.length >= 0,
      });
    } catch (err: any) {
      results.push({
        env,
        key,
        valid: false,
        error: err?.message ?? 'Decryption failed',
      });
    }
  }

  return results;
}

export async function validateAllEnvs(
  masterKey: string,
  options: ValidateOptions = {}
): Promise<Record<string, ValidationResult[]>> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);
  const report: Record<string, ValidationResult[]> = {};

  for (const env of Object.keys(vault.envs)) {
    report[env] = await validateEnv(env, masterKey, options);
  }

  return report;
}
