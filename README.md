# Balce Inventory 🚀

[![GitHub Release](https://img.shields.io/github/v/release/chrisostomemataba/balceinv-desktop?color=blue&logo=github)](https://github.com/chrisostomemataba/balceinv-desktop/releases)
[![GitHub Downloads](https://img.shields.io/github/downloads/chrisostomemataba/balceinv-desktop/total?color=green&logo=github)](https://github.com/chrisostomemataba/balceinv-desktop/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-747fe3?logo=tauri)](https://tauri.app/)

Balce Inventory is a high-performance, enterprise-grade cross-platform desktop application designed for seamless inventory management. Built using an advanced multi-tenant architecture, it provides robust, fast, and sandboxed processing directly on client devices.

---

## 📥 Downloads & Installation

The application binaries are built automatically across multiple operating systems on every stable release. Download the installer matching your workstation configuration below:

| Operating System | Installer Target | Direct Download Link |
| :--- | :--- | :--- |
| **Windows** 🪟 | 64-bit Installer (`.exe`) | [📥 Download for Windows](https://github.com/chrisostomemataba/balceinv-desktop/releases/latest/download/Balce_Inventory_x64-setup.exe) |
| **macOS** 🍏 | Apple Silicon & Intel (`.dmg`) | [📥 Download for macOS](https://github.com/chrisostomemataba/balceinv-desktop/releases/latest) |
| **Linux** 🐧 | Debian Package (`.deb`) | [📥 Download for Linux](https://github.com/chrisostomemataba/balceinv-desktop/releases/latest) |

> 💡 *Note: Since binaries are generated on automated pipelines, macOS and Windows setups might trigger operating system security warnings (like Windows SmartScreen) until signing certificates are attached to production pipelines.*

---

## 🏗️ Architecture Stack

The desktop app leverages a decoupling strategy to guarantee native execution times and UI fluidness:

* **Frontend Viewport:** Built as an optimized Nuxt/Next.js single-page web app running within an isolated webview container managed by **Tauri v2**.
* **App Wrapper Core:** Engineered in **Rust** to manage native system bindings, window configuration constraints, and OS-level lifecycle management.
* **Sidecar Engine:** Powered by a embedded **Go (Golang)** backend operating as a background sidecar process to handle high-throughput analytical operations and database interactions.

---

## 🛠️ Local Development Setup

### Prerequisites
Ensure your local machine has the following toolchains installed:
1. **Rust Stable Compiler:** (via `rustup`)
2. **Go (v1.22+):** Required for compiling the micro-backend.
3. **Node.js (v22+) & pnpm (v11+):** Required for package asset management.
4. **Linux Build Tooling (Ubuntu Only):**
   ```bash
   sudo apt-get update && sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
1. Repository Initialization
Clone the repository alongside its internal frontend submodules:

```bash
git clone --recursive [https://github.com/chrisostomemataba/balceinv-desktop.git](https://github.com/chrisostomemataba/balceinv-desktop.git)
cd balceinv-desktop
```
2. Pre-building the Go Sidecar Binary
Tauri requires target platform triplet-named sidecar binaries to be present in the src-tauri/bin/ directory during execution compilation. Build your local platform variant using one of the following variations:

Windows (PowerShell):

```PowerShell
mkdir src-tauri/bin -Force
cd backend
go build -ldflags="-H=windowsgui" -o ../src-tauri/bin/backend-x86_64-pc-windows-msvc.exe .
```
macOS (Apple Silicon):

```Bash
mkdir -p src-tauri/bin
cd backend
go build -o ../src-tauri/bin/backend-aarch64-apple-darwin .
```
Linux:

```Bash
mkdir -p src-tauri/bin
cd backend
go build -o ../src-tauri/bin/backend-x86_64-unknown-linux-gnu .
```
3. Execution Run
Install the client web assets and trigger the Tauri visual development compiler framework:

```Bash
# Navigate back to root and install dependencies
pnpm --prefix frontend install
```

# Boot development environment
```bash
pnpm tauri dev
```
🚀 Automated CI/CD Engine
App releases are handled dynamically through GitHub Actions via .github/workflows/release.yml. The build flow is strictly tag-scoped:

Code updates are pushed standardly to the main development branches.

When ready to build a release candidate, version flags are bumped inside src-tauri/tauri.conf.json.

Pushing an explicit release tag matching the 'v*' pattern launches the environment compilation matrices automatically:

```bash
git tag v0.1.0
git push origin v0.1.0
```
