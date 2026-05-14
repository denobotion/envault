import { Command } from 'commander';
import { shareEnv } from '../commands/share';

export function registerShareCommands(program: Command): void {
  program
    .command('share <env>')
    .description('Re-encrypt an environment with a recipient master key and export a shared vault file')
    .requiredOption('-r, --recipient-key <key>', 'Recipient master key to encrypt the shared vault with')
    .option('-o, --output <path>', 'Output path for the shared vault file')
    .option('--vault <path>', 'Path to the vault file')
    .option('--keystore <path>', 'Path to the keystore file')
    .action(async (env: string, opts) => {
      try {
        const result = await shareEnv({
          env,
          recipientKey: opts.recipientKey,
          outputPath: opts.output,
          vaultPath: opts.vault,
          keystorePath: opts.keystore,
        });
        console.log(`✅ Shared environment "${result.env}" (${result.keyCount} keys)`);
        console.log(`   Output: ${result.outputPath}`);
      } catch (err: any) {
        console.error(`❌ Share failed: ${err.message}`);
        process.exit(1);
      }
    });
}
