import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerValidateCommands } from '../validateCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerValidateCommands(program);
  return program;
}

async function makeTmpVault() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-valcmd-'));
  const vaultPath = path.join(tmpDir, 'vault.json');
  const val = await encryptToString('secret', MASTER_KEY);
  writeVaultFile(vaultPath, {
    version: 1,
    envs: {
      staging: {
        values: { SECRET: val },
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });
  return { tmpDir, vaultPath };
}

describe('registerValidateCommands', () => {
  let tmpDir: string;
  let vaultPath: string;
  let consoleSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    ({ tmpDir, vaultPath } = await makeTmpVault());
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('validates a specific env successfully', async () => {
    const program = makeProgram();
    await program.parseAsync(['validate', 'staging', '-k', MASTER_KEY, '-v', vaultPath], { from: 'user' });
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('✔');
    expect(output).toContain('valid');
  });

  it('validates all envs with --json flag', async () => {
    const program = makeProgram();
    await program.parseAsync(['validate', '-k', MASTER_KEY, '-v', vaultPath, '--json'], { from: 'user' });
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('staging');
    expect(Array.isArray(parsed.staging)).toBe(true);
  });

  it('outputs error for unknown env', async () => {
    const program = makeProgram();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(
      program.parseAsync(['validate', 'unknown', '-k', MASTER_KEY, '-v', vaultPath], { from: 'user' })
    ).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
