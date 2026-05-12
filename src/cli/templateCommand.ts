import { Command } from 'commander';
import * as path from 'path';
import { renderTemplate, renderTemplateFile } from '../commands/template';
import { getKey } from '../keys';

export function registerTemplateCommands(program: Command): void {
  const cmd = program
    .command('template')
    .description('Render a template using decrypted values from a vault environment');

  cmd
    .command('render <templateFile>')
    .description('Render a template file and write output to a destination')
    .requiredOption('-e, --env <env>', 'Environment to source values from')
    .requiredOption('-o, --output <output>', 'Output file path')
    .option('-k, --key-name <keyName>', 'Key name in keystore', 'default')
    .option('--master-key <masterKey>', 'Master key (overrides keystore lookup)')
    .option('--vault <vaultPath>', 'Path to vault file')
    .action(async (templateFile: string, opts) => {
      try {
        let masterKey: string = opts.masterKey;
        if (!masterKey) {
          masterKey = await getKey(opts.keyName);
          if (!masterKey) {
            console.error(`No key found for name "${opts.keyName}". Use --master-key or add via 'envault keys add'.`);
            process.exit(1);
          }
        }

        const resolvedTemplate = path.resolve(templateFile);
        const resolvedOutput = path.resolve(opts.output);

        const result = await renderTemplateFile(
          resolvedTemplate,
          resolvedOutput,
          opts.env,
          masterKey,
          opts.vault
        );

        console.log(`✔ Rendered template to ${resolvedOutput}`);

        if (result.missing.length > 0) {
          console.warn(`⚠ Missing keys (left unreplaced): ${result.missing.join(', ')}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  cmd
    .command('preview <templateFile>')
    .description('Preview rendered template output in stdout without writing to disk')
    .requiredOption('-e, --env <env>', 'Environment to source values from')
    .option('-k, --key-name <keyName>', 'Key name in keystore', 'default')
    .option('--master-key <masterKey>', 'Master key (overrides keystore lookup)')
    .option('--vault <vaultPath>', 'Path to vault file')
    .action(async (templateFile: string, opts) => {
      try {
        let masterKey: string = opts.masterKey;
        if (!masterKey) {
          masterKey = await getKey(opts.keyName);
          if (!masterKey) {
            console.error(`No key found for name "${opts.keyName}".`);
            process.exit(1);
          }
        }

        const fs = await import('fs');
        const resolvedTemplate = path.resolve(templateFile);
        const content = fs.readFileSync(resolvedTemplate, 'utf-8');
        const result = await renderTemplate(content, opts.env, masterKey, opts.vault);

        console.log(result.output);

        if (result.missing.length > 0) {
          console.warn(`\n⚠ Missing keys: ${result.missing.join(', ')}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
