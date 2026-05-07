import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerAuditCommands } from '../auditCommand';
import { writeVaultFile } from '../../vault';
import { saveKeyStore } from '../../keys';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto';

let tmpDir: string;

function makeProgram() {
  const prog = new Command();
  prog.exitOverride();
  registerAuditCommands(prog);
  return prog;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-auditcmd-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupVault(env: string, data: Record<string, string>, masterKey: string) {
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    encrypted[k] = await encryptToString(v, masterKey);
  }
  writeVaultFile(tmpDir, env, encrypted);
  await saveKeyStore(path.join(tmpDir, 'keys.json'), { [env]: masterKey });
}

test('audit command prints success for valid vault', async () => {
  const masterKey = generateMasterKey();
  await setupVault('prod', { SECRET: 'abc123' }, masterKey);

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  const prog = makeProgram();
  await prog.parseAsync([
    'audit', 'prod',
    '--vault-dir', tmpDir,
    '--keystore', path.join(tmpDir, 'keys.json'),
  ], { from: 'user' });

  const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
  expect(output).toMatch(/SECRET/);
  expect(output).toMatch(/decryptable/);

  consoleSpy.mockRestore();
});

test('audit command exits with 1 when vault not found', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

  const prog = makeProgram();
  await prog.parseAsync([
    'audit', 'ghost',
    '--vault-dir', tmpDir,
    '--keystore', path.join(tmpDir, 'keys.json'),
  ], { from: 'user' });

  expect(exitSpy).toHaveBeenCalledWith(1);

  consoleSpy.mockRestore();
  exitSpy.mockRestore();
});
