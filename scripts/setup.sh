#!/bin/bash

# Vault Setup Script
# This script handles the compilation and signing of the hardware bridge.

set -e

# Flexoki Colors
RED='\033[38;2;209;77;65m'
GREEN='\033[38;2;135;154;57m'
BLUE='\033[38;2;67;133;190m'
PURPLE='\033[38;2;206;93;151m'
NC='\033[0m' # No Color

echo -e "${PURPLE}◈ Vault CLI Setup${NC}"

# 1. Check OS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${BLUE}› Non-macOS environment detected. Hardware bridge setup skipped.${NC}"
    exit 0
fi

# 2. Check for Swift
if ! command -v swiftc &> /dev/null; then
    echo -e "${RED}✘ Swift compiler not found. Please install Xcode Command Line Tools.${NC}"
    exit 1
fi

# 3. Compile Bridge
echo -e "${BLUE}› Compiling hardware bridge...${NC}"
swiftc src/core/bridge.swift -o vault-bridge

# 4. Signing
echo -e "${BLUE}› Identifying code signing identities...${NC}"
IDENTITIES=$(security find-identity -v -p codesigning | grep "Apple Development" | awk -F '"' '{print $2}')

if [ -z "$IDENTITIES" ]; then
    echo -e "${RED}✘ No 'Apple Development' identities found in your keychain.${NC}"
    echo -e "  You can still use Vault with a Master Password only."
    echo -e "  To enable Touch ID, you need an Apple Developer certificate."
    exit 0
fi

echo -e "Available identities:"
select IDENTITY in $IDENTITIES "Skip Signing"; do
    if [ "$IDENTITY" == "Skip Signing" ]; then
        echo -e "› Skipping biometric setup."
        exit 0
    elif [ -n "$IDENTITY" ]; then
        echo -e "${BLUE}› Signing bridge with: $IDENTITY${NC}"
        codesign --entitlements vault.entitlements --options runtime --force -s "$IDENTITY" vault-bridge
        echo -e "${GREEN}✔ Bridge signed successfully.${NC}"
        break
    fi
done

echo -e "${GREEN}✔ Setup complete. Run 'vault eb' to move the bridge to its permanent home.${NC}"
