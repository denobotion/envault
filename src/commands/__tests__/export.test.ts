import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exportEnv } from '../export';
import { encryptToString } from '../../crypto';
import { writeVaultFile } from '../../vault';
import * as keystoreModule from '../../keys/keystore';

jest.mock('../../keys/keystore');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'envault-export-'));

describe('exportEnv', () => {
  const masterKey = 'test-master-key-for-export-1234';
  const envContent = 'API_KEY=secret\nDB_URL=postgres://localhost/db';

  beforeEach(() => {
    jest.resetAllMocks();
    (keystoreModule.getKey as jest.Mock).mockResolvedValue(masterKey);
  });

  it('should decrypt and return env content', async () => {
    const dir = tmpDir();
    const vaultPath = path.join(dir, '.envault');
    const ciphertext = await encryptToString(envContent, masterKey);

    writeVaultFile(vaultPath, {
      version: 1,
      defaultEnv: 'default',
      entries: {
        default: { keyId: 'key-1', ciphertext },
      },
    });

    const result = await exportEnv(vaultPath, { env: 'default', keyId: 'key-1' });
    expect(result).toBe(envContent);
  });

  it('should write output file when output option is provided', async () => {
    const dir = tmpDir();
    const vaultPath = path.join(dir, '.envault');
    const outPath = path.join(dir, '.env');
    const ciphertext = await encryptToString(envContent, masterKey);

    writeVaultFile(vaultPath, {
      version: 1,
      defaultEnv: 'default',
      entries: { default: { keyId: 'key-1', ciphertext } },
    });

    await exportEnv(vaultPath, { env: 'default', keyId: 'key-1', output: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.readFileSync(outPath, 'utf-8')).toBe(envContent);
  });

  it('should throw if vault file does not exist', async () => {
    await expect(exportEnv('/nonexistent/.envault')).rejects.toThrow('Vault file not found');
  });

  it('should throw if env entry is missing', async () => {
    const dir = tmpDir();
    const vaultPath = path.join(dir, '.envault');

    writeVaultFile(vaultPath, { version: 1, defaultEnv: 'default', entries: {} });
    await expect(exportEnv(vaultPath, { env: 'staging' })).rejects.toThrow(
      'No entry found for environment: staging'
    );
  });
});
