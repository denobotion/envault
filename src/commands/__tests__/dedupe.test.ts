import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { dedupeVault } from '../dedupe';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-dedupe-'));
}

async function setupVault(
  tmpDir: string,
  envContent: string
): Promise<{ vaultPath: string; keystorePath: string }> {
  const masterKey = 'dedupe-test-master-key-32chars!!!';
  const vaultPath = path.join(tmpDir, 'vault.json');
  const keystorePath = path.join(tmpDir, 'keystore.json');

  const encrypted = await encryptToString(envContent, masterKey);

  writeVaultFile(vaultPath, {
    version: 1,
    envs: {
      test: {
        encrypted,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });

  saveKeyStore(keystorePath, { test: masterKey });

  return { vaultPath, keystorePath };
}

describe('dedupeVault', () => {
  it('removes duplicate keys, keeping last occurrence', async () => {
    const tmpDir = makeTmpDir();
    const content = 'FOO=first\nBAR=hello\nFOO=second\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await dedupeVault('test', keystorePath, vaultPath);

    expect(result.removed).toContain('FOO');
    expect(result.removed).toHaveLength(1);
    expect(result.kept).toBe(2);
  });

  it('returns empty removed array when no duplicates exist', async () => {
    const tmpDir = makeTmpDir();
    const content = 'FOO=one\nBAR=two\nBAZ=three\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await dedupeVault('test', keystorePath, vaultPath);

    expect(result.removed).toHaveLength(0);
    expect(result.kept).toBe(3);
  });

  it('preserves comment lines without treating them as duplicates', async () => {
    const tmpDir = makeTmpDir();
    const content = '# comment\nFOO=bar\n# another comment\nFOO=baz\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await dedupeVault('test', keystorePath, vaultPath);

    expect(result.removed).toContain('FOO');
    expect(result.removed).toHaveLength(1);
  });

  it('throws if environment does not exist', async () => {
    const tmpDir = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmpDir, 'FOO=bar\n');

    await expect(
      dedupeVault('nonexistent', keystorePath, vaultPath)
    ).rejects.toThrow('Environment "nonexistent" not found');
  });

  it('handles multiple duplicates of the same key', async () => {
    const tmpDir = makeTmpDir();
    const content = 'KEY=a\nKEY=b\nKEY=c\nOTHER=x\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await dedupeVault('test', keystorePath, vaultPath);

    expect(result.removed.filter((k) => k === 'KEY')).toHaveLength(2);
    expect(result.kept).toBe(2);
  });
});
