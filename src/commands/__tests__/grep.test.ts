import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { grepVault } from '../grep';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

const MASTER_KEY = 'a'.repeat(64);
const KEY_NAME = 'default';

async function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-grep-'));
  const vaultPath = path.join(dir, 'vault.env.json');
  const keystorePath = path.join(dir, 'keys.json');

  saveKeyStore(keystorePath, { [KEY_NAME]: MASTER_KEY });

  const encDev = await encryptToString('DB_HOST=localhost\nDB_PORT=5432\nSECRET_KEY=abc123', MASTER_KEY);
  const encProd = await encryptToString('DB_HOST=prod.db.example.com\nDB_PORT=5432\nAPI_KEY=xyz789', MASTER_KEY);

  writeVaultFile(vaultPath, {
    version: 1,
    envs: {
      development: { encrypted: encDev, createdAt: new Date().toISOString() },
      production: { encrypted: encProd, createdAt: new Date().toISOString() },
    },
  });

  return { dir, vaultPath, keystorePath };
}

describe('grepVault', () => {
  it('finds matches by key pattern', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    const matches = await grepVault('DB_', { vaultPath, keystorePath, keyName: KEY_NAME });
    expect(matches.length).toBe(4);
    expect(matches.every(m => m.key.startsWith('DB_'))).toBe(true);
  });

  it('finds matches by value pattern', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    const matches = await grepVault('5432', { vaultPath, keystorePath, keyName: KEY_NAME });
    expect(matches.length).toBe(2);
    expect(matches.every(m => m.value === '5432')).toBe(true);
  });

  it('respects keysOnly option', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    const matches = await grepVault('key', { vaultPath, keystorePath, keyName: KEY_NAME, keysOnly: true, ignoreCase: true });
    expect(matches.every(m => /key/i.test(m.key))).toBe(true);
  });

  it('respects valuesOnly option', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    const matches = await grepVault('localhost', { vaultPath, keystorePath, keyName: KEY_NAME, valuesOnly: true });
    expect(matches.length).toBe(1);
    expect(matches[0].value).toBe('localhost');
  });

  it('returns empty array when no matches', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    const matches = await grepVault('NONEXISTENT_PATTERN_XYZ', { vaultPath, keystorePath, keyName: KEY_NAME });
    expect(matches).toEqual([]);
  });

  it('throws when master key is missing', async () => {
    const { vaultPath, keystorePath } = await makeTmpDir();
    await expect(
      grepVault('DB_HOST', { vaultPath, keystorePath, keyName: 'missing-key' })
    ).rejects.toThrow('Master key not found');
  });
});
