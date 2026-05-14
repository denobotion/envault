import * as path from 'path';
import * as fs from 'fs';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { getKey } from '../keys/keystore';
import { decryptFromString, encryptToString } from '../crypto';

export interface ShareOptions {
  vaultPath?: string;
  keystorePath?: string;
  env: string;
  recipientKey: string;
  outputPath?: string;
}

export interface ShareResult {
  env: string;
  outputPath: string;
  keyCount: number;
}

export async function shareEnv(options: ShareOptions): Promise<ShareResult> {
  const vaultFile = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultFile);

  if (!vault.envs || !vault.envs[options.env]) {
    throw new Error(`Environment "${options.env}" not found in vault.`);
  }

  const senderKey = getKey(options.env, options.keystorePath);
  if (!senderKey) {
    throw new Error(`No key found for environment "${options.env}".`);
  }

  const encryptedData = vault.envs[options.env];
  const plaintext = await decryptFromString(encryptedData, senderKey);

  const reEncrypted = await encryptToString(plaintext, options.recipientKey);

  const outputFile = options.outputPath ?? path.join(process.cwd(), `${options.env}.shared.vault`);

  const sharedVault = {
    version: vault.version ?? 1,
    envs: {
      [options.env]: reEncrypted,
    },
  };

  writeVaultFile(outputFile, sharedVault);

  const keyCount = plaintext.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;

  return {
    env: options.env,
    outputPath: outputFile,
    keyCount,
  };
}
