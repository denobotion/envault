import { Command } from 'commander';
import {
  loadPipelines,
  addPipeline,
  removePipeline,
  runPipeline,
  PipelineStep,
} from '../commands/pipeline';
import { resolveVaultPath } from '../vault';

export function registerPipelineCommands(program: Command): void {
  const pipeline = program
    .command('pipeline')
    .description('Manage and run multi-step env pipelines');

  pipeline
    .command('list')
    .description('List all defined pipelines')
    .option('-v, --vault <path>', 'Vault file path')
    .action((opts) => {
      const vaultPath = resolveVaultPath(opts.vault);
      const pipelines = loadPipelines(vaultPath);
      if (pipelines.length === 0) {
        console.log('No pipelines defined.');
        return;
      }
      pipelines.forEach((p) => {
        console.log(`  ${p.name} (${p.steps.length} step${p.steps.length !== 1 ? 's' : ''})`);
      });
    });

  pipeline
    .command('add <name> <steps...>')
    .description('Add a pipeline (steps as command:env pairs, e.g. sync:production)')
    .option('-v, --vault <path>', 'Vault file path')
    .action((name, stepArgs, opts) => {
      const vaultPath = resolveVaultPath(opts.vault);
      const steps: PipelineStep[] = stepArgs.map((s: string) => {
        const [command, env] = s.split(':');
        return { command, args: env ? { env } : {} };
      });
      addPipeline(vaultPath, { name, steps });
      console.log(`Pipeline "${name}" saved with ${steps.length} step(s).`);
    });

  pipeline
    .command('remove <name>')
    .description('Remove a pipeline by name')
    .option('-v, --vault <path>', 'Vault file path')
    .action((name, opts) => {
      const vaultPath = resolveVaultPath(opts.vault);
      const removed = removePipeline(vaultPath, name);
      if (removed) {
        console.log(`Pipeline "${name}" removed.`);
      } else {
        console.error(`Pipeline "${name}" not found.`);
        process.exit(1);
      }
    });

  pipeline
    .command('run <name>')
    .description('Run a pipeline by name')
    .requiredOption('-k, --key <masterKey>', 'Master key')
    .option('-v, --vault <path>', 'Vault file path')
    .action(async (name, opts) => {
      const vaultPath = resolveVaultPath(opts.vault);
      try {
        const { ran, errors } = await runPipeline(name, vaultPath, opts.key);
        ran.forEach((cmd) => console.log(`  ✔ ${cmd}`));
        if (errors.length > 0) {
          errors.forEach((e) => console.error(`  ✘ ${e}`));
          process.exit(1);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
