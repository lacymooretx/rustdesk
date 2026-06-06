#!/bin/bash
# Sign RustDesk Windows installer with DigiCert KeyLocker
#
# Prerequisites:
#   - smctl installed (~/.digicert/bin/smctl)
#   - DigiCert KeyLocker credentials in ~/.secrets/.env
#   - Internet access (signing happens via cloud HSM)
#
# Usage:
#   ./sign-rustdesk.sh [version]
#   ./sign-rustdesk.sh 1.3.8

set -eo pipefail

VERSION="${1:-1.3.8}"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$DEPLOY_DIR/build"
SMCTL="$HOME/.digicert/bin/smctl"
KEYPAIR_ALIAS="key_1474429650"
PKCS11_CONFIG="$DEPLOY_DIR/pkcs11-keylocker.cfg"

# Load DigiCert credentials
source ~/.secrets/.env

echo "=== RustDesk Client Sign & Package ==="
echo "Version: $VERSION"
echo ""

# Create build directory
mkdir -p "$BUILD_DIR"

# --- Step 1: Download official RustDesk installer ---
INSTALLER="rustdesk-${VERSION}-x86_64.exe"
INSTALLER_PATH="$BUILD_DIR/$INSTALLER"
DOWNLOAD_URL="https://github.com/rustdesk/rustdesk/releases/download/${VERSION}/${INSTALLER}"

if [ -f "$INSTALLER_PATH" ]; then
    echo "[1/4] Using cached installer: $INSTALLER"
else
    echo "[1/4] Downloading RustDesk $VERSION..."
    curl -L -o "$INSTALLER_PATH" "$DOWNLOAD_URL"
    echo "     Downloaded: $(du -h "$INSTALLER_PATH" | cut -f1)"
fi

# --- Step 2: Sign the installer ---
SIGNED_INSTALLER="rustdesk-${VERSION}-aspendora-signed.exe"
SIGNED_PATH="$BUILD_DIR/$SIGNED_INSTALLER"

# Copy to signed name (smctl signs in-place via JSign + PKCS11)
cp "$INSTALLER_PATH" "$SIGNED_PATH"

echo "[2/4] Signing with DigiCert KeyLocker (Aspendora Technologies, LLC)..."
"$SMCTL" sign \
    --keypair-alias "$KEYPAIR_ALIAS" \
    --config-file "$PKCS11_CONFIG" \
    --input "$SIGNED_PATH" \
    2>&1

echo "     Signed: $SIGNED_INSTALLER"

# --- Step 3: Verify signature ---
echo "[3/4] Verifying Authenticode signature..."
if command -v osslsigncode &>/dev/null; then
    VERIFY_OUT=$(osslsigncode verify "$SIGNED_PATH" 2>&1)
    if echo "$VERIFY_OUT" | grep -q "Aspendora"; then
        echo "     Aspendora signature present"
        echo "$VERIFY_OUT" | grep "Subject.*Aspendora"
    fi
else
    echo "     (Install osslsigncode to verify, or check on Windows)"
fi

# --- Step 4: Generate SHA256 hash ---
echo "[4/4] Generating checksums..."
HASH=$(shasum -a 256 "$SIGNED_PATH" | cut -d' ' -f1)
echo "$HASH  $SIGNED_INSTALLER" > "$BUILD_DIR/$SIGNED_INSTALLER.sha256"
echo "     SHA256: $HASH"

echo ""
echo "=== Done ==="
echo "Signed installer: $BUILD_DIR/$SIGNED_INSTALLER"
echo "SHA256 checksum:  $BUILD_DIR/$SIGNED_INSTALLER.sha256"
echo ""
echo "To deploy via ImmyBot:"
echo "  1. Upload $SIGNED_INSTALLER to a hosting URL (Azure Blob, S3, etc.)"
echo "  2. Set \$SignedInstallerUrl in the ImmyBot install script to that URL"
echo "  3. Deploy — Windows will trust it as signed by Aspendora Technologies, LLC"
