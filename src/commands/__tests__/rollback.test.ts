import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rollback } from '../rollback';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveHistory } from '../history';

const MASTER_KEY = 'test-master-key-for-rollback-1234';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-rollback-'));
}

async function setupVault(dir: string, env: string, content: string) {
  const vaultFile = path.join(dir, 'vault.json');
  const encrypted = await encryptToString(content, MASTER_KEY);
  writeVaultFile(vaultFile, {
    [env]: { key: 'default', data: encrypted, updatedAt: new Date().toISOString() },
  });
  return { vaultFile, encrypted };
}

describe('rollback', () => {
  it('throws if environment does not exist', async () => {
    const dir = await makeTmpDir();
    const vaultFile = path.join(dir, 'vault.json');
    writeVaultFile(vaultFile, {});
    await expect(
      rollback(MASTER_KEY, { env: 'missing', vaultPath: vaultFile })
    ).rejects.toThrow('not found in vault');
  });

  it('throws if no prior history exists', async () => {
    const dir = await makeTmpDir();
    const { vaultFile } = await setupVault(dir, 'dev', 'KEY=val');
    const historyFile = vaultFile.replace('vault.json', 'history.json');
    fs.writeFileSync(historyFile, JSON.stringify([]));
    await expect(
      rollback(MASTER_KEY, { env: 'dev', vaultPath: vaultFile })
    ).rejects.toThrow('No previous version');
  });

  it('throws if steps exceed available history', async () => {
    const dir = await makeTmpDir();
    const { vaultFile, encrypted } = await setupVault(dir, 'dev', 'KEY=val');
    const historyFile = vaultFile.replace('vault.json', 'history.json');
    fs.writeFileSync(
      historyFile,
      JSON.stringify([{ env: 'dev', snapshot: encrypted, recordedAt: new Date().toISOString() }])
    );
    await expect(
      rollback(MASTER_KEY, { env: 'dev', vaultPath: vaultFile, steps: 5 })
    ).rejects.toThrow('Cannot roll back');
  });

  it('rolls back to previous snapshot successfully', async () => {
    const dir = await makeTmpDir();
    const { vaultFile } = await setupVault(dir, 'dev', 'KEY=new');
    const oldEncrypted = await encryptToString('KEY=old', MASTER_KEY);
    const newEncrypted = await encryptToString('KEY=new', MASTER_KEY);
    const historyFile = vaultFile.replace('vault.json', 'history.json');
    const now = new Date().toISOString();
    fs.writeFileSync(
      historyFile,
      JSON.stringify([
        { env: 'dev', snapshot: oldEncrypted, recordedAt: now },
        { env: 'dev', snapshot: newEncrypted, recordedAt: now },
      ])
    );
    const result = await rollback(MASTER_KEY, { env: 'dev', vaultPath: vaultFile });
    expect(result.env).toBe('dev');
    expect(result.keyCount).toBe(1);
    expect(result.restoredAt).toBeTruthy();
  });
});
