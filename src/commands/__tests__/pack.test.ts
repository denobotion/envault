import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { packVault, unpackVault } from '../pack';
import { writeVaultFile } from '../../vault';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pack-'));
}

function setupVault(dir: string) {
  const vaultPath = path.join(dir, '.envault');
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: { API_KEY: 'enc-prod-key', DB_URL: 'enc-prod-db' },
      staging: { API_KEY: 'enc-stg-key' },
    },
  });
}

describe('packVault', () => {
  it('packs all environments by default', async () => {
    const dir = makeTmpDir();
    setupVault(dir);
    const result = await packVault('master-key', { vaultDir: dir });
    expect(result.environments).toEqual(expect.arrayContaining(['production', 'staging']));
    expect(result.entryCount).toBe(3);
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('packs only specified environments', async () => {
    const dir = makeTmpDir();
    setupVault(dir);
    const result = await packVault('master-key', {
      vaultDir: dir,
      environments: ['production'],
    });
    expect(result.environments).toEqual(['production']);
    expect(result.entryCount).toBe(2);
  });

  it('writes to custom output path', async () => {
    const dir = makeTmpDir();
    setupVault(dir);
    const output = path.join(dir, 'custom.pack');
    const result = await packVault('master-key', { vaultDir: dir, output });
    expect(result.outputPath).toBe(output);
    expect(fs.existsSync(output)).toBe(true);
  });

  it('throws if vault not found', async () => {
    const dir = makeTmpDir();
    await expect(packVault('key', { vaultDir: dir })).rejects.toThrow('Vault not found');
  });

  it('throws if no matching environments', async () => {
    const dir = makeTmpDir();
    setupVault(dir);
    await expect(
      packVault('key', { vaultDir: dir, environments: ['nonexistent'] })
    ).rejects.toThrow('No matching environments');
  });
});

describe('unpackVault', () => {
  it('unpacks into a new directory', async () => {
    const srcDir = makeTmpDir();
    const destDir = makeTmpDir();
    setupVault(srcDir);
    const { outputPath } = await packVault('key', { vaultDir: srcDir });
    const result = await unpackVault(outputPath, destDir);
    expect(result.environments).toEqual(expect.arrayContaining(['production', 'staging']));
    expect(result.entryCount).toBe(3);
  });

  it('merges into existing vault', async () => {
    const srcDir = makeTmpDir();
    const destDir = makeTmpDir();
    setupVault(srcDir);
    writeVaultFile(path.join(destDir, '.envault'), {
      version: 1,
      environments: { development: { LOCAL: 'enc-local' } },
    });
    const { outputPath } = await packVault('key', { vaultDir: srcDir });
    await unpackVault(outputPath, destDir);
    const { parseVaultFile, resolveVaultPath } = await import('../../vault');
    const vault = parseVaultFile(resolveVaultPath(destDir));
    expect(Object.keys(vault.environments)).toContain('development');
    expect(Object.keys(vault.environments)).toContain('production');
  });

  it('throws if pack file not found', async () => {
    await expect(unpackVault('/nonexistent/file.pack')).rejects.toThrow('Pack file not found');
  });
});
