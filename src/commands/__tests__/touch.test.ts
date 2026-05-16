import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { touchKeys } from '../touch';
import { writeVaultFile, parseVaultFile } from '../../vault';
import { addKey } from '../../keys';
import { encryptToString, decryptFromString } from '../../crypto';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-touch-'));
}

async function setupVault(tmpDir: string, masterKey: string) {
  const vaultPath = path.join(tmpDir, 'vault.json');
  const keystorePath = path.join(tmpDir, 'keystore.json');
  await addKey('main', masterKey, keystorePath);
  writeVaultFile(vaultPath, {});
  return { vaultPath, keystorePath };
}

describe('touchKeys', () => {
  const MASTER_KEY = 'a'.repeat(64);

  it('creates new keys with empty encrypted value', async () => {
    const tmp = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmp, MASTER_KEY);

    const result = await touchKeys(['NEW_KEY', 'ANOTHER_KEY'], 'main', {
      vaultPath,
      keystorePath,
    });

    expect(result.created).toEqual(['NEW_KEY', 'ANOTHER_KEY']);
    expect(result.skipped).toEqual([]);

    const vault = parseVaultFile(vaultPath);
    expect(vault['default']).toHaveProperty('NEW_KEY');
    expect(vault['default']).toHaveProperty('ANOTHER_KEY');

    const decrypted = await decryptFromString(vault['default']['NEW_KEY'], MASTER_KEY);
    expect(decrypted).toBe('');
  });

  it('skips keys that already exist', async () => {
    const tmp = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmp, MASTER_KEY);

    const existing = await encryptToString('original_value', MASTER_KEY);
    writeVaultFile(vaultPath, { default: { EXISTING_KEY: existing } });

    const result = await touchKeys(['EXISTING_KEY', 'BRAND_NEW'], 'main', {
      vaultPath,
      keystorePath,
    });

    expect(result.created).toEqual(['BRAND_NEW']);
    expect(result.skipped).toEqual(['EXISTING_KEY']);

    const vault = parseVaultFile(vaultPath);
    const decrypted = await decryptFromString(vault['default']['EXISTING_KEY'], MASTER_KEY);
    expect(decrypted).toBe('original_value');
  });

  it('throws on invalid key name', async () => {
    const tmp = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmp, MASTER_KEY);

    await expect(
      touchKeys(['invalid-key!'], 'main', { vaultPath, keystorePath })
    ).rejects.toThrow('Invalid key name');
  });

  it('throws when no keys provided', async () => {
    const tmp = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmp, MASTER_KEY);

    await expect(
      touchKeys([], 'main', { vaultPath, keystorePath })
    ).rejects.toThrow('At least one key name must be provided');
  });

  it('throws when master key not found', async () => {
    const tmp = makeTmpDir();
    const { vaultPath, keystorePath } = await setupVault(tmp, MASTER_KEY);

    await expect(
      touchKeys(['SOME_KEY'], 'nonexistent', { vaultPath, keystorePath })
    ).rejects.toThrow('Master key "nonexistent" not found');
  });
});
