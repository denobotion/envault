import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';
import { registerDiffCommands } from '../diffCommand';
import { writeVaultFile } from '../../vault';
import { addKey } from '../../keys';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys/masterkey';

let tmpDir: string;

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerDiffCommands(program);
  return program;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-diffcmd-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupFixture(localContent: string, vaultContent: string, env = 'development') {
  const masterKey = generateMasterKey();
  const envPath = path.join(tmpDir, '.env');
  const vaultPath = path.join(tmpDir, '.env.vault');
  const keystorePath = path.join(tmpDir, '.keystore.json');

  const encrypted = await encryptToString(vaultContent, masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: { [env]: { encrypted, updatedAt: new Date().toISOString() } }
  });
  await addKey(env, masterKey, keystorePath);
  fs.writeFileSync(envPath, localContent);
  return { envPath, keystorePath };
}

test('prints no differences message when files match', async () => {
  const { envPath } = await setupFixture('FOO=bar\n', 'FOO=bar\n');
  const program = makeProgram();
  const logs: string[] = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  await program.parseAsync(['diff', envPath, '--no-color'], { from: 'user' });
  expect(logs.some(l => l.includes('No differences found'))).toBe(true);
  jest.restoreAllMocks();
});

test('prints summary line with counts', async () => {
  const { envPath } = await setupFixture('FOO=bar\nNEW=val\n', 'FOO=bar\nOLD=gone\n');
  const program = makeProgram();
  const logs: string[] = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  await program.parseAsync(['diff', envPath, '--no-color'], { from: 'user' });
  const summary = logs.find(l => l.includes('Summary:'));
  expect(summary).toBeDefined();
  expect(summary).toMatch(/\+1/);
  expect(summary).toMatch(/-1/);
  jest.restoreAllMocks();
});

test('--only-changes hides unchanged keys', async () => {
  const { envPath } = await setupFixture('FOO=bar\nNEW=val\n', 'FOO=bar\n');
  const program = makeProgram();
  const logs: string[] = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  await program.parseAsync(['diff', envPath, '--no-color', '--only-changes'], { from: 'user' });
  expect(logs.some(l => l.includes('FOO'))).toBe(false);
  expect(logs.some(l => l.includes('NEW'))).toBe(true);
  jest.restoreAllMocks();
});
