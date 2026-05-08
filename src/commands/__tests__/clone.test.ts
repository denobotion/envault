import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { cloneEnvironment } from '../clone';
import { writeVaultFile, resolveVaultPath } from '../../vault';
import { encryptToString } from '../../crypto';
import { addKey, getKey } from '../../keys';

let tmpDir: string;
const masterKey = 'test-master-key-clone';

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-clone-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupSourceVault(env: string, entries: Record<string, string>) {
  await addKey(masterKey, { keystoreDir: tmpDir });
  const key = await getKey(masterKey, tmpDir);
  const encryptedEntries: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    encryptedEntries[k] = await encryptToString(v, key);
  }
  const vaultPath = resolveVaultPath(env, tmpDir);
  writeVaultFile(vaultPath, {
    version: 1,
    entries: encryptedEntries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

test('clones an environment to a new target', async () => {
  await setupSourceVault('production', { DB_URL: 'postgres://localhost/prod' });

  await cloneEnvironment('production', 'staging', masterKey, {
    vaultDir: tmpDir,
    keystoreDir: tmpDir,
  });

  const targetPath = resolveVaultPath('staging', tmpDir);
  expect(fs.existsSync(targetPath)).toBe(true);
});

test('throws if source environment does not exist', async () => {
  await expect(
    cloneEnvironment('nonexistent', 'staging', masterKey, {
      vaultDir: tmpDir,
      keystoreDir: tmpDir,
    })
  ).rejects.toThrow('Source environment "nonexistent" does not exist.');
});

test('throws if target environment already exists', async () => {
  await setupSourceVault('production', { KEY: 'value' });
  await setupSourceVault('staging', { KEY: 'other' });

  await expect(
    cloneEnvironment('production', 'staging', masterKey, {
      vaultDir: tmpDir,
      keystoreDir: tmpDir,
    })
  ).rejects.toThrow('Target environment "staging" already exists.');
});
