import { Command } from 'commander';
import { registerRenameCommands } from '../renameCommand';
import { renameKey } from '../../commands/rename';

jest.mock('../../commands/rename');

const mockRenameKey = renameKey as jest.MockedFunction<typeof renameKey>;

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerRenameCommands(program);
  return program;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('calls renameKey with correct arguments', async () => {
  mockRenameKey.mockResolvedValue({ oldKey: 'OLD', newKey: 'NEW', env: 'default' });
  const program = makeProgram();
  await program.parseAsync(['rename', 'mykey', 'OLD', 'NEW'], { from: 'user' });
  expect(mockRenameKey).toHaveBeenCalledWith('mykey', 'OLD', 'NEW', {
    env: 'default',
    vaultPath: undefined,
  });
});

test('passes custom env and vault options', async () => {
  mockRenameKey.mockResolvedValue({ oldKey: 'A', newKey: 'B', env: 'staging' });
  const program = makeProgram();
  await program.parseAsync(['rename', 'mykey', 'A', 'B', '--env', 'staging', '--vault', '/tmp/v.json'], { from: 'user' });
  expect(mockRenameKey).toHaveBeenCalledWith('mykey', 'A', 'B', {
    env: 'staging',
    vaultPath: '/tmp/v.json',
  });
});

test('logs success message on rename', async () => {
  mockRenameKey.mockResolvedValue({ oldKey: 'OLD', newKey: 'NEW', env: 'default' });
  const program = makeProgram();
  await program.parseAsync(['rename', 'mykey', 'OLD', 'NEW'], { from: 'user' });
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Renamed "OLD" → "NEW"'));
});

test('logs error and exits on failure', async () => {
  mockRenameKey.mockRejectedValue(new Error('Key not found'));
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
  const program = makeProgram();
  await expect(
    program.parseAsync(['rename', 'mykey', 'MISSING', 'NEW'], { from: 'user' })
  ).rejects.toThrow('exit');
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Key not found'));
  mockExit.mockRestore();
});
