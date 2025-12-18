fn main() {
    // Tauri expects `icons/icon.png` to exist and be RGBA at compile-time for `generate_context!()`.
    // We generate a tiny 1x1 transparent RGBA PNG to keep the repo setup frictionless.
    let icons_dir = std::path::Path::new("icons");
    let icon_path = icons_dir.join("icon.png");

    if !icon_path.exists() {
        let _ = std::fs::create_dir_all(icons_dir);
        let img = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 0]));
        // Ignore errors here; if it fails, the macro will emit a clearer error message later.
        let _ = img.save(&icon_path);
    }

    tauri_build::build()
}


