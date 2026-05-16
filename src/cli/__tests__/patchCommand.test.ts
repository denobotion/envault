import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerPatchCommands } from '../patchCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys';

function makeProgram() {
  const prog = new Command();
  prog.exitOverride();
  registerPatchCommands(prog);
  return prog;
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-patchcmd-'));
}

async function setupVault(dir: string, masterKey: string) {
  const vaultPath = path.join(dir, 'test.vault');
  const enc = await encryptToString('original', masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: { staging: { entries: { EXISTING: enc } } },
  });
  return vaultPath;
}

describe('registerPatchCommands', () => {
  let tmpDir: string;
  let masterKey: string;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports added keys', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const prog = makeProgram();
    await prog.parseAsync(['patch', 'staging', 'NEW_VAR=hello', '-k', masterKey, '-f', vaultPath], { from: 'user' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Added'));
  });

  it('reports updated keys', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const prog = makeProgram();
    await prog.parseAsync(['patch', 'staging', 'EXISTING=newval', '-k', masterKey, '-f', vaultPath], { from: 'user' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Updated'));
  });

  it('prints dry-run notice when --dry-run is passed', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const prog = makeProgram();
    await prog.parseAsync(['patch', 'staging', 'DRY=val', '--dry-run', '-k', masterKey, '-f', vaultPath], { from: 'user' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('dry-run'));
  });

  it('exits with error on missing environment', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const prog = makeProgram();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(
      prog.parseAsync(['patch', 'nonexistent', 'K=V', '-k', masterKey, '-f', vaultPath], { from: 'user' })
    ).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
