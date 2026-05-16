import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerCastCommands } from '../castCommand';
import { saveKeyStore } from '../../keys/keystore';
import { encryptToString, decryptFromString } from '../../crypto';
import { writeVaultFile, parseVaultFile, resolveVaultPath } from '../../vault/vault';

const MASTER_KEY = 'a'.repeat(64);

function makeProgram() {
  const prog = new Command();
  prog.exitOverride();
  registerCastCommands(prog);
  return prog;
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-cast-cli-'));
}

describe('registerCastCommands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    saveKeyStore({ keys: { default: MASTER_KEY } }, path.join(tmpDir, 'keystore.json'));
    writeVaultFile(path.join(tmpDir, '.envault'), {
      version: 1,
      entries: [{ key: 'DEBUG', value: encryptToString('1', MASTER_KEY) }],
    });
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true }));

  it('casts DEBUG to boolean and updates vault', async () => {
    const prog = makeProgram();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await prog.parseAsync(
      ['cast', 'DEBUG', 'boolean', '--vault-dir', tmpDir],
      { from: 'user' }
    );

    const vault = parseVaultFile(path.join(tmpDir, '.envault'));
    const entry = vault.entries.find((e) => e.key === 'DEBUG')!;
    expect(decryptFromString(entry.value, MASTER_KEY)).toBe('true');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cast "DEBUG"'));
    logSpy.mockRestore();
  });

  it('exits with error on invalid type', async () => {
    const prog = makeProgram();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(
      prog.parseAsync(['cast', 'DEBUG', 'invalid', '--vault-dir', tmpDir], { from: 'user' })
    ).rejects.toThrow('exit');

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid type'));
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exits with error when key is missing', async () => {
    const prog = makeProgram();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(
      prog.parseAsync(['cast', 'NOPE', 'string', '--vault-dir', tmpDir], { from: 'user' })
    ).rejects.toThrow('exit');

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
