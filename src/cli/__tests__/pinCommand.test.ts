import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerPinCommands } from '../pinCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890123456';

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerPinCommands(program);
  return program;
}

async function setupVault(dir: string, env: string) {
  const entries: Record<string, string> = {};
  entries['API_KEY'] = await encryptToString('secret', MASTER_KEY);
  writeVaultFile(path.join(dir, `${env}.vault`), {
    entries,
    metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
}

describe('pinCommand', () => {
  let tmpDir: string;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pincmd-'));
    await setupVault(tmpDir, 'staging');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('pin add: pins a key and prints confirmation', async () => {
    const program = makeProgram();
    await program.parseAsync(['pin', 'add', 'staging', 'API_KEY', '--vault-dir', tmpDir, '--master-key', MASTER_KEY], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Pinned "API_KEY"'));
  });

  it('pin add: errors when master key missing', async () => {
    const program = makeProgram();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(
      program.parseAsync(['pin', 'add', 'staging', 'API_KEY', '--vault-dir', tmpDir], { from: 'user' })
    ).rejects.toThrow('exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('master key is required'));
    mockExit.mockRestore();
  });

  it('pin remove: unpins a pinned key', async () => {
    const program = makeProgram();
    await program.parseAsync(['pin', 'add', 'staging', 'API_KEY', '--vault-dir', tmpDir, '--master-key', MASTER_KEY], { from: 'user' });
    await program.parseAsync(['pin', 'remove', 'staging', 'API_KEY', '--vault-dir', tmpDir], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Unpinned "API_KEY"'));
  });

  it('pin list: shows no pinned keys message when empty', async () => {
    const program = makeProgram();
    await program.parseAsync(['pin', 'list', '--vault-dir', tmpDir], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith('No pinned keys.');
  });

  it('pin list: displays pinned keys in table format', async () => {
    const program = makeProgram();
    await program.parseAsync(['pin', 'add', 'staging', 'API_KEY', '--vault-dir', tmpDir, '--master-key', MASTER_KEY], { from: 'user' });
    await program.parseAsync(['pin', 'list', '--vault-dir', tmpDir], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('API_KEY'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('staging'));
  });
});
