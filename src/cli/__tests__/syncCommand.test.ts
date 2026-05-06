import { Command } from 'commander';
import { registerSyncCommands } from '../syncCommand';

describe('registerSyncCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // prevent process.exit during tests
    registerSyncCommands(program);
  });

  it('registers a "sync" command', () => {
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('sync');
  });

  it('registers "sync push" subcommand', () => {
    const syncCmd = program.commands.find((c) => c.name() === 'sync')!;
    const subNames = syncCmd.commands.map((c) => c.name());
    expect(subNames).toContain('push');
  });

  it('registers "sync pull" subcommand', () => {
    const syncCmd = program.commands.find((c) => c.name() === 'sync')!;
    const subNames = syncCmd.commands.map((c) => c.name());
    expect(subNames).toContain('pull');
  });

  it('push subcommand has expected options', () => {
    const syncCmd = program.commands.find((c) => c.name() === 'sync')!;
    const pushCmd = syncCmd.commands.find((c) => c.name() === 'push')!;
    const optionNames = pushCmd.options.map((o) => o.long);
    expect(optionNames).toContain('--env');
    expect(optionNames).toContain('--vault');
    expect(optionNames).toContain('--profile');
  });

  it('pull subcommand has expected options', () => {
    const syncCmd = program.commands.find((c) => c.name() === 'sync')!;
    const pullCmd = syncCmd.commands.find((c) => c.name() === 'pull')!;
    const optionNames = pullCmd.options.map((o) => o.long);
    expect(optionNames).toContain('--env');
    expect(optionNames).toContain('--vault');
    expect(optionNames).toContain('--profile');
  });
});
