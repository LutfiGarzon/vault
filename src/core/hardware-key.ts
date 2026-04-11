import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function storeHardwareKey(serviceName: string, accountName: string, keyData: string): Promise<boolean> {
  if (os.platform() !== 'darwin') {
    return false; // Bypass KEK 3 on non-macOS
  }

  const swiftScript = `
import Foundation
import Security
import LocalAuthentication

let service = "${serviceName}"
let account = "${accountName}"
let keyData = "${keyData}".data(using: .utf8)!

guard let accessControl = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    .touchIDAny,
    nil
) else {
    print("ERROR: Could not create access control")
    exit(1)
}

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecValueData as String: keyData,
    kSecAttrAccessControl as String: accessControl
]

SecItemDelete(query as CFDictionary)
let status = SecItemAdd(query as CFDictionary, nil)

if status == errSecSuccess {
    print("SUCCESS")
    exit(0)
} else {
    print("ERROR: \\(status)")
    exit(1)
}
`;

  const scriptPath = path.join(os.tmpdir(), `vault-hardware-key-${Date.now()}.swift`);
  fs.writeFileSync(scriptPath, swiftScript, 'utf8');

  try {
    const { stdout, stderr } = await execAsync(`swift "${scriptPath}"`);
    return stdout.trim() === 'SUCCESS';
  } catch (error) {
    return false;
  } finally {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }
}

export async function retrieveHardwareKey(serviceName: string, accountName: string): Promise<string | null> {
  if (os.platform() !== 'darwin') return null;

  const swiftScript = `
import Foundation
import Security

let service = "${serviceName}"
let account = "${accountName}"

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecUseOperationPrompt as String: "Authenticate to unlock Vault"
]

var dataTypeRef: AnyObject?
let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)

if status == errSecSuccess, let data = dataTypeRef as? Data, let key = String(data: data, encoding: .utf8) {
    print(key)
    exit(0)
} else {
    exit(1)
}
`;
  const scriptPath = path.join(os.tmpdir(), `vault-retrieve-key-${Date.now()}.swift`);
  fs.writeFileSync(scriptPath, swiftScript, 'utf8');

  try {
    const { stdout } = await execAsync(`swift "${scriptPath}"`);
    return stdout.trim() || null;
  } catch (error) {
    return null;
  } finally {
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
  }
}
