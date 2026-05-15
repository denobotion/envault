import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runDoctor } from '../doctor';
import { writeVaultFile } from '../../vault';
import { saveKeyStore } from '../../keys/keystore';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-doctor-'));
}

describe('runDoctor', () => {
  it('reports error when vault file is missing', async () => {
    const tmp = makeTmpDir();
    const vaultPath = path.join(tmp, 'missing.envault');
    const ksPath = path.join(tmp, 'ks.json');
    const result = await runDoctor(vaultPath, ksPath);
    const vaultCheck = result.checks.find(c => c.name === 'vault-exists')!;
    expect(vaultCheck.status).toBe('error');
    expect(result.healthy).toBe(false);
  });

  it('reports warn when keystore is missing', async () => {
    const tmp = makeTmpDir();
    const vaultPath = path.join(tmp, 'test.envault');
    const ksPath = path.join(tmp, 'missing-ks.json');
    writeVaultFile(vaultPath, { entries: {} });
    const result = await runDoctor(vaultPath, ksPath);
    const ksCheck = result.checks.find(c => c.name === 'keystore-exists')!;
    expect(ksCheck.status).toBe('warn');
  });

  it('reports ok for valid vault and keystore with no entries', async () => {
    const tmp = makeTmpDir();
    const vaultPath = path.join(tmp, 'test.envault');
    const ksPath = path.join(tmp, 'ks.json');
    writeVaultFile(vaultPath, { entries: {} });
    const masterKey = generateMasterKey();
    saveKeyStore(ksPath, { activeKey: 'default', keys: { default: masterKey } });
    const result = await runDoctor(vaultPath, ksPath);
    expect(result.checks.find(c => c.name === 'vault-exists')!.status).toBe('ok');
    expect(result.checks.find(c => c.name === 'vault-valid')!.status).toBe('ok');
    expect(result.checks.find(c => c.name === 'keystore-exists')!.status).toBe('ok');
    expect(result.checks.find(c => c.name === 'keystore-has-keys')!.status).toBe('ok');
    expect(result.healthy).toBe(true);
  });

  it('reports ok when all entries decrypt successfully', async () => {
    const tmp = makeTmpDir();
    const vaultPath = path.join(tmp, 'test.envault');
    const ksPath = path.join(tmp, 'ks.json');
    const masterKey = generateMasterKey();
    const ciphertext = await encryptToString('secret_value', masterKey);
    writeVaultFile(vaultPath, { entries: { MY_KEY: { ciphertext, createdAt: new Date().toISOString() } } });
    saveKeyStore(ksPath, { activeKey: 'default', keys: { default: masterKey } });
    const result = await runDoctor(vaultPath, ksPath);
    const decCheck = result.checks.find(c => c.name === 'entries-decryptable')!;
    expect(decCheck.status).toBe('ok');
    expect(result.healthy).toBe(true);
  });

  it('reports error when entries cannot be decrypted', async () => {
    const tmp = makeTmpDir();
    const vaultPath = path.join(tmp, 'test.envault');
    const ksPath = path.join(tmp, 'ks.json');
    const masterKey = generateMasterKey();
    const wrongKey = generateMasterKey();
    const ciphertext = await encryptToString('secret_value', wrongKey);
    writeVaultFile(vaultPath, { entries: { MY_KEY: { ciphertext, createdAt: new Date().toISOString() } } });
    saveKeyStore(ksPath, { activeKey: 'default', keys: { default: masterKey } });
    const result = await runDoctor(vaultPath, ksPath);
    const decCheck = result.checks.find(c => c.name === 'entries-decryptable')!;
    expect(decCheck.status).toBe('error');
    expect(result.healthy).toBe(false);
  });
});
