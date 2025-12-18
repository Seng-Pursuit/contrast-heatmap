# Contrast-heatmap
An experiment with jimp to run px-by-px contrast ratio calculations, in order to generate a heatmap of contrast invalidation. 

Written in Rust based on Libby's original JS implementation.

# How to use

1. Install Rust

Go to https://rust-lang.org/tools/install/ to install rust using the `curl` command.

Before you close the window, you need to add it to the path by running the command shown.

2. Build the cli tool

Run `cargo build --release`

3. Install the cli tool on your local

Run `cargo install --path . --force`

4. Run the command
 
Run `contrast-heatmap --input "whateverfolder/path-to-your-image.png"`

## Tauri app (GUI)

This repo now contains:
- **CLI**: `src/main.rs`
- **Reusable core**: `src/lib.rs` (heatmap algorithm)
- **Tauri app**: `src-tauri/` (Rust backend) + `ui/` (frontend)

### Run the GUI (dev)

From the repo root:

```bash
cd ui
npm install

cd ..
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

### What the GUI does

- **Upload / choose file**: via the native dialog plugin (gives a real filesystem path)
- **Generate heatmap**: calls the Tauri command `generate_heatmap_base64_png`
- **Display image**: renders the returned base64 PNG under the upload area

## Local HTTP server (for Chrome extension / integrations)

When the Tauri app is running, it also starts a local web server:

- `GET http://127.0.0.1:59212/` → returns `contrast-heatmap`
- `POST http://127.0.0.1:59212/` → send an **image** in the request body (PNG/JPG/etc) and it returns a **PNG** with the heatmap overlay

Example:

```bash
curl -s http://127.0.0.1:59212/

curl -s -X POST \
  -H "Content-Type: image/png" \
  --data-binary @input.png \
  http://127.0.0.1:59212/ \
  > output.png
```

## Chrome extension

The extension lives in `chrome-extension/`.

### Load it in Chrome

- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the folder: `contrast-heatmap/chrome-extension`

### Use it

- Start the Tauri app (so the server is running on `127.0.0.1:59212`)
- Click the extension button
  - It captures a **full-page** screenshot (scroll + stitch)
  - Sends it to the local server
  - Opens a new tab with the resulting heatmap image