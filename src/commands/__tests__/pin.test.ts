import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pinKey, unpinKey, listPins, isPinned, resolvePinPath } from '../pin';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890123456';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pin-'));
}

async function setupVault(dir: string, env: string, entries: Record<string, string>) {
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    encrypted[k] = await encryptToString(v, MASTER_KEY);
  }
  writeVaultFile(path.join(dir, `${env}.vault`), { entries: encrypted, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
}

describe('pin', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    await setupVault(tmpDir, 'production', { API_KEY: 'secret', DB_PASS: 'pass123' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('pins a key successfully', async () => {
    await pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY);
    expect(isPinned(tmpDir, 'production', 'API_KEY')).toBe(true);
  });

  it('throws if key does not exist in vault', async () => {
    await expect(pinKey(tmpDir, 'production', 'MISSING_KEY', MASTER_KEY)).rejects.toThrow(
      'Key "MISSING_KEY" not found'
    );
  });

  it('throws if key is already pinned', async () => {
    await pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY);
    await expect(pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY)).rejects.toThrow(
      'already pinned'
    );
  });

  it('unpins a pinned key', async () => {
    await pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY);
    await unpinKey(tmpDir, 'production', 'API_KEY');
    expect(isPinned(tmpDir, 'production', 'API_KEY')).toBe(false);
  });

  it('throws when unpinning a key that is not pinned', async () => {
    await expect(unpinKey(tmpDir, 'production', 'DB_PASS')).rejects.toThrow('not pinned');
  });

  it('lists all pins', async () => {
    await pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY);
    await pinKey(tmpDir, 'production', 'DB_PASS', MASTER_KEY);
    const pins = listPins(tmpDir);
    expect(pins).toHaveLength(2);
    expect(pins.map((p) => p.key)).toEqual(expect.arrayContaining(['API_KEY', 'DB_PASS']));
  });

  it('returns empty list when no pins file exists', () => {
    expect(listPins(tmpDir)).toEqual([]);
  });

  it('stores pinnedAt timestamp', async () => {
    const before = new Date().toISOString();
    await pinKey(tmpDir, 'production', 'API_KEY', MASTER_KEY);
    const pins = listPins(tmpDir);
    expect(pins[0].pinnedAt >= before).toBe(true);
  });
});
