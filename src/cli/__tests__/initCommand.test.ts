import { Command } from 'commander';
import { registerInitCommands } from '../initCommand';
import * as masterkey from '../../keys/masterkey';
import * as keystore from '../../keys/keystore';
import * as vault from '../../vault';
import * as fs from 'fs';

jest.mock('../../keys/masterkey');
jest.mock('../../keys/keystore');
jest.mock('../../vault');
jest.mock('fs');

const mockGenerateMasterKey = masterkey.generateMasterKey as jest.MockedFunction<typeof masterkey.generateMasterKey>;
const mockAddKey = keystore.addKey as jest.MockedFunction<typeof keystore.addKey>;
const mockResolveVaultPath = vault.resolveVaultPath as jest.MockedFunction<typeof vault.resolveVaultPath>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('registerInitCommands', () => {
  let program: Command;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerInitCommands(program);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    mockResolveVaultPath.mockReturnValue('/tmp/.envault');
    mockGenerateMasterKey.mockReturnValue('a'.repeat(64));
    mockAddKey.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should exit if .env file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    await program.parseAsync(['node', 'envault', 'init']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('.env file not found'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if vault file already exists', async () => {
    mockExistsSync
      .mockReturnValueOnce(true)  // .env exists
      .mockReturnValueOnce(true); // vault exists
    await program.parseAsync(['node', 'envault', 'init']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should generate and store a master key on success', async () => {
    mockExistsSync
      .mockReturnValueOnce(true)   // .env exists
      .mockReturnValueOnce(false); // vault does not exist
    await program.parseAsync(['node', 'envault', 'init']);
    expect(mockGenerateMasterKey).toHaveBeenCalled();
    expect(mockAddKey).toHaveBeenCalledWith('default', 'a'.repeat(64));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Master key stored'));
  });
});
