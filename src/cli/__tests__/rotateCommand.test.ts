import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { registerRotateCommands } from '../rotateCommand';
import { generateMasterKey } from '../../keys/masterkey';
import { addKey, saveKeyStore } from '../../keys/keystore';
import { encryptToString } from '../../crypto';
import { writeVaultFile, parseVaultFile } from '../../vault';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envault-rotate-cmd-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerRotateCommands(program);
  return program;
}

test('rotate key command re-encrypts vault', async () => {
  const masterKey = generateMasterKey();
  const keyId = 'key_test';
  const keystorePath = path.join(tmpDir, 'keystore.json');
  const store = addKey({ keys: {} }, keyId, masterKey);
  await saveKeyStore(keystorePath, store);

  const vaultPath = path.join(tmpDir, '.env.vault');
  const plaintext = 'SECRET=hello';
  const ciphertext = await encryptToString(plaintext, masterKey);
  await writeVaultFile(vaultPath, { ciphertext, keyId, version: 1 });

  const logs: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));

  const program = makeProgram();
  await program.parseAsync(['rotate', 'key', keyId, vaultPath, '--keystore', keystorePath], { from: 'user' });

  expect(logs.some((l) => l.includes('Key rotated successfully'))).toBe(true);
  expect(logs.some((l) => l.includes(keyId))).toBe(true);

  spy.mockRestore();
});

test('rotate list command shows keys', async () => {
  const keystorePath = path.join(tmpDir, 'keystore.json');
  let store = { keys: {} };
  store = addKey(store, 'key_alpha', generateMasterKey());
  await saveKeyStore(keystorePath, store);

  const logs: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));

  const program = makeProgram();
  await program.parseAsync(['rotate', 'list', '--keystore', keystorePath], { from: 'user' });

  expect(logs.some((l) => l.includes('key_alpha'))).toBe(true);

  spy.mockRestore();
});
