#!/bin/bash
# A script to patch install.sh for the required changes.

INSTALL_SH="scripts/install.sh"

# Add BUILD_DEPS and RUNTIME_DEPS arrays
# Add build_from_source function
# Add arg parsing for --build

cat << 'INJECT_DEPS' > deps.tmp

# --- Build from source support ---
BUILD_FROM_SOURCE=false

for arg in "$@"; do
    if [ "$arg" = "--build" ] || [ "$arg" = "--build-from-source" ]; then
        BUILD_FROM_SOURCE=true
    fi
done

check_and_install_deps() {
    local RUNTIME_DEPS=(xclip wl-clipboard acl libgtk-3-0 librsvg2-2)
    local BUILD_DEPS=(build-essential curl wget file pkg-config libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libudev-dev)
    local MISSING_DEPS=()
    
    # Determine webkit package dynamically
    if apt-cache show libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
        BUILD_DEPS+=(libwebkit2gtk-4.1-dev)
        RUNTIME_DEPS+=(libwebkit2gtk-4.1-0)
    else
        BUILD_DEPS+=(libwebkit2gtk-4.0-dev)
        RUNTIME_DEPS+=(libwebkit2gtk-4.0-37)
    fi
    
    # Check for missing RUNTIME deps
    for dep in "${RUNTIME_DEPS[@]}"; do
        if ! dpkg -s "$dep" >/dev/null 2>&1; then
            MISSING_DEPS+=("$dep")
        fi
    done

    # Check for missing BUILD deps
    for dep in "${BUILD_DEPS[@]}"; do
        if ! dpkg -s "$dep" >/dev/null 2>&1; then
            MISSING_DEPS+=("$dep")
        fi
    done

    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        log "Missing dependencies detected: ${MISSING_DEPS[*]}"
        log "Installing via apt-get..."
        sudo apt-get update -qq || true
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${MISSING_DEPS[@]}"
    else
        success "All apt dependencies are satisfied."
    fi
}

install_node_rust_cargo() {
    if ! command -v curl >/dev/null 2>&1; then
        sudo apt-get install -y curl
    fi

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        warn "Node.js or npm is missing."
        echo "Run the following commands to install Node.js (v20):"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        if [ "$DEBIAN_FRONTEND" = "noninteractive" ] || [ ! -t 0 ]; then
            log "Non-interactive environment detected, attempting auto-install of Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
        else
            error "Please install Node.js to build from source."
        fi
    fi

    if ! command -v cargo >/dev/null 2>&1; then
        warn "Rust/Cargo is missing."
        echo "Run the following command to install Rust:"
        echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
        echo "  source \$HOME/.cargo/env"
        if [ "$DEBIAN_FRONTEND" = "noninteractive" ] || [ ! -t 0 ]; then
            log "Non-interactive environment detected, attempting auto-install of Rust..."
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
            export PATH="$HOME/.cargo/bin:$PATH"
        else
            error "Please install Rust to build from source."
        fi
    fi
}

build_from_source() {
    log "Starting build from source..."
    check_and_install_deps
    install_node_rust_cargo
    
    # Source cargo env if it exists
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
    
    log "Installing npm dependencies..."
    npm install
    
    log "Building the Tauri application..."
    npm run tauri:build
    
    log "Installing system-wide..."
    sudo make install PREFIX=/usr/local
    
    success "Build and install from source completed successfully."
}
# -------------------------------
INJECT_DEPS

# Insert before install_via_package_manager function
sed -i '/# Installation via package manager/e cat deps.tmp' "$INSTALL_SH"

# Update main function to handle --build
sed -i 's/if \[ "$webkit_status" -eq 1 \]; then/if [ "$BUILD_FROM_SOURCE" = true ]; then\n        build_from_source\n    elif [ "$webkit_status" -eq 1 ]; then/' "$INSTALL_SH"

# Fallback to build if package install fails
sed -i 's/warn "No native package found for your system family. Using AppImage."/warn "No native package found. Falling back to build from source."\n        build_from_source/' "$INSTALL_SH"
sed -i '/install_appimage/d' "$INSTALL_SH"

echo "Patched install.sh"
