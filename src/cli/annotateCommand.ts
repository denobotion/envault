import { Command } from 'commander';
import { annotateKey, removeAnnotation, listAnnotations } from '../commands/annotate';

export function registerAnnotateCommands(program: Command): void {
  const annotate = program
    .command('annotate')
    .description('Add, remove, or list annotations on vault keys');

  annotate
    .command('set <env> <key> <annotation>')
    .description('Set an annotation on a key in the given environment')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-k, --master-key <key>', 'Master key for decryption', process.env.ENVAULT_MASTER_KEY)
    .action(async (env: string, key: string, annotation: string, opts) => {
      const masterKey = opts.masterKey;
      if (!masterKey) {
        console.error('Error: master key is required (use --master-key or ENVAULT_MASTER_KEY)');
        process.exit(1);
      }
      try {
        const result = await annotateKey(env, key, annotation, masterKey, {
          vaultPath: opts.vault,
        });
        console.log(`Annotated [${result.env}] ${result.key}: "${result.annotation}"`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  annotate
    .command('remove <env> <key>')
    .description('Remove annotation from a key')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-k, --master-key <key>', 'Master key', process.env.ENVAULT_MASTER_KEY)
    .action(async (env: string, key: string, opts) => {
      const masterKey = opts.masterKey;
      if (!masterKey) {
        console.error('Error: master key is required');
        process.exit(1);
      }
      try {
        await removeAnnotation(env, key, masterKey, { vaultPath: opts.vault });
        console.log(`Removed annotation from [${env}] ${key}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  annotate
    .command('list <env>')
    .description('List all annotated keys in an environment')
    .option('-v, --vault <path>', 'Path to vault file')
    .action((env: string, opts) => {
      try {
        const annotations = listAnnotations(env, { vaultPath: opts.vault });
        if (annotations.length === 0) {
          console.log(`No annotations found in environment "${env}".`);
          return;
        }
        console.log(`Annotations in [${env}]:`);
        for (const { key, annotation } of annotations) {
          console.log(`  ${key.padEnd(24)} ${annotation}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
