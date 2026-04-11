import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function storeHardwareKey(serviceName: string, accountName: string, keyData: string): Promise<{ success: boolean; error?: string }> {
  if (os.platform() !== 'darwin') {
    return { success: false, error: 'Hardware keys are only supported on macOS.' };
  }

  const swiftScript = `
import Foundation
import Security
import LocalAuthentication

let service = "${serviceName}"
let account = "${accountName}"
let keyData = "${keyData}".data(using: .utf8)!

// Check if Biometrics are available first
let context = LAContext()
var error: NSError?
if !context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
    print("ERROR: Biometrics not available on this machine. \\(error?.localizedDescription ?? "")")
    exit(1)
}

guard let accessControl = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    .userPresence,
    nil
) else {
    print("ERROR: Could not create access control object")
    exit(1)
}

let deleteQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account
]

SecItemDelete(deleteQuery as CFDictionary)

let addQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecValueData as String: keyData,
    kSecAttrAccessControl as String: accessControl
]

let status = SecItemAdd(addQuery as CFDictionary, nil)

if status == errSecSuccess {
    print("SUCCESS")
    exit(0)
} else {
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "Unknown error"
    print("ERROR: Status \\(status) - \\(message)")
    exit(1)
}
`;

  const scriptPath = path.join(os.tmpdir(), `vault-hardware-key-${Date.now()}.swift`);
  fs.writeFileSync(scriptPath, swiftScript, 'utf8');

  try {
    const { stdout } = await execAsync(`swift "${scriptPath}"`);
    if (stdout.trim() === 'SUCCESS') return { success: true };
    return { success: false, error: stdout.trim() };
  } catch (err: any) {
    return { success: false, error: err.stdout?.trim() || err.stderr?.trim() || err.message };
  } finally {
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
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
    kSecUseOperationPrompt as String: "Unlock your Vault Global Identity"
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
