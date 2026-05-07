import { Command } from 'commander';
import { importEnvFile } from '../commands/import';

export function registerImportCommands(program: Command): void {
  program
    .command('import <envFile>')
    .description('Import a .env file into the vault by encrypting its contents')
    .option('-e, --env <environment>', 'Target environment name', 'default')
    .option('-k, --key-name <keyName>', 'Master key name to use for encryption', 'default')
    .option('-v, --vault-path <vaultPath>', 'Custom path for the vault directory')
    .action(async (envFile: string, options: { env: string; keyName: string; vaultPath?: string }) => {
      try {
        const result = await importEnvFile(envFile, {
          env: options.env,
          keyName: options.keyName,
          vaultPath: options.vaultPath,
        });

        console.log(`✅ Imported ${result.keysImported} key(s) into environment "${result.environment}".`);
        console.log(`   Vault file: ${result.vaultFile}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Import failed: ${message}`);
        process.exit(1);
      }
    });
}
