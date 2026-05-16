import { loadKeyStore, getKey } from '../keys/keystore';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault/vault';
import { decryptFromString } from '../crypto';

export interface AnnotateOptions {
  vaultPath?: string;
  keystorePath?: string;
}

export interface AnnotateResult {
  env: string;
  key: string;
  annotation: string;
}

export async function annotateKey(
  env: string,
  key: string,
  annotation: string,
  masterKey: string,
  options: AnnotateOptions = {}
): Promise<AnnotateResult> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  const envBlock = vault.envs[env];
  if (!envBlock) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const entry = envBlock.entries.find((e) => e.key === key);
  if (!entry) {
    throw new Error(`Key "${key}" not found in environment "${env}".`);
  }

  const keyStore = loadKeyStore(options.keystorePath);
  const keyEntry = getKey(keyStore, env);
  if (!keyEntry) {
    throw new Error(`No encryption key found for environment "${env}".`);
  }

  // Verify the master key can decrypt (validates access)
  await decryptFromString(entry.value, masterKey);

  entry.annotation = annotation;
  writeVaultFile(vaultPath, vault);

  return { env, key, annotation };
}

export async function removeAnnotation(
  env: string,
  key: string,
  masterKey: string,
  options: AnnotateOptions = {}
): Promise<void> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  const envBlock = vault.envs[env];
  if (!envBlock) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const entry = envBlock.entries.find((e) => e.key === key);
  if (!entry) {
    throw new Error(`Key "${key}" not found in environment "${env}".`);
  }

  await decryptFromString(entry.value, masterKey);

  delete entry.annotation;
  writeVaultFile(vaultPath, vault);
}

export function listAnnotations(
  env: string,
  options: AnnotateOptions = {}
): Array<{ key: string; annotation: string }> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  const envBlock = vault.envs[env];
  if (!envBlock) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  return envBlock.entries
    .filter((e) => e.annotation)
    .map((e) => ({ key: e.key, annotation: e.annotation! }));
}
