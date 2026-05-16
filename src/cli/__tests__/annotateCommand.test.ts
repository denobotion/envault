import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerAnnotateCommands } from '../annotateCommand';
import { writeVaultFile } from '../../vault/vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerAnnotateCommands(program);
  return program;
}

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-annotate-cli-'));
}

async function setupVault(dir: string) {
  const vaultPath = path.join(dir, 'vault.json');
  const encVal = await encryptToString('myvalue', MASTER_KEY);
  const vault = {
    version: 1,
    envs: {
      dev: {
        entries: [
          { key: 'TOKEN', value: encVal },
          { key: 'SECRET', value: encVal, annotation: 'old note' },
        ],
      },
    },
  };
  writeVaultFile(vaultPath, vault as any);
  return vaultPath;
}

describe('annotateCommand CLI', () => {
  let tmpDir: string;
  let vaultPath: string;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    vaultPath = await setupVault(tmpDir);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('sets an annotation via CLI', async () => {
    const program = makeProgram();
    await program.parseAsync([
      'annotate', 'set', 'dev', 'TOKEN', 'My token',
      '--vault', vaultPath,
      '--master-key', MASTER_KEY,
    ], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Annotated'));
  });

  it('removes an annotation via CLI', async () => {
    const program = makeProgram();
    await program.parseAsync([
      'annotate', 'remove', 'dev', 'SECRET',
      '--vault', vaultPath,
      '--master-key', MASTER_KEY,
    ], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed annotation'));
  });

  it('lists annotations via CLI', async () => {
    const program = makeProgram();
    await program.parseAsync([
      'annotate', 'list', 'dev',
      '--vault', vaultPath,
    ], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SECRET'));
  });

  it('shows message when no annotations exist', async () => {
    const program = makeProgram();
    // Remove the only annotation first
    await program.parseAsync([
      'annotate', 'remove', 'dev', 'SECRET',
      '--vault', vaultPath,
      '--master-key', MASTER_KEY,
    ], { from: 'user' });
    const program2 = makeProgram();
    await program2.parseAsync([
      'annotate', 'list', 'dev',
      '--vault', vaultPath,
    ], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No annotations found'));
  });
});
