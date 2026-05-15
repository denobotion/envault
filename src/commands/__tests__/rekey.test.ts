import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { rekeyVault } from '../rekey';
import { writeVaultFile, resolveVaultPath } from '../../vault/vault';
import { saveKeyStore } from '../../keys/keystore';
import { encryptToString } from '../../crypto/encrypt';
import { decryptFromString } from '../../crypto/decrypt';
import { generateMasterKey } from '../../keys/masterkey';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-rekey-'));
}

describe('rekeyVault', () => {
  let tmpDir: string;
  let vaultPath: string;
  let keystorePath: string;
  let oldKey: string;
  let newKey: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    vaultPath = path.join(tmpDir, 'vault.json');
    keystorePath = path.join(tmpDir, 'keystore.json');
    oldKey = generateMasterKey();
    newKey = generateMasterKey();

    const encryptedVal = await encryptToString('secret_value', oldKey);

    const vault = {
      version: 1,
      environments: {
        production: [
          { key: 'API_KEY', value: encryptedVal },
        ],
      },
    };
    writeVaultFile(vaultPath, vault);

    const keystore = {
      keys: {
        old: oldKey,
        new: newKey,
      },
    };
    fs.writeFileSync(keystorePath, JSON.stringify(keystore));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rekeys all entries in the environment', async () => {
    const result = await rekeyVault('production', {
      vaultPath,
      keystorePath,
      oldKeyName: 'old',
      newKeyName: 'new',
    });

    expect(result.rekeyedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.environment).toBe('production');
  });

  it('decrypts correctly with new key after rekeying', async () => {
    await rekeyVault('production', {
      vaultPath,
      keystorePath,
      oldKeyName: 'old',
      newKeyName: 'new',
    });

    const updated = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
    const decrypted = await decryptFromString(updated.environments.production[0].value, newKey);
    expect(decrypted).toBe('secret_value');
  });

  it('throws if old key not found', async () => {
    await expect(
      rekeyVault('production', {
        vaultPath,
        keystorePath,
        oldKeyName: 'missing',
        newKeyName: 'new',
      })
    ).rejects.toThrow('Old key "missing" not found');
  });

  it('throws if environment not found', async () => {
    await expect(
      rekeyVault('staging', {
        vaultPath,
        keystorePath,
        oldKeyName: 'old',
        newKeyName: 'new',
      })
    ).rejects.toThrow('Environment "staging" not found');
  });
});
