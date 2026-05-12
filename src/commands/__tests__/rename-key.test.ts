import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { renameKey } from '../rename-key';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

async function makeTmpDir(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-renamekey-'));
  return dir;
}

async function setupVault(dir: string, env: string, entries: Record<string, string>) {
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    encrypted[k] = await encryptToString(v, MASTER_KEY);
  }
  const vaultPath = path.join(dir, `${env}.vault`);
  writeVaultFile(vaultPath, {
    env,
    entries: encrypted,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return vaultPath;
}

describe('renameKey', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renames an existing key successfully', async () => {
    await setupVault(tmpDir, 'production', { DB_HOST: 'localhost', API_KEY: 'secret' });
    const result = await renameKey('production', 'DB_HOST', 'DATABASE_HOST', MASTER_KEY, { vaultPath: tmpDir });
    expect(result.renamed).toBe(true);
    expect(result.oldKey).toBe('DB_HOST');
    expect(result.newKey).toBe('DATABASE_HOST');
  });

  it('throws if old key does not exist', async () => {
    await setupVault(tmpDir, 'production', { API_KEY: 'secret' });
    await expect(
      renameKey('production', 'MISSING_KEY', 'NEW_KEY', MASTER_KEY, { vaultPath: tmpDir })
    ).rejects.toThrow('Key "MISSING_KEY" not found');
  });

  it('throws if new key already exists', async () => {
    await setupVault(tmpDir, 'production', { DB_HOST: 'localhost', API_KEY: 'secret' });
    await expect(
      renameKey('production', 'DB_HOST', 'API_KEY', MASTER_KEY, { vaultPath: tmpDir })
    ).rejects.toThrow('Key "API_KEY" already exists');
  });

  it('throws if old and new key are the same', async () => {
    await setupVault(tmpDir, 'production', { DB_HOST: 'localhost' });
    await expect(
      renameKey('production', 'DB_HOST', 'DB_HOST', MASTER_KEY, { vaultPath: tmpDir })
    ).rejects.toThrow('must be different');
  });

  it('throws if new key name contains invalid characters', async () => {
    await setupVault(tmpDir, 'production', { DB_HOST: 'localhost' });
    await expect(
      renameKey('production', 'DB_HOST', 'DB-HOST', MASTER_KEY, { vaultPath: tmpDir })
    ).rejects.toThrow('alphanumeric characters and underscores');
  });

  it('preserves other keys when renaming', async () => {
    const vaultPath = await setupVault(tmpDir, 'staging', { FOO: 'bar', BAZ: 'qux' });
    await renameKey('staging', 'FOO', 'FOO_RENAMED', MASTER_KEY, { vaultPath: tmpDir });
    const raw = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
    expect(Object.keys(raw.entries)).toContain('FOO_RENAMED');
    expect(Object.keys(raw.entries)).toContain('BAZ');
    expect(Object.keys(raw.entries)).not.toContain('FOO');
  });
});
