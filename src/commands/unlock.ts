import * as path from 'path';
import * as fs from 'fs';
import { resolveVaultPath, parseVaultFile } from '../vault';
import { getKey } from '../keys/keystore';
import { decryptFromString } from '../crypto';

export interface UnlockOptions {
  env?: string;
  output?: string;
  keystoreDir?: string;
  vaultPath?: string;
}

export interface UnlockResult {
  env: string;
  outputPath: string;
  keyCount: number;
}

export async function unlockEnv(
  keyName: string,
  options: UnlockOptions = {}
): Promise<UnlockResult> {
  const env = options.env ?? 'default';
  const vaultFile = resolveVaultPath(options.vaultPath);

  if (!fs.existsSync(vaultFile)) {
    throw new Error(`Vault not found at ${vaultFile}`);
  }

  const vault = parseVaultFile(vaultFile);
  const entry = vault.envs[env];

  if (!entry) {
    throw new Error(`Environment "${env}" not found in vault`);
  }

  const masterKey = await getKey(keyName, options.keystoreDir);
  if (!masterKey) {
    throw new Error(`Key "${keyName}" not found in keystore`);
  }

  const decrypted = await decryptFromString(entry.encrypted, masterKey);
  const lines = decrypted.split('\n').filter(Boolean);

  const outputPath = options.output ?? path.resolve(process.cwd(), `.env.${env}`);
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');

  return {
    env,
    outputPath,
    keyCount: lines.filter(l => /^[A-Z_]+=/.test(l)).length,
  };
}
