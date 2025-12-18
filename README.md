# Contrast-heatmap

Generate a “low-contrast heatmap” overlay for images (Rust). Includes:
- **CLI** (`contrast-heatmap`)
- **Desktop app** (Tauri + Preact UI)
- **Local HTTP server** (for the Chrome extension)
- **Chrome extension** (captures a page screenshot, sends to local server, opens the result)

## How to use

### CLI

This repo also ships a CLI tool:

```bash
contrast-heatmap --input "path-to-your-image.png"
```

### Desktop app + Chrome extension

1. Start the Tauri app (this also starts the local server):

```bash
cargo install tauri-cli --locked
cargo tauri dev -- --manifest-path src-tauri/Cargo.toml
```

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
cd ui
npm install
cd ..

cargo install tauri-cli --locked
cargo tauri build -- --manifest-path src-tauri/Cargo.toml
```

Build outputs:
- **.app**: `src-tauri/target/release/bundle/macos/Contrast Heatmap.app`
- **.dmg**: `src-tauri/target/release/bundle/dmg/Contrast Heatmap_0.1.0_aarch64.dmg` (name may vary by arch/version)

## Dev guide

### Tauri app (dev)

```bash
cd ui
npm install
cd ..

cargo install tauri-cli --locked
cargo tauri dev -- --manifest-path src-tauri/Cargo.toml
```

### Local HTTP server (for integrations)

When the Tauri app is running, it also starts a server on `127.0.0.1:59212`:
- `GET /` → returns `contrast-heatmap`
- `POST /` → accepts an image body and returns a PNG with the heatmap overlay

```bash
curl -s http://127.0.0.1:59212/

curl -s -X POST \
  -H "Content-Type: image/png" \
  --data-binary @input.png \
  http://127.0.0.1:59212/ \
  > output.png
```