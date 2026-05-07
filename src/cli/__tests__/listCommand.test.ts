import { Command } from 'commander';
import { registerListCommands } from '../listCommand';
import * as vaultModule from '../../vault/vault';
import * as keystoreModule from '../../keys/keystore';
import * as fs from 'fs';

jest.mock('../../vault/vault');
jest.mock('../../keys/keystore');
jest.mock('fs');

const mockedVault = vaultModule as jest.Mocked<typeof vaultModule>;
const mockedKeystore = keystoreModule as jest.Mocked<typeof keystoreModule>;
const mockedFs = fs as jest.Mocked<typeof fs>;

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerListCommands(program);
  return program;
}

describe('listCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockedVault.resolveVaultPath.mockReturnValue('.envault');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should notify user when no vault file exists', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'list']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No vault file found'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should list environments from vault', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedVault.parseVaultFile.mockReturnValue({
      environments: {
        production: { updatedAt: new Date('2024-01-01').toISOString(), iv: 'iv1', data: 'data1' },
        staging: { updatedAt: new Date('2024-02-01').toISOString(), iv: 'iv2', data: 'data2' },
      },
    } as any);
    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'list']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('production'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('staging'));
  });

  it('should show keystore keys when --show-keys flag is passed', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedVault.parseVaultFile.mockReturnValue({ environments: {} } as any);
    mockedKeystore.loadKeyStore.mockResolvedValue({ mykey: 'abc123' } as any);
    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'list', '--show-keys']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('mykey'));
  });

  it('should handle empty environments gracefully', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedVault.parseVaultFile.mockReturnValue({ environments: {} } as any);
    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'list']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No environments found'));
  });
});
