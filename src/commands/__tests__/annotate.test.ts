import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { annotateKey, removeAnnotation, listAnnotations } from '../annotate';
import { writeVaultFile } from '../../vault/vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-annotate-'));
}

async function setupVault(dir: string) {
  const vaultPath = path.join(dir, 'vault.json');
  const encVal = await encryptToString('secret123', MASTER_KEY);
  const vault = {
    version: 1,
    envs: {
      production: {
        entries: [
          { key: 'API_KEY', value: encVal },
          { key: 'DB_URL', value: encVal, annotation: 'existing note' },
        ],
      },
    },
  };
  writeVaultFile(vaultPath, vault as any);
  return vaultPath;
}

describe('annotate', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    vaultPath = await setupVault(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('annotates an existing key', async () => {
    const result = await annotateKey('production', 'API_KEY', 'Primary API key', MASTER_KEY, { vaultPath });
    expect(result.annotation).toBe('Primary API key');
    const annotations = listAnnotations('production', { vaultPath });
    const found = annotations.find((a) => a.key === 'API_KEY');
    expect(found?.annotation).toBe('Primary API key');
  });

  it('overwrites an existing annotation', async () => {
    await annotateKey('production', 'DB_URL', 'Updated note', MASTER_KEY, { vaultPath });
    const annotations = listAnnotations('production', { vaultPath });
    const found = annotations.find((a) => a.key === 'DB_URL');
    expect(found?.annotation).toBe('Updated note');
  });

  it('removes an annotation', async () => {
    await removeAnnotation('production', 'DB_URL', MASTER_KEY, { vaultPath });
    const annotations = listAnnotations('production', { vaultPath });
    const found = annotations.find((a) => a.key === 'DB_URL');
    expect(found).toBeUndefined();
  });

  it('lists only annotated keys', async () => {
    const annotations = listAnnotations('production', { vaultPath });
    expect(annotations).toHaveLength(1);
    expect(annotations[0].key).toBe('DB_URL');
  });

  it('throws when environment does not exist', async () => {
    await expect(
      annotateKey('staging', 'API_KEY', 'note', MASTER_KEY, { vaultPath })
    ).rejects.toThrow('Environment "staging" not found');
  });

  it('throws when key does not exist', async () => {
    await expect(
      annotateKey('production', 'MISSING_KEY', 'note', MASTER_KEY, { vaultPath })
    ).rejects.toThrow('Key "MISSING_KEY" not found');
  });
});
