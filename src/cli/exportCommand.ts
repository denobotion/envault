import { Command } from 'commander';
import * as path from 'path';
import { exportEnv } from '../commands/export';

export function registerExportCommands(program: Command): void {
  program
    .command('export')
    .description('Decrypt and export .env from the vault')
    .argument('[vault]', 'Path to vault file', '.envault')
    .option('-e, --env <environment>', 'Environment to export', 'default')
    .option('-o, --output <file>', 'Output file path (defaults to .env)', '.env')
    .option('-k, --key-id <keyId>', 'Key ID to use for decryption')
    .action(async (vault: string, options: { env: string; output: string; keyId?: string }) => {
      try {
        const vaultPath = path.resolve(vault);
        const outputPath = path.resolve(options.output);

        await exportEnv(vaultPath, {
          env: options.env,
          output: outputPath,
          keyId: options.keyId,
        });

        console.log(`✔ Exported environment "${options.env}" to ${outputPath}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`✖ Export failed: ${message}`);
        process.exit(1);
      }
    });
}
