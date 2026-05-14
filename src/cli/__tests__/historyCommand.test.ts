import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerHistoryCommands } from '../historyCommand';
import { saveHistory, HistoryEntry } from '../../commands/history';
import { writeVaultFile } from '../../vault';

function makeProgram(): Command {
  const p = new Command();
  p.exitOverride();
  registerHistoryCommands(p);
  return p;
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-histcmd-'));
}

describe('historyCommand', () => {
  let tmpDir: string;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    const vaultPath = path.join(tmpDir, '.envault');
    writeVaultFile(vaultPath, {
      version: 1,
      environments: { production: { secrets: {}, tags: [] } },
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('prints no history message when empty', () => {
    const program = makeProgram();
    program.parse(['history', '--dir', tmpDir], { from: 'user' });
    expect(consoleSpy).toHaveBeenCalledWith('No history entries found.');
  });

  it('prints history entries', () => {
    const vaultPath = path.join(tmpDir, '.envault');
    const entries: HistoryEntry[] = [
      { timestamp: '2024-06-01T10:00:00.000Z', action: 'import', environment: 'production', keyCount: 3, tags: ['prod'] },
    ];
    saveHistory(vaultPath, entries);

    const program = makeProgram();
    program.parse(['history', '--dir', tmpDir], { from: 'user' });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('import');
    expect(output).toContain('production');
    expect(output).toContain('prod');
  });

  it('filters by environment', () => {
    const vaultPath = path.join(tmpDir, '.envault');
    const entries: HistoryEntry[] = [
      { timestamp: '2024-06-01T10:00:00.000Z', action: 'import', environment: 'production', keyCount: 3, tags: [] },
      { timestamp: '2024-06-02T10:00:00.000Z', action: 'sync', environment: 'staging', keyCount: 1, tags: [] },
    ];
    saveHistory(vaultPath, entries);

    const program = makeProgram();
    program.parse(['history', '--dir', tmpDir, '--env', 'staging'], { from: 'user' });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('staging');
    expect(output).not.toContain('production');
  });

  it('exits with error for invalid limit', () => {
    const program = makeProgram();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    expect(() =>
      program.parse(['history', '--dir', tmpDir, '--limit', 'abc'], { from: 'user' })
    ).toThrow();
    exitSpy.mockRestore();
  });
});
