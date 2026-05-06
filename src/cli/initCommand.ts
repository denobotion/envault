import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { generateMasterKey } from '../keys/masterkey';
import { addKey } from '../keys/keystore';
import { resolveVaultPath } from '../vault';

const DEFAULT_VAULT_FILE = '.envault';
const DEFAULT_ENV_FILE = '.env';

export function registerInitCommands(program: Command): void {
  program
    .command('init')
    .description('Initialize a new envault vault in the current directory')
    .option('-f, --file <path>', 'Path to the .env file to encrypt', DEFAULT_ENV_FILE)
    .option('-v, --vault <path>', 'Path for the vault output file', DEFAULT_VAULT_FILE)
    .option('--key-name <name>', 'Name to store the master key under', 'default')
    .option('--print-key', 'Print the generated master key to stdout', false)
    .action(async (options) => {
      try {
        const envFilePath = path.resolve(process.cwd(), options.file);
        const vaultFilePath = resolveVaultPath(options.vault);

        if (!fs.existsSync(envFilePath)) {
          console.error(`Error: .env file not found at ${envFilePath}`);
          process.exit(1);
        }

        if (fs.existsSync(vaultFilePath)) {
          console.error(`Error: Vault file already exists at ${vaultFilePath}. Use 'sync' to update it.`);
          process.exit(1);
        }

        const masterKey = generateMasterKey();
        await addKey(options.keyName, masterKey);

        console.log(`✔ Master key stored in keystore under name: "${options.keyName}"`);

        if (options.printKey) {
          console.log(`\nMaster Key: ${masterKey}\n`);
          console.warn('⚠ Store this key securely. It cannot be recovered if lost.');
        }

        console.log(`✔ Vault initialized. Run 'envault sync' to encrypt your .env file.`);
      } catch (err: any) {
        console.error('Init failed:', err.message);
        process.exit(1);
      }
    });
}
