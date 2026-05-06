import { Command } from 'commander';
import { registerSyncCommands } from './syncCommand';
import { registerInitCommands } from './initCommand';

const program = new Command();

program
  .name('envault')
  .description('Lightweight CLI for encrypting and syncing .env files using a master key')
  .version('0.1.0');

registerInitCommands(program);
registerSyncCommands(program);

export function run(argv: string[] = process.argv): void {
  program.parse(argv);
}

export { program };
