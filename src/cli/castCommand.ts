import { Command } from 'commander';
import { castEntry, CastType } from '../commands/cast';

const VALID_TYPES: CastType[] = ['string', 'number', 'boolean', 'json'];

export function registerCastCommands(program: Command): void {
  program
    .command('cast <key> <type>')
    .description(
      'Re-encrypt a vault entry after casting its value to a given type (string|number|boolean|json)'
    )
    .option('-e, --env <env>', 'environment name', 'default')
    .option('-d, --vault-dir <dir>', 'vault directory')
    .action(async (key: string, type: string, opts) => {
      if (!VALID_TYPES.includes(type as CastType)) {
        console.error(
          `Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`
        );
        process.exit(1);
      }

      try {
        const result = await castEntry(key, type as CastType, {
          env: opts.env,
          vaultDir: opts.vaultDir,
        });
        console.log(
          `✔ Cast "${result.key}": "${result.oldValue}" → "${result.newValue}" (${type})`
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
