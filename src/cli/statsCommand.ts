import { Command } from 'commander';
import { getVaultStats } from '../commands/stats';
import { defaultKeystorePath } from '../keys';

export function registerStatsCommands(program: Command): void {
  program
    .command('stats <environment>')
    .description('Display statistics for a vault environment')
    .option('-k, --keystore <path>', 'Path to keystore', defaultKeystorePath())
    .option('--json', 'Output as JSON')
    .action(async (environment: string, opts: { keystore: string; json?: boolean }) => {
      try {
        const stats = await getVaultStats(environment, opts.keystore);

        if (opts.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log(`\nVault Stats — ${stats.environment}`);
        console.log('─'.repeat(36));
        console.log(`  Total keys      : ${stats.totalKeys}`);
        console.log(`  Total size      : ${stats.totalSize} bytes`);
        console.log(`  Avg value length: ${stats.avgValueLength} chars`);
        console.log(`  Empty values    : ${stats.emptyValues}`);
        if (stats.createdAt) console.log(`  Created at      : ${stats.createdAt}`);
        if (stats.updatedAt) console.log(`  Updated at      : ${stats.updatedAt}`);
        console.log();
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
