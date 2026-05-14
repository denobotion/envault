import { Command } from 'commander';
import { listHistory } from '../commands/history';

function formatEntry(entry: {
  timestamp: string;
  action: string;
  environment: string;
  keyCount: number;
  tags: string[];
}): string {
  const date = new Date(entry.timestamp).toLocaleString();
  const tagStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
  return `${date}  ${entry.action.padEnd(10)}  ${entry.environment.padEnd(16)}  keys: ${entry.keyCount}${tagStr}`;
}

export function registerHistoryCommands(program: Command): void {
  program
    .command('history')
    .description('Show action history for vault environments')
    .option('-e, --env <environment>', 'Filter by environment name')
    .option('-n, --limit <number>', 'Maximum number of entries to show', '20')
    .option('-d, --dir <path>', 'Vault directory', process.cwd())
    .action((opts) => {
      const limit = parseInt(opts.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('Error: --limit must be a positive integer');
        process.exit(1);
      }

      const entries = listHistory(opts.dir, opts.env, limit);

      if (entries.length === 0) {
        console.log('No history entries found.');
        return;
      }

      console.log(`${'DATE'.padEnd(24)}  ${'ACTION'.padEnd(10)}  ${'ENVIRONMENT'.padEnd(16)}  KEYS`);
      console.log('-'.repeat(72));
      for (const entry of entries) {
        console.log(formatEntry(entry));
      }
    });
}
