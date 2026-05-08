import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { copyEnvKey, copyAllKeys } from '../copy';
import { writeVaultFile, resolveVaultPath } from '../../vault';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envault-copy-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const masterKeyDev = 'dev-master-key-1234567890abcdef';
const masterKeyProd = 'prod-master-key-1234567890abcdef';

async function setupVault(env: string, entries: Record<string, string>, masterKey: string) {
  const vaultPath = resolveVaultPath(env, tmpDir);
  const encryptedEntries: Record<string, { value: string; updatedAt: string }> = {};
  for (const [k, v] of Object.entries(entries)) {
    encryptedEntries[k] = {
      value: await encryptToString(v, masterKey),
      updatedAt: new Date().toISOString(),
    };
  }
  await writeVaultFile(vaultPath, { entries: encryptedEntries });
}

describe('copyEnvKey', () => {
  it('copies a single key from source to target environment', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    await addKey('dev', masterKeyDev, keystorePath);
    await addKey('prod', masterKeyProd, keystorePath);
    await setupVault('dev', { DB_URL: 'postgres://localhost/dev' }, masterKeyDev);
    await setupVault('prod', {}, masterKeyProd);

    await copyEnvKey('dev', 'prod', 'DB_URL', { vaultPath: tmpDir, keystorePath });

    const { parseVaultFile } = await import('../../vault');
    const { decryptFromString } = await import('../../crypto');
    const prodVault = await parseVaultFile(resolveVaultPath('prod', tmpDir));
    expect(prodVault.entries['DB_URL']).toBeDefined();
    const decrypted = await decryptFromString(prodVault.entries['DB_URL'].value, masterKeyProd);
    expect(decrypted).toBe('postgres://localhost/dev');
  });

  it('throws if source key does not exist', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    await addKey('dev', masterKeyDev, keystorePath);
    await addKey('prod', masterKeyProd, keystorePath);
    await setupVault('dev', {}, masterKeyDev);
    await setupVault('prod', {}, masterKeyProd);

    await expect(
      copyEnvKey('dev', 'prod', 'MISSING_KEY', { vaultPath: tmpDir, keystorePath })
    ).rejects.toThrow('Key "MISSING_KEY" not found in environment "dev"');
  });

  it('throws if target master key is missing', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    await addKey('dev', masterKeyDev, keystorePath);
    await setupVault('dev', { API_KEY: 'secret' }, masterKeyDev);
    await setupVault('prod', {}, masterKeyProd);

    await expect(
      copyEnvKey('dev', 'prod', 'API_KEY', { vaultPath: tmpDir, keystorePath })
    ).rejects.toThrow('No master key found for environment "prod"');
  });
});

describe('copyAllKeys', () => {
  it('copies all keys from source to target and returns key names', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    await addKey('dev', masterKeyDev, keystorePath);
    await addKey('prod', masterKeyProd, keystorePath);
    await setupVault('dev', { DB_URL: 'postgres://dev', API_KEY: 'key123' }, masterKeyDev);
    await setupVault('prod', {}, masterKeyProd);

    const copied = await copyAllKeys('dev', 'prod', { vaultPath: tmpDir, keystorePath });
    expect(copied).toHaveLength(2);
    expect(copied).toContain('DB_URL');
    expect(copied).toContain('API_KEY');
  });
});
