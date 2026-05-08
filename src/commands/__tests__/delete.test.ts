import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { deleteKey } from '../delete';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-delete-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupVault(env: string, entries: Record<string, string>, masterKey: string) {
  const vaultPath = path.join(tmpDir, '.envault');
  const keystorePath = path.join(tmpDir, 'keystore.json');

  const encrypted = await encryptToString(JSON.stringify(entries), masterKey);
  writeVaultFile(vaultPath, { [env]: encrypted });
  await saveKeyStore({ [env]: masterKey }, keystorePath);

  return { vaultPath, keystorePath };
}

describe('deleteKey', () => {
  it('deletes an existing key from the vault', async () => {
    const { vaultPath, keystorePath } = await setupVault(
      'development',
      { API_KEY: 'secret', DB_URL: 'postgres://localhost' },
      'master-key-abc123'
    );

    const result = await deleteKey({
      env: 'development',
      key: 'API_KEY',
      vaultPath,
      keystorePath,
    });

    expect(result.deleted).toBe(true);
    expect(result.key).toBe('API_KEY');
    expect(result.env).toBe('development');
  });

  it('returns deleted: false when key does not exist', async () => {
    const { vaultPath, keystorePath } = await setupVault(
      'development',
      { DB_URL: 'postgres://localhost' },
      'master-key-abc123'
    );

    const result = await deleteKey({
      env: 'development',
      key: 'NONEXISTENT_KEY',
      vaultPath,
      keystorePath,
    });

    expect(result.deleted).toBe(false);
  });

  it('throws if vault file does not exist', async () => {
    await expect(
      deleteKey({
        env: 'development',
        key: 'API_KEY',
        vaultPath: path.join(tmpDir, 'missing.envault'),
        keystorePath: path.join(tmpDir, 'keystore.json'),
      })
    ).rejects.toThrow('Vault file not found');
  });

  it('throws if environment not found in vault', async () => {
    const { vaultPath, keystorePath } = await setupVault(
      'development',
      { API_KEY: 'secret' },
      'master-key-abc123'
    );

    await expect(
      deleteKey({ env: 'staging', key: 'API_KEY', vaultPath, keystorePath })
    ).rejects.toThrow("Environment 'staging' not found in vault");
  });
});
