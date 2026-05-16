import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { patchVault } from '../patch';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-patch-'));
}

async function setupVault(dir: string, masterKey: string) {
  const vaultPath = path.join(dir, 'test.vault');
  const enc = await encryptToString('original_value', masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: {
        entries: { EXISTING_KEY: enc },
      },
    },
  });
  return vaultPath;
}

describe('patchVault', () => {
  let tmpDir: string;
  let masterKey: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds a new key to the environment', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const result = await patchVault(vaultPath, 'production', [{ key: 'NEW_KEY', value: 'new_val' }], masterKey);
    expect(result.added).toContain('NEW_KEY');
    expect(result.updated).toHaveLength(0);
  });

  it('updates an existing key', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const result = await patchVault(vaultPath, 'production', [{ key: 'EXISTING_KEY', value: 'updated' }], masterKey);
    expect(result.updated).toContain('EXISTING_KEY');
    expect(result.added).toHaveLength(0);
  });

  it('skips existing keys when overwrite is false', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const result = await patchVault(vaultPath, 'production', [{ key: 'EXISTING_KEY', value: 'nope' }], masterKey, { overwrite: false });
    expect(result.skipped).toContain('EXISTING_KEY');
  });

  it('does not write to disk on dryRun', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const before = fs.readFileSync(vaultPath, 'utf-8');
    await patchVault(vaultPath, 'production', [{ key: 'DRY_KEY', value: 'dry' }], masterKey, { dryRun: true });
    const after = fs.readFileSync(vaultPath, 'utf-8');
    expect(before).toBe(after);
  });

  it('throws when environment does not exist', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    await expect(
      patchVault(vaultPath, 'staging', [{ key: 'X', value: 'y' }], masterKey)
    ).rejects.toThrow('Environment "staging" not found');
  });
});
