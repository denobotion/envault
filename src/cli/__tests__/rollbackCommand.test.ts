import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerRollbackCommands } from '../rollbackCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'rollback-cli-test-key-5678';

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerRollbackCommands(program);
  return program;
}

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-rollback-cli-'));
}

describe('registerRollbackCommands', () => {
  it('exits with error when master key is missing', async () => {
    const program = makeProgram();
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      program.parseAsync(['node', 'test', 'rollback', 'dev'])
    ).rejects.toThrow();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('master key is required'));
    exit.mockRestore();
    error.mockRestore();
  });

  it('exits with error when steps is invalid', async () => {
    const program = makeProgram();
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      program.parseAsync(['node', 'test', 'rollback', 'dev', '--key', MASTER_KEY, '--steps', '0'])
    ).rejects.toThrow();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('positive integer'));
    exit.mockRestore();
    error.mockRestore();
  });

  it('prints success after rollback', async () => {
    const dir = await makeTmpDir();
    const vaultFile = path.join(dir, 'vault.json');
    const oldEnc = await encryptToString('KEY=old', MASTER_KEY);
    const newEnc = await encryptToString('KEY=new', MASTER_KEY);
    writeVaultFile(vaultFile, {
      dev: { key: 'default', data: newEnc, updatedAt: new Date().toISOString() },
    });
    const historyFile = vaultFile.replace('vault.json', 'history.json');
    const now = new Date().toISOString();
    fs.writeFileSync(
      historyFile,
      JSON.stringify([
        { env: 'dev', snapshot: oldEnc, recordedAt: now },
        { env: 'dev', snapshot: newEnc, recordedAt: now },
      ])
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync([
      'node', 'test', 'rollback', 'dev',
      '--key', MASTER_KEY,
      '--vault', vaultFile,
    ]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Rolled back'));
    log.mockRestore();
  });
});
