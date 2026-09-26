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
---

## 🧰 Team Tools: Common Products

Sales and support staff load lists of common products (medicines for pharmacies, tools for hardware stores, …). Shops then pick from the list when they add a product, so the name, unit, category and price fill in by themselves. Shop staff never see the upload screen, only the finished list.

### Opening the team screen

1. Sign in to the POS with any account.
2. Go to **Settings → Updates**.
3. Tap the **version number** 7 times quickly.
4. Enter the team passphrase and press **Unlock**.

> 🔒 The passphrase is never written in this repository, because the repository is public. Ask the product owner for it and keep it in a private team note.

After 5 wrong passphrases the screen waits one minute. Closing the screen, or pressing **Lock**, locks it again.

### Preparing the file

Use Excel (`.xlsx`) or CSV (`.csv`), up to 4 MB and 20,000 rows. Old `.xls` files must be saved again as `.xlsx`. Press **Get template** on the team screen for a ready example.

| Column | Required | Also accepted as | Example |
| :--- | :--- | :--- | :--- |
| `name` | Yes | product, product name, item | Paracetamol 500mg |
| `category` | No | | Pain relief |
| `sub_category` | No | subcategory | Tablets |
| `unit` | No (default `pcs`) | uom | strip |
| `sku_prefix` | No (default `GEN`) | sku, code | PARA |
| `default_price` | No | price, selling price | 1,500 or TSh 1,500 |

Any other column, such as `strength` or `form`, is kept as a product detail. Blank rows are ignored. Rows with no name, a repeated name, or a price that is not a number are skipped, and the screen lists each one with its row number.

### Uploading

1. Pick the **business type**. The shop's own type is marked **This shop**.
2. Drop the file in, or click to choose it.
3. Choose how to save it:
   * **Add and update**: new names are added, and names already in the list are updated. Names are matched ignoring capital letters and extra spaces.
   * **Replace all**: the whole list for that business type is replaced by the file.
4. Press **Upload**. Check the added, updated and skipped counts, then the list preview below.

### Shipping a list with the app

Lists uploaded on one PC stay on that PC. To give a list to every shop:

1. Press **Export for bundling** and save the file (for example `pharmacy.json`).
2. Commit it as `backend/seeds/<business type>.json`.
3. Release a new version. New installs, and existing shops whose list for that type is empty, get it on their next start.

### Setting or changing the passphrase

The app stores only a SHA-256 hash of the passphrase, built in at release time from the repository secret `SUPPORT_PASSCODE_HASH`.

```bash
printf %s 'the passphrase' | shasum -a 256
```

Save the output as the `SUPPORT_PASSCODE_HASH` secret, then release a new version. A build without the secret shows "Team tools are not set up in this build". For local development, set `BALCE_SUPPORT_PASSCODE_HASH` to the hash before starting the backend.

---

🚀 Automated CI/CD Engine
App releases are handled dynamically through GitHub Actions via .github/workflows/release.yml. The build flow is strictly tag-scoped:

Code updates are pushed standardly to the main development branches.

When ready to build a release candidate, version flags are bumped inside src-tauri/tauri.conf.json.

Pushing an explicit release tag matching the 'v*' pattern launches the environment compilation matrices automatically:

```bash
git tag v0.1.0
git push origin v0.1.0
```
