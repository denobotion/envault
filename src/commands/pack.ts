import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { resolveVaultPath, parseVaultFile } from '../vault';

export interface PackOptions {
  vaultDir?: string;
  output?: string;
  environments?: string[];
}

export interface PackResult {
  outputPath: string;
  environments: string[];
  entryCount: number;
  sizeBytes: number;
}

export async function packVault(
  masterKey: string,
  options: PackOptions = {}
): Promise<PackResult> {
  const vaultDir = options.vaultDir ?? process.cwd();
  const outputPath = options.output ?? path.join(vaultDir, 'vault.pack');

  const vaultPath = resolveVaultPath(vaultDir);
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault not found at: ${vaultPath}`);
  }

  const vault = parseVaultFile(vaultPath);
  const allEnvs = Object.keys(vault.environments ?? {});
  const envsToPack = options.environments?.length
    ? options.environments.filter((e) => allEnvs.includes(e))
    : allEnvs;

  if (envsToPack.length === 0) {
    throw new Error('No matching environments found to pack.');
  }

  const subset: Record<string, unknown> = {};
  let entryCount = 0;
  for (const env of envsToPack) {
    subset[env] = vault.environments[env];
    entryCount += Object.keys(vault.environments[env] ?? {}).length;
  }

  const payload = JSON.stringify({
    version: vault.version ?? 1,
    packedAt: new Date().toISOString(),
    environments: subset,
  });

  const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'));
  fs.writeFileSync(outputPath, compressed);

  return {
    outputPath,
    environments: envsToPack,
    entryCount,
    sizeBytes: compressed.byteLength,
  };
}

export async function unpackVault(
  packFile: string,
  targetDir?: string
): Promise<{ environments: string[]; entryCount: number }> {
  if (!fs.existsSync(packFile)) {
    throw new Error(`Pack file not found: ${packFile}`);
  }

  const compressed = fs.readFileSync(packFile);
  const raw = zlib.gunzipSync(compressed).toString('utf8');
  const data = JSON.parse(raw) as {
    version: number;
    environments: Record<string, Record<string, string>>;
  };

  const dir = targetDir ?? process.cwd();
  const vaultPath = resolveVaultPath(dir);

  let existing: ReturnType<typeof parseVaultFile>;
  if (fs.existsSync(vaultPath)) {
    existing = parseVaultFile(vaultPath);
  } else {
    existing = { version: data.version, environments: {} };
  }

  let entryCount = 0;
  for (const [env, entries] of Object.entries(data.environments)) {
    existing.environments[env] = {
      ...(existing.environments[env] ?? {}),
      ...entries,
    };
    entryCount += Object.keys(entries).length;
  }

  const { writeVaultFile } = await import('../vault');
  writeVaultFile(vaultPath, existing);

  return { environments: Object.keys(data.environments), entryCount };
}
