import * as fs from 'fs';
import * as path from 'path';
import { encryptToString } from '../crypto';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';

export interface EncryptFileOptions {
  vaultPath?: string;
  env?: string;
  outputKey?: string;
}

export interface EncryptFileResult {
  key: string;
  env: string;
  vaultPath: string;
}

/**
 * Reads a file from disk, encrypts its contents, and stores it as a
 * named entry inside the vault under a given key.
 */
export async function encryptFile(
  filePath: string,
  masterKey: string,
  options: EncryptFileOptions = {}
): Promise<EncryptFileResult> {
  const resolvedFile = path.resolve(filePath);

  if (!fs.existsSync(resolvedFile)) {
    throw new Error(`File not found: ${resolvedFile}`);
  }

  const rawContent = fs.readFileSync(resolvedFile, 'utf-8');

  if (!rawContent.trim()) {
    throw new Error(`File is empty: ${resolvedFile}`);
  }

  const env = options.env ?? 'default';
  const outputKey = options.outputKey ?? path.basename(filePath);

  const vaultFilePath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultFilePath);

  if (!vault[env]) {
    vault[env] = {};
  }

  const encrypted = await encryptToString(rawContent, masterKey);
  vault[env][outputKey] = encrypted;

  writeVaultFile(vaultFilePath, vault);

  return { key: outputKey, env, vaultPath: vaultFilePath };
}

/**
 * Reads an encrypted entry from the vault, decrypts it, and writes the
 * result to the specified output file path.
 */
export async function decryptFile(
  outputPath: string,
  masterKey: string,
  options: EncryptFileOptions & { key: string } = { key: '' }
): Promise<void> {
  const { decryptFromString } = await import('../crypto');

  const env = options.env ?? 'default';
  const vaultFilePath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultFilePath);

  if (!vault[env] || !vault[env][options.key]) {
    throw new Error(`Key "${options.key}" not found in env "${env}"`);
  }

  const decrypted = await decryptFromString(vault[env][options.key], masterKey);
  const resolvedOutput = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, decrypted, 'utf-8');
}
