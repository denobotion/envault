import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerPackCommands } from '../packCommand';
import { writeVaultFile } from '../../vault';

function makeProgram(): Command {
  const p = new Command();
  p.exitOverride();
  registerPackCommands(p);
  return p;
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-packcmd-'));
}

function setupVault(dir: string) {
  writeVaultFile(path.join(dir, '.envault'), {
    version: 1,
    environments: {
      production: { KEY: 'enc-val' },
      staging: { KEY: 'enc-stg' },
    },
  });
}

describe('pack create command', () => {
  it('creates a pack file and logs output', async () => {
    const dir = makeTmpDir();
    setupVault(dir);
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    const program = makeProgram();
    await program.parseAsync(['pack', 'create', '--dir', dir], { from: 'user' });
    spy.mockRestore();
    expect(logs.some((l) => l.includes('Packed'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'vault.pack'))).toBe(true);
  });

  it('logs error and sets exitCode on failure', async () => {
    const dir = makeTmpDir(); // no vault
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['pack', 'create', '--dir', dir], { from: 'user' });
    spy.mockRestore();
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe('pack extract command', () => {
  it('extracts a pack file and logs environments', async () => {
    const srcDir = makeTmpDir();
    const destDir = makeTmpDir();
    setupVault(srcDir);
    const { packVault } = await import('../../commands/pack');
    const { outputPath } = await packVault('', { vaultDir: srcDir });
    const packFile = path.join(destDir, 'vault.pack');
    fs.copyFileSync(outputPath, packFile);

    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    const program = makeProgram();
    await program.parseAsync(['pack', 'extract', 'vault.pack', '--dir', destDir], { from: 'user' });
    spy.mockRestore();
    expect(logs.some((l) => l.includes('Extracted'))).toBe(true);
    expect(logs.some((l) => l.includes('production'))).toBe(true);
  });

  it('logs error when pack file missing', async () => {
    const dir = makeTmpDir();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['pack', 'extract', 'missing.pack', '--dir', dir], { from: 'user' });
    spy.mockRestore();
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
