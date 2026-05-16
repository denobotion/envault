import { Command } from 'commander';
import { registerCopyCommands } from '../copyCommand';
import * as keystore from '../../keys/keystore';
import * as copyModule from '../../commands/copy';

jest.mock('../../keys/keystore');
jest.mock('../../commands/copy');

const mockGetKey = keystore.getKey as jest.MockedFunction<typeof keystore.getKey>;
const mockCopyEnv = copyModule.copyEnv as jest.MockedFunction<typeof copyModule.copyEnv>;

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerCopyCommands(program);
  return program;
}

describe('registerCopyCommands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should copy an environment using the default key', async () => {
    mockGetKey.mockResolvedValue('master-key-abc');
    mockCopyEnv.mockResolvedValue(undefined);

    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'copy', 'staging', 'staging-backup']);

    expect(mockGetKey).toHaveBeenCalledWith('default');
    expect(mockCopyEnv).toHaveBeenCalledWith({
      source: 'staging',
      destination: 'staging-backup',
      masterKey: 'master-key-abc',
      vaultPath: undefined,
    });
  });

  it('should use a custom key name when --key-name is provided', async () => {
    mockGetKey.mockResolvedValue('custom-key-xyz');
    mockCopyEnv.mockResolvedValue(undefined);

    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'copy', 'prod', 'prod-copy', '--key-name', 'mykey']);

    expect(mockGetKey).toHaveBeenCalledWith('mykey');
    expect(mockCopyEnv).toHaveBeenCalledWith({
      source: 'prod',
      destination: 'prod-copy',
      masterKey: 'custom-key-xyz',
      vaultPath: undefined,
    });
  });

  it('should pass vault path when --vault option is provided', async () => {
    mockGetKey.mockResolvedValue('master-key-abc');
    mockCopyEnv.mockResolvedValue(undefined);

    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'copy', 'dev', 'dev-copy', '--vault', '/tmp/my.vault']);

    expect(mockCopyEnv).toHaveBeenCalledWith({
      source: 'dev',
      destination: 'dev-copy',
      masterKey: 'master-key-abc',
      vaultPath: '/tmp/my.vault',
    });
  });

  it('should exit with error when key is not found', async () => {
    mockGetKey.mockResolvedValue(null);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'envault', 'copy', 'dev', 'dev-copy'])
    ).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockCopyEnv).not.toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should exit with error when copyEnv throws', async () => {
    mockGetKey.mockResolvedValue('master-key-abc');
    mockCopyEnv.mockRejectedValue(new Error('copy failed'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'envault', 'copy', 'dev', 'dev-copy'])
    ).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
