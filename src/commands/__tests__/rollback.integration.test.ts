import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rollback } from '../rollback';
import { writeVaultFile, parseVaultFile } from '../../vault';
import { encryptToString, decryptFromString } from '../../crypto';

const MASTER_KEY = 'integration-rollback-key-9999';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-rollback-int-'));
}

describe('rollback integration', () => {
  it('restores vault data to the previous encrypted snapshot', async () => {
    const dir = await makeTmpDir();
    const vaultFile = path.join(dir, 'vault.json');
    const v1 = 'DB_HOST=localhost\nDB_PORT=5432';
    const v2 = 'DB_HOST=prod.db\nDB_PORT=5432\nDB_PASS=secret';
    const enc1 = await encryptToString(v1, MASTER_KEY);
    const enc2 = await encryptToString(v2, MASTER_KEY);

    writeVaultFile(vaultFile, {
      production: { key: 'default', data: enc2, updatedAt: new Date().toISOString() },
    });

    const historyFile = vaultFile.replace('vault.json', 'history.json');
    const now = new Date().toISOString();
    fs.writeFileSync(
      historyFile,
      JSON.stringify([
        { env: 'production', snapshot: enc1, recordedAt: now },
        { env: 'production', snapshot: enc2, recordedAt: now },
      ])
    );

    const result = await rollback(MASTER_KEY, { env: 'production', vaultPath: vaultFile });
    expect(result.keyCount).toBe(2);

    const updatedVault = parseVaultFile(vaultFile);
    const restored = await decryptFromString(updatedVault['production'].data, MASTER_KEY);
    expect(restored).toContain('DB_HOST=localhost');
    expect(restored).not.toContain('DB_PASS=secret');
  });

  it('handles multi-step rollback correctly', async () => {
    const dir = await makeTmpDir();
    const vaultFile = path.join(dir, 'vault.json');
    const versions = ['KEY=v1', 'KEY=v2', 'KEY=v3'];
    const encrypted = await Promise.all(versions.map((v) => encryptToString(v, MASTER_KEY)));

    writeVaultFile(vaultFile, {
      staging: { key: 'default', data: encrypted[2], updatedAt: new Date().toISOString() },
    });

    const historyFile = vaultFile.replace('vault.json', 'history.json');
    const now = new Date().toISOString();
    fs.writeFileSync(
      historyFile,
      JSON.stringify(
        encrypted.map((snapshot) => ({ env: 'staging', snapshot, recordedAt: now }))
      )
    );

    const result = await rollback(MASTER_KEY, { env: 'staging', vaultPath: vaultFile, steps: 2 });
    expect(result.keyCount).toBe(1);

    const updatedVault = parseVaultFile(vaultFile);
    const restored = await decryptFromString(updatedVault['staging'].data, MASTER_KEY);
    expect(restored).toBe('KEY=v1');
  });
});
