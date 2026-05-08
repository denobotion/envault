import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { restoreSnapshot } from '../restore';
import { writeVaultFile } from '../../vault';
import { saveSnapshots } from '../snapshot';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-restore-'));
}

async function setupFixtures(tmpDir: string) {
  const vaultFile = path.join(tmpDir, 'vault.json');
  const snapshotFile = path.join(tmpDir, 'snapshots.json');
  const keystoreFile = path.join(tmpDir, 'keystore.json');
  const masterKey = 'test-master-key-1234567890abcdef';

  await addKey('test', masterKey, keystoreFile);

  const encryptedVal = await encryptToString('secret_value', masterKey);

  const snapshots = {
    test: [
      {
        id: 'snap-001',
        timestamp: '2024-01-01T00:00:00.000Z',
        data: { MY_SECRET: encryptedVal },
      },
    ],
  };
  saveSnapshots(snapshotFile, snapshots);

  return { vaultFile, snapshotFile, keystoreFile, masterKey, encryptedVal };
}

describe('restoreSnapshot', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restores keys from a valid snapshot', async () => {
    const { vaultFile, snapshotFile, keystoreFile } = await setupFixtures(tmpDir);

    const result = await restoreSnapshot('test', 'snap-001', {
      vaultPath: vaultFile,
      snapshotDir: path.dirname(snapshotFile),
      keystorePath: keystoreFile,
    });

    expect(result.restoredKeys).toBe(1);
    expect(result.snapshotTimestamp).toBe('2024-01-01T00:00:00.000Z');

    const raw = JSON.parse(fs.readFileSync(vaultFile, 'utf-8'));
    expect(raw.test.encrypted).toHaveProperty('MY_SECRET');
  });

  it('throws if snapshot id does not exist', async () => {
    const { vaultFile, snapshotFile, keystoreFile } = await setupFixtures(tmpDir);

    await expect(
      restoreSnapshot('test', 'snap-999', {
        vaultPath: vaultFile,
        snapshotDir: path.dirname(snapshotFile),
        keystorePath: keystoreFile,
      })
    ).rejects.toThrow('Snapshot "snap-999" not found');
  });

  it('throws if environment has no snapshots', async () => {
    const { vaultFile, snapshotFile, keystoreFile } = await setupFixtures(tmpDir);

    await expect(
      restoreSnapshot('staging', 'snap-001', {
        vaultPath: vaultFile,
        snapshotDir: path.dirname(snapshotFile),
        keystorePath: keystoreFile,
      })
    ).rejects.toThrow('No snapshots found for environment "staging"');
  });

  it('throws if snapshot file does not exist', async () => {
    await expect(
      restoreSnapshot('test', 'snap-001', {
        vaultPath: path.join(tmpDir, 'vault.json'),
        snapshotDir: tmpDir,
        keystorePath: path.join(tmpDir, 'keystore.json'),
      })
    ).rejects.toThrow('No snapshot file found');
  });
});
