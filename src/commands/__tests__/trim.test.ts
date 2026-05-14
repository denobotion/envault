import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { trimEnvironment, trimKeys } from '../trim';
import { writeVaultFile } from '../../vault/vault';
import { saveKeyStore } from '../../keys/keystore';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto/encrypt';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-trim-'));
}

async function setupVault(tmpDir: string, masterKey: string) {
  const vaultPath = path.join(tmpDir, 'vault.json');
  const encEmpty = await encryptToString('', masterKey);
  const encWhitespace = await encryptToString('   ', masterKey);
  const encValue = await encryptToString('hello', masterKey);

  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      test: {
        EMPTY_KEY: encEmpty,
        WHITESPACE_KEY: encWhitespace,
        VALID_KEY: encValue,
      },
    },
  });

  return vaultPath;
}

describe('trimEnvironment', () => {
  let tmpDir: string;
  let masterKey: string;
  let vaultPath: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
    vaultPath = await setupVault(tmpDir, masterKey);

    const keystorePath = path.join(tmpDir, 'keystore.json');
    jest.spyOn(require('../../keys/keystore'), 'loadKeyStore').mockResolvedValue({
      keys: { test: masterKey },
    });
    jest.spyOn(require('../../keys/keystore'), 'getKey').mockReturnValue(masterKey);
    jest.spyOn(require('../../vault/vault'), 'resolveVaultPath').mockReturnValue(vaultPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('removes keys with empty or whitespace-only values', async () => {
    const result = await trimEnvironment('test', vaultPath);
    expect(result.removedKeys).toContain('EMPTY_KEY');
    expect(result.removedKeys).toContain('WHITESPACE_KEY');
    expect(result.removedKeys).not.toContain('VALID_KEY');
    expect(result.remainingCount).toBe(1);
  });

  it('throws if environment does not exist', async () => {
    await expect(trimEnvironment('nonexistent', vaultPath)).rejects.toThrow(
      'Environment "nonexistent" not found'
    );
  });
});

describe('trimKeys', () => {
  let tmpDir: string;
  let masterKey: string;
  let vaultPath: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
    vaultPath = await setupVault(tmpDir, masterKey);
    jest.spyOn(require('../../vault/vault'), 'resolveVaultPath').mockReturnValue(vaultPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('removes specified keys from the environment', async () => {
    const result = await trimKeys('test', ['EMPTY_KEY', 'VALID_KEY'], vaultPath);
    expect(result.removedKeys).toEqual(['EMPTY_KEY', 'VALID_KEY']);
    expect(result.remainingCount).toBe(1);
  });

  it('ignores keys that do not exist', async () => {
    const result = await trimKeys('test', ['NONEXISTENT'], vaultPath);
    expect(result.removedKeys).toHaveLength(0);
    expect(result.remainingCount).toBe(3);
  });

  it('throws if environment does not exist', async () => {
    await expect(trimKeys('missing', ['KEY'], vaultPath)).rejects.toThrow(
      'Environment "missing" not found'
    );
  });
});
