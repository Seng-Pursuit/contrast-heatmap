#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use base64::Engine;

#[tauri::command]
fn generate_heatmap_base64_png(input_path: String) -> Result<String, String> {
    let png = contrast_heatmap::generate_heatmap_png_bytes(
        std::path::Path::new(&input_path),
        Default::default(),
    )
    .map_err(|e| e.to_string())?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(png);
    Ok(b64)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![generate_heatmap_base64_png])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


