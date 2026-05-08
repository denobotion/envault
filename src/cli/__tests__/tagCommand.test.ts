import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerTagCommands } from '../tagCommand';
import { writeVaultFile } from '../../vault/vault';

let tmpDir: string;

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerTagCommands(program);
  return program;
}

function makeVault(envs: Record<string, object>) {
  const vaultPath = path.join(tmpDir, '.envault');
  writeVaultFile(vaultPath, { environments: envs });
  return vaultPath;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-tagcmd-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('tag add', () => {
  it('prints confirmation after adding a tag', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc' } });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['tag', 'add', 'production', 'stable', '--vault', vaultPath], { from: 'user' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('stable'));
    spy.mockRestore();
  });

  it('prints error and exits on failure', async () => {
    const vaultPath = makeVault({});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const program = makeProgram();
    await program.parseAsync(['tag', 'add', 'missing', 'stable', '--vault', vaultPath], { from: 'user' });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe('tag remove', () => {
  it('prints confirmation after removing a tag', async () => {
    const vaultPath = makeVault({ staging: { encrypted: 'xyz', tags: ['beta'] } });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['tag', 'remove', 'staging', 'beta', '--vault', vaultPath], { from: 'user' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('removed'));
    spy.mockRestore();
  });
});

describe('tag list', () => {
  it('lists environments with a given tag', async () => {
    const vaultPath = makeVault({
      production: { encrypted: 'abc', tags: ['stable'] },
      staging: { encrypted: 'def', tags: ['beta'] },
    });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['tag', 'list', 'stable', '--vault', vaultPath], { from: 'user' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('production'));
    spy.mockRestore();
  });

  it('prints message when no environments match', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc', tags: [] } });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['tag', 'list', 'ghost', '--vault', vaultPath], { from: 'user' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No environments found'));
    spy.mockRestore();
  });
});
