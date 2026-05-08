import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import { verifyVault } from '../commands/verify';

const DEFAULT_KEYSTORE = path.join(os.homedir(), '.envault', 'keystore.json');

export function registerVerifyCommands(program: Command): void {
  program
    .command('verify <environment>')
    .description('Verify the integrity of an encrypted vault file')
    .option('-k, --keystore <path>', 'Path to keystore file', DEFAULT_KEYSTORE)
    .action(async (environment: string, options: { keystore: string }) => {
      try {
        const result = await verifyVault(environment, options.keystore);

        console.log(`Vault: ${result.vaultPath}`);
        console.log(`Environment: ${result.environment}`);
        console.log(`Key alias: ${result.keyAlias || '(unknown)'}`);
        console.log(`Entries: ${result.entryCount}`);

        if (result.valid) {
          console.log('\n✔ Vault integrity verified successfully.');
        } else {
          console.error('\n✘ Vault verification failed:');
          for (const err of result.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
