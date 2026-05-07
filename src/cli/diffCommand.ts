import { Command } from 'commander';
import * as path from 'path';
import { diffEnvWithVault, DiffEntry } from '../commands/diff';

const STATUS_SYMBOLS: Record<DiffEntry['status'], string> = {
  added: '+',
  removed: '-',
  changed: '~',
  unchanged: ' '
};

const STATUS_COLORS: Record<DiffEntry['status'], string> = {
  added: '\x1b[32m',
  removed: '\x1b[31m',
  changed: '\x1b[33m',
  unchanged: '\x1b[90m'
};

const RESET = '\x1b[0m';

function formatDiffLine(entry: DiffEntry, noColor: boolean): string {
  const symbol = STATUS_SYMBOLS[entry.status];
  const color = noColor ? '' : STATUS_COLORS[entry.status];
  const reset = noColor ? '' : RESET;

  if (entry.status === 'changed') {
    return [
      `${color}${symbol} ${entry.key}${reset}`,
      `${color}  vault: ${entry.vaultValue}${reset}`,
      `${color}  local: ${entry.localValue}${reset}`
    ].join('\n');
  }

  const value = entry.localValue ?? entry.vaultValue ?? '';
  return `${color}${symbol} ${entry.key}=${value}${reset}`;
}

export function registerDiffCommands(program: Command): void {
  program
    .command('diff')
    .description('Show differences between local .env and the vault')
    .argument('<env-file>', 'Path to local .env file')
    .option('-e, --environment <env>', 'Environment name to compare against', 'development')
    .option('--no-color', 'Disable colored output')
    .option('--only-changes', 'Show only added, removed, or changed keys')
    .action(async (envFile: string, options) => {
      try {
        const envFilePath = path.resolve(envFile);
        const entries = await diffEnvWithVault(envFilePath, options.environment);

        const toShow = options.onlyChanges
          ? entries.filter(e => e.status !== 'unchanged')
          : entries;

        if (toShow.length === 0) {
          console.log('No differences found.');
          return;
        }

        const noColor = !options.color;
        for (const entry of toShow) {
          console.log(formatDiffLine(entry, noColor));
        }

        const counts = { added: 0, removed: 0, changed: 0, unchanged: 0 };
        for (const e of entries) counts[e.status]++;
        console.log(`\nSummary: +${counts.added} -${counts.removed} ~${counts.changed} =${counts.unchanged}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
