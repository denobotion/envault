import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createSnapshot,
  restoreSnapshot,
  listSnapshots,
  resolveSnapshotPath,
} from '../snapshot';
import { writeVaultFile, resolveVaultPath } from '../../vault';
import { saveKeyStore } from '../../keys';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-32-bytes-padding!';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-snapshot-'));
}

function setupVault(vaultDir: string, keystorePath: string, env: string) {
  saveKeyStore(keystorePath, { [env]: MASTER_KEY });
  const vaultPath = resolveVaultPath(vaultDir, env);
  writeVaultFile(vaultPath, {
    version: 1,
    environment: env,
    entries: {
      API_KEY: encryptToString('secret123', MASTER_KEY),
      DB_URL: encryptToString('postgres://localhost/db', MASTER_KEY),
    },
  });
}

describe('snapshot', () => {
  let tmpDir: string;
  let vaultDir: string;
  let keystorePath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vaultDir = tmpDir;
    keystorePath = path.join(tmpDir, 'keystore.json');
    setupVault(vaultDir, keystorePath, 'production');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a snapshot with the given label', async () => {
    const snap = await createSnapshot('production', 'v1.0', keystorePath, vaultDir);
    expect(snap.label).toBe('v1.0');
    expect(snap.entries['API_KEY']).toBe('secret123');
    expect(snap.entries['DB_URL']).toBe('postgres://localhost/db');
    expect(snap.timestamp).toBeDefined();
  });

  it('persists snapshot to disk', async () => {
    await createSnapshot('production', 'v1.0', keystorePath, vaultDir);
    const vaultPath = resolveVaultPath(vaultDir, 'production');
    const snapshotPath = resolveSnapshotPath(vaultPath);
    expect(fs.existsSync(snapshotPath)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('v1.0');
  });

  it('lists snapshots', async () => {
    await createSnapshot('production', 'v1.0', keystorePath, vaultDir);
    await createSnapshot('production', 'v1.1', keystorePath, vaultDir);
    const snaps = listSnapshots('production', vaultDir);
    expect(snaps).toHaveLength(2);
    expect(snaps.map((s) => s.label)).toEqual(['v1.0', 'v1.1']);
  });

  it('restores a snapshot, re-encrypting entries', async () => {
    await createSnapshot('production', 'v1.0', keystorePath, vaultDir);

    const vaultPath = resolveVaultPath(vaultDir, 'production');
    writeVaultFile(vaultPath, {
      version: 1,
      environment: 'production',
      entries: {
        API_KEY: encryptToString('changed', MASTER_KEY),
      },
    });

    await restoreSnapshot('production', 'v1.0', keystorePath, vaultDir);
    const { decryptFromString } = await import('../../crypto');
    const { parseVaultFile } = await import('../../vault');
    const vault = parseVaultFile(vaultPath);
    expect(decryptFromString(vault.entries['API_KEY'], MASTER_KEY)).toBe('secret123');
    expect(decryptFromString(vault.entries['DB_URL'], MASTER_KEY)).toBe('postgres://localhost/db');
  });

  it('throws when restoring a non-existent snapshot label', async () => {
    await expect(
      restoreSnapshot('production', 'nonexistent', keystorePath, vaultDir)
    ).rejects.toThrow('Snapshot not found: nonexistent');
  });

  it('throws when no key exists for the environment', async () => {
    await expect(
      createSnapshot('staging', 'v1.0', keystorePath, vaultDir)
    ).rejects.toThrow('No key found for environment: staging');
  });
});
