import { Command } from 'commander';
import { registerExportCommands } from '../exportCommand';
import * as exportModule from '../../commands/export';

jest.mock('../../commands/export');

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerExportCommands(program);
  return program;
}

describe('registerExportCommands', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (exportModule.exportEnv as jest.Mock).mockResolvedValue('API_KEY=test');
  });

  it('should call exportEnv with default options', async () => {
    const program = makeProgram();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await program.parseAsync(['export'], { from: 'user' });

    expect(exportModule.exportEnv).toHaveBeenCalledWith(
      expect.stringContaining('.envault'),
      expect.objectContaining({ env: 'default', output: expect.stringContaining('.env') })
    );
    consoleSpy.mockRestore();
  });

  it('should pass env and output options', async () => {
    const program = makeProgram();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await program.parseAsync(['export', '--env', 'staging', '--output', '/tmp/.env.staging'], {
      from: 'user',
    });

    expect(exportModule.exportEnv).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ env: 'staging', output: '/tmp/.env.staging' })
    );
    consoleSpy.mockRestore();
  });

  it('should print error and exit on failure', async () => {
    const program = makeProgram();
    (exportModule.exportEnv as jest.Mock).mockRejectedValue(new Error('decrypt error'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(program.parseAsync(['export'], { from: 'user' })).rejects.toThrow('exit');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('decrypt error'));

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
