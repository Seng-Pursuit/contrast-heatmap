# Contrast-heatmap

Written in Rust based on Libby's original JS implementation.

Generate a “low-contrast heatmap” overlay for images (Rust). Includes:
- **CLI** (`contrast-heatmap`)
- **Desktop app** (Tauri + Preact UI)
- **Local HTTP server** (for the Chrome extension)
- **Chrome extension** (captures a page screenshot, sends to local server, opens the result)

## How to dev

### CLI

This repo also ships a CLI tool:

Install:
```base
cargo install --path . --force
```

Usage
```bash
contrast-heatmap --input "path-to-your-image.png"
```

### Desktop app + Chrome extension

1. Start the Tauri app (this also starts the local server):

```bash
cd src-tauri
cargo install tauri-cli --locked
cargo tauri dev
```

Having the tauri app running in the dev mode is significantly slower than runningin the build mode.
This is only suitable for dev.
Use the compiled app when you actually want to use it.

2. Load the extension:
- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select: `contrast-heatmap/chrome-extension`

3. Use it:
- Click the extension button
- It captures a full-page screenshot, sends it to `http://127.0.0.1:59212/`, then opens a new tab with the heatmap result

## Production build (macOS)

From the repo root:

```bash
cd src-tauri
cargo install tauri-cli --locked
cargo tauri build
```

Build outputs:
- **.app**: `src-tauri/target/release/bundle/macos/Contrast Heatmap.app`
- **.dmg**: `src-tauri/target/release/bundle/dmg/Contrast Heatmap_0.1.0_aarch64.dmg` (name may vary by arch/version)
