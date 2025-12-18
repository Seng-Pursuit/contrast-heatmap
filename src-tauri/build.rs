fn main() {
    // Tauri expects `icons/icon.png` to exist and be RGBA at compile-time for `generate_context!()`.
    // We generate a tiny 1x1 transparent RGBA PNG to keep the repo setup frictionless.
    let icons_dir = std::path::Path::new("icons");
    let icon_path = icons_dir.join("icon.png");
    let icns_path = icons_dir.join("icon.icns");

    if !icon_path.exists() {
        let _ = std::fs::create_dir_all(icons_dir);
        let img = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 0]));
        // Ignore errors here; if it fails, the macro will emit a clearer error message later.
        let _ = img.save(&icon_path);
    }

    // For macOS bundling, Tauri expects an .icns icon. If it's missing, try to generate it from
    // icons/icon.png using built-in macOS tools (sips + iconutil). This runs at build time on macOS.
    #[cfg(target_os = "macos")]
    if !icns_path.exists() && icon_path.exists() {
        let iconset_dir = icons_dir.join("icon.iconset");
        let _ = std::fs::remove_dir_all(&iconset_dir);
        let _ = std::fs::create_dir_all(&iconset_dir);

        let sizes = [
            (16, "icon_16x16.png"),
            (32, "icon_16x16@2x.png"),
            (32, "icon_32x32.png"),
            (64, "icon_32x32@2x.png"),
            (128, "icon_128x128.png"),
            (256, "icon_128x128@2x.png"),
            (256, "icon_256x256.png"),
            (512, "icon_256x256@2x.png"),
            (512, "icon_512x512.png"),
            (1024, "icon_512x512@2x.png"),
        ];

        let mut ok = true;
        for (px, name) in sizes {
            let out = iconset_dir.join(name);
            let status = std::process::Command::new("sips")
                .arg("-z")
                .arg(px.to_string())
                .arg(px.to_string())
                .arg(icon_path.as_os_str())
                .arg("--out")
                .arg(out.as_os_str())
                .status();
            if status.map(|s| !s.success()).unwrap_or(true) {
                ok = false;
                break;
            }
        }

        if ok {
            let status = std::process::Command::new("iconutil")
                .arg("-c")
                .arg("icns")
                .arg(iconset_dir.as_os_str())
                .arg("-o")
                .arg(icns_path.as_os_str())
                .status();
            if status.map(|s| !s.success()).unwrap_or(true) {
                // ignore; bundling will emit a clearer message
            }
        }
    }

    tauri_build::build()
}


