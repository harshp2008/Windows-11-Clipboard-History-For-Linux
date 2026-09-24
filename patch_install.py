import sys

with open("scripts/install.sh", "r") as f:
    content = f.read()

funcs = """
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
    
    if apt-cache show libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
        BUILD_DEPS+=(libwebkit2gtk-4.1-dev)
        RUNTIME_DEPS+=(libwebkit2gtk-4.1-0)
    else
        BUILD_DEPS+=(libwebkit2gtk-4.0-dev)
        RUNTIME_DEPS+=(libwebkit2gtk-4.0-37)
    fi
    
    for dep in "${RUNTIME_DEPS[@]}" "${BUILD_DEPS[@]}"; do
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
        echo "  source \\$HOME/.cargo/env"
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
    
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
    
    log "Installing npm dependencies..."
    npm install
    
    log "Building the Tauri application..."
    npm run tauri:build
    
    log "Installing system-wide..."
    sudo make install PREFIX=/usr/local
    
    success "Build and install from source completed successfully."
}

"""

content = content.replace("launch_app() {", funcs + "launch_app() {")

old_main = """
    # Prefer AppImage if only legacy WebKitGTK 4.0 is available
    if [ "$webkit_status" -eq 1 ]; then
        warn "Legacy WebKitGTK detected. Preferring AppImage for better compatibility."
        install_appimage
    # Try package manager first
    elif install_via_package_manager; then
        success "Package installation complete!"
    else
        warn "No native package found for your system family. Using AppImage."
        install_appimage
    fi
"""

new_main = """
    if [ "$BUILD_FROM_SOURCE" = true ]; then
        build_from_source
    elif [ "$webkit_status" -eq 1 ]; then
        warn "Legacy WebKitGTK detected. Preferring AppImage for better compatibility."
        install_appimage || build_from_source
    elif install_via_package_manager; then
        success "Package installation complete!"
    else
        warn "No native package found for your system family. Trying AppImage..."
        install_appimage || build_from_source
    fi
"""

content = content.replace(old_main.strip(), new_main.strip())

with open("scripts/install.sh", "w") as f:
    f.write(content)
print("done")
