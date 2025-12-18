#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use axum::{
    body::Bytes,
    extract::DefaultBodyLimit,
    extract::{Path as AxumPath, State},
    http::{HeaderValue, Method, StatusCode},
    response::Json,
    response::IntoResponse,
    routing::get,
    Router,
};
use base64::Engine;
use serde::Serialize;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

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

async fn get_root() -> impl IntoResponse {
    (StatusCode::OK, "contrast-heatmap")
}

async fn post_root(body: Bytes) -> impl IntoResponse {
    eprintln!("[contrast-heatmap] server: processing image ({} bytes)...", body.len());
    let started = std::time::Instant::now();

    let res = contrast_heatmap::generate_heatmap_png_from_encoded_bytes(&body, Default::default());

    match res {
        Ok(png) => (
            StatusCode::OK,
            [("content-type", "image/png")],
            {
                eprintln!(
                    "[contrast-heatmap] server: done (ok) in {:?} ({} bytes out)",
                    started.elapsed(),
                    png.len()
                );
                png
            },
        )
            .into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            [("content-type", "text/plain; charset=utf-8")],
            {
                eprintln!(
                    "[contrast-heatmap] server: done (error) in {:?}: {e}",
                    started.elapsed()
                );
                format!("failed to process image: {e}")
            },
        )
            .into_response(),
    }
}

#[derive(Clone, Default)]
struct AppState {
    results: Arc<Mutex<HashMap<String, Vec<u8>>>>,
}

#[derive(Serialize)]
struct ProcessResponse {
    id: String,
    url: String,
}

async fn post_process(State(state): State<AppState>, body: Bytes) -> impl IntoResponse {
    // Same processing as POST /, but store the output and return an id + URL.
    eprintln!("[contrast-heatmap] server: /process start ({} bytes)...", body.len());
    let started = std::time::Instant::now();

    let png = match contrast_heatmap::generate_heatmap_png_from_encoded_bytes(&body, Default::default()) {
        Ok(png) => png,
        Err(e) => {
            eprintln!("[contrast-heatmap] server: /process done (error) in {:?}: {e}", started.elapsed());
            return (
                StatusCode::BAD_REQUEST,
                [("content-type", "text/plain; charset=utf-8")],
                format!("failed to process image: {e}"),
            )
                .into_response();
        }
    };

    let id = Uuid::new_v4().to_string();
    let url = format!("http://127.0.0.1:59212/result/{id}");

    {
        let mut map = state.results.lock().await;
        // keep the map from growing without bound
        if map.len() > 12 {
            if let Some(k) = map.keys().next().cloned() {
                map.remove(&k);
            }
        }
        map.insert(id.clone(), png);
    }

    eprintln!(
        "[contrast-heatmap] server: /process done (ok) in {:?} -> {url}",
        started.elapsed()
    );
    (StatusCode::OK, Json(ProcessResponse { id, url })).into_response()
}

async fn get_result(State(state): State<AppState>, AxumPath(id): AxumPath<String>) -> impl IntoResponse {
    let png_opt = { state.results.lock().await.get(&id).cloned() };
    match png_opt {
        Some(png) => (StatusCode::OK, [("content-type", "image/png")], png).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            [("content-type", "text/plain; charset=utf-8")],
            "not found".to_string(),
        )
            .into_response(),
    }
}

fn start_local_server() {
    // Run on a background task; Tauri uses a Tokio runtime internally.
    tauri::async_runtime::spawn(async move {
        let state = AppState::default();
        let cors = CorsLayer::new()
            .allow_origin(HeaderValue::from_static("*"))
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers(tower_http::cors::Any);

        let app = Router::new()
            .route("/", get(get_root).post(post_root))
            .route("/process", axum::routing::post(post_process))
            .route("/process/", axum::routing::post(post_process))
            .route("/result/{id}", get(get_result))
            .route("/result/{id}/", get(get_result))
            .with_state(state)
            // Full-page PNGs can be large; bump body limit above Axum defaults.
            .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
            .layer(cors);

        let listener = match tokio::net::TcpListener::bind("127.0.0.1:59212").await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to bind local server on 127.0.0.1:59212: {e}");
                return;
            }
        };

        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("Local server error: {e}");
        }
    });
}

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            start_local_server();
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![generate_heatmap_base64_png])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


