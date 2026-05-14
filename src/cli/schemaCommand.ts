import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { generateSchema, validateAgainstSchema } from '../commands/schema';

export function registerSchemaCommands(program: Command): void {
  const schema = program.command('schema').description('Generate or validate env schemas');

  schema
    .command('generate <environment>')
    .description('Generate a schema from an existing vault environment')
    .option('-k, --keystore <path>', 'Path to keystore', '.envault/keys')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-o, --output <file>', 'Write schema to JSON file')
    .action(async (environment: string, opts) => {
      try {
        const result = await generateSchema(environment, opts.keystore, opts.vault);
        const json = JSON.stringify(result, null, 2);
        if (opts.output) {
          fs.writeFileSync(opts.output, json, 'utf-8');
          console.log(`Schema written to ${opts.output}`);
        } else {
          console.log(json);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  schema
    .command('validate <schemaFile> <dotenvFile>')
    .description('Validate a .env file against a schema')
    .action(async (schemaFile: string, dotenvFile: string) => {
      try {
        if (!fs.existsSync(schemaFile)) throw new Error(`Schema file not found: ${schemaFile}`);
        if (!fs.existsSync(dotenvFile)) throw new Error(`.env file not found: ${dotenvFile}`);

        const schemaData = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
        const dotenvContent = fs.readFileSync(dotenvFile, 'utf-8');

        const { missing, extra } = await validateAgainstSchema(schemaData, dotenvContent);

        if (missing.length === 0 && extra.length === 0) {
          console.log('✔ Validation passed. No issues found.');
        } else {
          if (missing.length > 0) {
            console.warn(`Missing required keys (${missing.length}):`);
            missing.forEach((k) => console.warn(`  - ${k}`));
          }
          if (extra.length > 0) {
            console.info(`Extra keys not in schema (${extra.length}):`);
            extra.forEach((k) => console.info(`  + ${k}`));
          }
          if (missing.length > 0) process.exit(1);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
