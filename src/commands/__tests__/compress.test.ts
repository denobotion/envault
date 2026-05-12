import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import { compressVault, decompressVault } from '../compress';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-compress-'));
}

async function setupVault(dir: string, env: string): Promise<void> {
  const encrypted = await encryptToString('SECRET=hello\nAPI_KEY=world', 'masterpassword');
  writeVaultFile(env, { env, encrypted, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, dir);
}

describe('compressVault', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a .gz file and returns size info', async () => {
    await setupVault(tmpDir, 'production');
    const result = await compressVault('production', tmpDir);

    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.compressedSize).toBeGreaterThan(0);
    expect(result.ratio).toBeDefined();
    expect(fs.existsSync(result.vaultPath + '.gz')).toBe(true);
  });

  it('creates a backup .bak file', async () => {
    await setupVault(tmpDir, 'staging');
    const result = await compressVault('staging', tmpDir);

    expect(fs.existsSync(result.vaultPath + '.bak')).toBe(true);
  });

  it('throws if vault does not exist', async () => {
    await expect(compressVault('nonexistent', tmpDir)).rejects.toThrow(
      'Vault not found for environment: nonexistent'
    );
  });
});

describe('decompressVault', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restores vault from .gz file', async () => {
    await setupVault(tmpDir, 'production');
    await compressVault('production', tmpDir);
    const result = await decompressVault('production', tmpDir);

    expect(result.size).toBeGreaterThan(0);
    expect(fs.existsSync(result.vaultPath)).toBe(true);
  });

  it('throws if compressed vault does not exist', async () => {
    await expect(decompressVault('missing', tmpDir)).rejects.toThrow(
      'Compressed vault not found for environment: missing'
    );
  });
});
