import Foundation
import Security
import LocalAuthentication

let args = CommandLine.arguments

if args.count < 3 {
    print("Usage: vault-bridge <store|retrieve> <service> <account> [keyData]")
    exit(1)
}

let action = args[1]
let service = args[2]
let account = args[3]

let context = LAContext()

func authenticateUser(reason: String) -> Bool {
    var success = false
    let semaphore = DispatchSemaphore(value: 0)
    
    if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) {
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { authSuccess, _ in
            success = authSuccess
            semaphore.signal()
        }
    } else {
        return false
    }
    
    _ = semaphore.wait(timeout: .distantFuture)
    return success
}

if action == "store" {
    guard args.count == 5 else { exit(1) }
    let keyData = args[4].data(using: .utf8)!
    
    // Trigger Biometric UI Gate
    guard authenticateUser(reason: "Authorize Vault to store hardware key") else {
        print("ERROR: Authentication failed")
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
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ]

    let status = SecItemAdd(addQuery as CFDictionary, nil)
    if status == errSecSuccess {
        print("SUCCESS")
        exit(0)
    } else {
        let errorMsg = SecCopyErrorMessageString(status, nil) as String? ?? "Code \(status)"
        print("ERROR: Keychain Add failed: \(errorMsg)")
        exit(1)
    }
} else if action == "retrieve" {
    // Trigger Biometric UI Gate
    guard authenticateUser(reason: "Unlock your Vault Global Identity") else {
        print("ERROR: Authentication failed")
        exit(1)
    }

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]

    var dataTypeRef: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)

    if status == errSecSuccess, let data = dataTypeRef as? Data, let key = String(data: data, encoding: .utf8) {
        print(key)
        exit(0)
    } else {
        let errorMsg = SecCopyErrorMessageString(status, nil) as String? ?? "Code \(status)"
        print("ERROR: Keychain Retrieve failed: \(errorMsg)")
        exit(1)
    }
}
