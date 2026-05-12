import * as fs from 'fs';
import * as zlib from 'zlib';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';

export interface CompressResult {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  vaultPath: string;
}

export async function compressVault(
  env: string,
  vaultDir?: string
): Promise<CompressResult> {
  const vaultPath = resolveVaultPath(env, vaultDir);

  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault not found for environment: ${env}`);
  }

  const raw = fs.readFileSync(vaultPath);
  const originalSize = raw.length;

  const compressed = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
  const compressedSize = compressed.length;

  const backupPath = `${vaultPath}.bak`;
  fs.copyFileSync(vaultPath, backupPath);

  fs.writeFileSync(vaultPath + '.gz', compressed);

  const ratio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

  return {
    originalSize,
    compressedSize,
    ratio: Math.round(ratio * 100) / 100,
    vaultPath,
  };
}

export async function decompressVault(
  env: string,
  vaultDir?: string
): Promise<{ size: number; vaultPath: string }> {
  const vaultPath = resolveVaultPath(env, vaultDir);
  const gzPath = `${vaultPath}.gz`;

  if (!fs.existsSync(gzPath)) {
    throw new Error(`Compressed vault not found for environment: ${env}`);
  }

  const compressed = fs.readFileSync(gzPath);
  const decompressed = zlib.gunzipSync(compressed);

  fs.writeFileSync(vaultPath, decompressed);

  return {
    size: decompressed.length,
    vaultPath,
  };
}
