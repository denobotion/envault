import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerShareCommands } from '../shareCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys/keystore';

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerShareCommands(program);
  return program;
}

describe('registerShareCommands', () => {
  let tmpDir: string;
  const senderKey = 'cli-sender-key-abcd';
  const recipientKey = 'cli-recipient-key-efgh';

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-share-cli-'));
    const envContent = 'TOKEN=xyz\nSECRET=abc\n';
    const encrypted = await encryptToString(envContent, senderKey);
    writeVaultFile(path.join(tmpDir, 'vault.json'), { version: 1, envs: { dev: encrypted } });
    const keystoreFile = path.join(tmpDir, 'keys.json');
    addKey('dev', senderKey, keystoreFile);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should share an environment and write the output file', async () => {
    const outputPath = path.join(tmpDir, 'dev.shared.vault');
    const program = makeProgram();
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));

    await program.parseAsync([
      'node', 'envault', 'share', 'dev',
      '--recipient-key', recipientKey,
      '--output', outputPath,
      '--vault', path.join(tmpDir, 'vault.json'),
      '--keystore', path.join(tmpDir, 'keys.json'),
    ]);

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(logs.some((l) => l.includes('Shared environment "dev"'))).toBe(true);
    jest.restoreAllMocks();
  });

  it('should exit with error for unknown environment', async () => {
    const program = makeProgram();
    const errors: string[] = [];
    jest.spyOn(console, 'error').mockImplementation((msg) => errors.push(msg));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(
      program.parseAsync([
        'node', 'envault', 'share', 'staging',
        '--recipient-key', recipientKey,
        '--vault', path.join(tmpDir, 'vault.json'),
        '--keystore', path.join(tmpDir, 'keys.json'),
      ])
    ).rejects.toThrow('exit');

    expect(errors.some((e) => e.includes('Share failed'))).toBe(true);
    jest.restoreAllMocks();
  });
});
