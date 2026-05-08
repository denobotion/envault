import { Command } from 'commander';
import { addTag, removeTag, listByTag } from '../commands/tag';

export function registerTagCommands(program: Command): void {
  const tag = program
    .command('tag')
    .description('Manage tags on vault environments');

  tag
    .command('add <environment> <tag>')
    .description('Add a tag to an environment')
    .option('--vault <path>', 'Path to vault file')
    .action(async (environment: string, tagName: string, opts: { vault?: string }) => {
      try {
        const result = await addTag(environment, tagName, opts.vault);
        console.log(`Tag "${tagName}" added to "${environment}". Tags: ${result.tags.join(', ')}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  tag
    .command('remove <environment> <tag>')
    .description('Remove a tag from an environment')
    .option('--vault <path>', 'Path to vault file')
    .action(async (environment: string, tagName: string, opts: { vault?: string }) => {
      try {
        const result = await removeTag(environment, tagName, opts.vault);
        console.log(
          `Tag "${tagName}" removed from "${environment}". Tags: ${result.tags.join(', ') || '(none)'}`
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  tag
    .command('list <tag>')
    .description('List environments that have a given tag')
    .option('--vault <path>', 'Path to vault file')
    .action(async (tagName: string, opts: { vault?: string }) => {
      try {
        const envs = await listByTag(tagName, opts.vault);
        if (envs.length === 0) {
          console.log(`No environments found with tag "${tagName}".`);
        } else {
          console.log(`Environments tagged "${tagName}":`);
          envs.forEach((e) => console.log(`  - ${e}`));
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
