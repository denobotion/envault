import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerVerifyCommands } from '../verifyCommand';
import { writeVaultFile } from '../../vault';
import { addKey } from '../../keys';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys/masterkey';

let tmpDir: string;

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerVerifyCommands(program);
  return program;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-verifycmd-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('registerVerifyCommands', () => {
  it('prints success message for a valid vault', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const masterKey = generateMasterKey();
    addKey(keystorePath, 'default', masterKey);
    const encVal = await encryptToString('value', masterKey);
    writeVaultFile('staging', 'default', [{ key: 'TOKEN', encryptedValue: encVal }]);

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();
    await program.parseAsync(['node', 'envault', 'verify', 'staging', '-k', keystorePath]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('verified successfully'));
    spy.mockRestore();
  });

  it('exits with code 1 when vault does not exist', async () => {
    const keystorePath = path.join(tmpDir, 'keystore.json');
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => { throw new Error(`exit:${code}`); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'envault', 'verify', 'nonexistent', '-k', keystorePath])
    ).rejects.toThrow('exit:1');
    mockExit.mockRestore();
    spy.mockRestore();
  });
});
