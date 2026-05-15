import { Command } from 'commander';
import { grepVault, GrepMatch } from '../commands/grep';

function formatMatch(match: GrepMatch, showEnv: boolean): string {
  const envPrefix = showEnv ? `[${match.env}] ` : '';
  return `${envPrefix}${match.key}=${match.value}`;
}

export function registerGrepCommands(program: Command): void {
  program
    .command('grep <pattern>')
    .description('Search for a pattern across all env keys and values in the vault')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-k, --keystore <path>', 'Path to keystore')
    .option('-n, --key-name <name>', 'Key name to use', 'default')
    .option('--keys-only', 'Search only in keys')
    .option('--values-only', 'Search only in values')
    .option('-i, --ignore-case', 'Case-insensitive search')
    .option('--no-env', 'Hide environment name prefix')
    .action(async (pattern: string, opts) => {
      try {
        const matches = await grepVault(pattern, {
          vaultPath: opts.vault,
          keystorePath: opts.keystore,
          keyName: opts.keyName,
          keysOnly: opts.keysOnly,
          valuesOnly: opts.valuesOnly,
          ignoreCase: opts.ignoreCase,
        });

        if (matches.length === 0) {
          console.log('No matches found.');
          return;
        }

        const showEnv = opts.env !== false;
        for (const match of matches) {
          console.log(formatMatch(match, showEnv));
        }

        console.log(`\n${matches.length} match(es) found.`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
