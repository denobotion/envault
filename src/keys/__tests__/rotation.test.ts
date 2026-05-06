import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { rotateKey, listKeys } from '../rotation';
import { generateMasterKey } from '../masterkey';
import { addKey, saveKeyStore, loadKeyStore } from '../keystore';
import { encryptToString } from '../../crypto';
import { writeVaultFile } from '../../vault';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envault-rotation-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function setupKeystore(keyId: string, masterKey: string) {
  const keystorePath = path.join(tmpDir, 'keystore.json');
  const store = addKey({ keys: {} }, keyId, masterKey);
  await saveKeyStore(keystorePath, store);
  return keystorePath;
}

async function setupVault(vaultPath: string, masterKey: string) {
  const plaintext = 'API_KEY=secret123\nDB_URL=postgres://localhost/db';
  const ciphertext = await encryptToString(plaintext, masterKey);
  await writeVaultFile(vaultPath, { ciphertext, keyId: 'key_old', version: 1 });
}

test('rotateKey re-encrypts vault with new key', async () => {
  const oldKey = generateMasterKey();
  const oldKeyId = 'key_old';
  const keystorePath = await setupKeystore(oldKeyId, oldKey);
  const vaultPath = path.join(tmpDir, '.env.vault');
  await setupVault(vaultPath, oldKey);

  const result = await rotateKey(oldKeyId, [vaultPath], keystorePath);

  expect(result.oldKeyId).toBe(oldKeyId);
  expect(result.newKeyId).toMatch(/^key_\d+$/);
  expect(result.reEncryptedFiles).toContain(vaultPath);

  const store = await loadKeyStore(keystorePath);
  expect(store.keys[result.newKeyId]).toBeDefined();
});

test('rotateKey throws if old key not found', async () => {
  const keystorePath = path.join(tmpDir, 'keystore.json');
  await saveKeyStore(keystorePath, { keys: {} });

  await expect(rotateKey('nonexistent', [], keystorePath)).rejects.toThrow('Key not found');
});

test('listKeys returns all key ids', async () => {
  const keystorePath = path.join(tmpDir, 'keystore.json');
  let store = { keys: {} };
  store = addKey(store, 'key_1', generateMasterKey());
  store = addKey(store, 'key_2', generateMasterKey());
  await saveKeyStore(keystorePath, store);

  const keys = await listKeys(keystorePath);
  const ids = keys.map((k) => k.id);
  expect(ids).toContain('key_1');
  expect(ids).toContain('key_2');
});
