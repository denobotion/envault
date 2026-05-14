import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { formatVault } from '../format';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-format-'));
}

async function setupVault(tmpDir: string, envContent: string) {
  const masterKey = 'test-master-key-32-bytes-padding!';
  const keystorePath = path.join(tmpDir, 'keystore.json');
  const vaultPath = path.join(tmpDir, 'vault.json');

  await saveKeyStore({ production: masterKey }, keystorePath);

  const ciphertext = await encryptToString(envContent, masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: {
        ciphertext,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return { vaultPath, keystorePath, masterKey };
}

describe('formatVault', () => {
  it('removes blank lines when stripBlanks is true', async () => {
    const tmpDir = makeTmpDir();
    const content = 'FOO=bar\n\nBAZ=qux\n\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await formatVault('production', { vaultPath, keystorePath, stripBlanks: true });

    expect(result.blankLinesRemoved).toBeGreaterThan(0);
    expect(result.environment).toBe('production');
  });

  it('sorts keys alphabetically when sort is true', async () => {
    const tmpDir = makeTmpDir();
    const content = 'ZOO=1\nAPP=2\nMID=3\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await formatVault('production', { vaultPath, keystorePath, sort: true });

    expect(result.keysReordered).toBe(3);
  });

  it('throws if environment does not exist', async () => {
    const tmpDir = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmpDir, 'FOO=bar\n');

    await expect(
      formatVault('staging', { vaultPath, keystorePath })
    ).rejects.toThrow('Environment "staging" not found');
  });

  it('preserves content when no options are set', async () => {
    const tmpDir = makeTmpDir();
    const content = 'FOO=bar\nBAZ=qux\n';
    const { vaultPath, keystorePath } = await setupVault(tmpDir, content);

    const result = await formatVault('production', { vaultPath, keystorePath });

    expect(result.blankLinesRemoved).toBe(0);
    expect(result.keysReordered).toBe(0);
  });
});
