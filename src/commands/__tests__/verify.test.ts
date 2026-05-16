import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { verifyVault } from '../verify';
import { writeVaultFile } from '../../vault';
import { saveKeyStore, addKey } from '../../keys';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys/masterkey';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-verify-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('verifyVault', () => {
  it('returns invalid when vault file does not exist', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const result = await verifyVault('production', keystorePath);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found/);
  });

  it('returns invalid when key alias is missing from keystore', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const masterKey = generateMasterKey();
    const encVal = await encryptToString('secret', masterKey);
    writeVaultFile('staging', 'default', [{ key: 'FOO', encryptedValue: encVal }]);
    saveKeyStore(keystorePath, {});
    const result = await verifyVault('staging', keystorePath);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found in keystore/);
  });

  it('returns valid when all entries decrypt successfully', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const masterKey = generateMasterKey();
    addKey(keystorePath, 'default', masterKey);
    const encVal = await encryptToString('my_secret', masterKey);
    writeVaultFile('development', 'default', [{ key: 'API_KEY', encryptedValue: encVal }]);
    const result = await verifyVault('development', keystorePath);
    expect(result.valid).toBe(true);
    expect(result.entryCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('reports errors for entries that fail decryption', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const masterKey = generateMasterKey();
    addKey(keystorePath, 'default', masterKey);
    writeVaultFile('test', 'default', [{ key: 'BAD', encryptedValue: 'not-valid-ciphertext' }]);
    const result = await verifyVault('test', keystorePath);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/BAD/);
  });

  it('reports all decryption errors when multiple entries are invalid', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const masterKey = generateMasterKey();
    addKey(keystorePath, 'default', masterKey);
    writeVaultFile('test', 'default', [
      { key: 'BAD_ONE', encryptedValue: 'not-valid-ciphertext' },
      { key: 'BAD_TWO', encryptedValue: 'also-not-valid' },
    ]);
    const result = await verifyVault('test', keystorePath);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/BAD_ONE/);
    expect(result.errors[1]).toMatch(/BAD_TWO/);
  });
});
