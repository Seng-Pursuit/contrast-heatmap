use anyhow::{Context, Result};
use clap::Parser;
use image::{ImageBuffer, Rgba, RgbaImage};
use std::path::{Path, PathBuf};

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate a low-contrast heatmap overlay next to the input image")]
struct Args {
    /// Input image path (png/jpg/etc)
    #[arg(short, long)]
    input: PathBuf,
}

// --- WCAG contrast helpers (same intent as your JS) ---

fn srgb_to_linear_u8(c: u8) -> f32 {
    let x = (c as f32) / 255.0;
    if x <= 0.03928 {
        x / 12.92
    } else {
        ((x + 0.055) / 1.055).powf(2.4)
    }
}

fn luminance_rgb(r: u8, g: u8, b: u8) -> f32 {
    let rr = srgb_to_linear_u8(r);
    let gg = srgb_to_linear_u8(g);
    let bb = srgb_to_linear_u8(b);
    0.2126 * rr + 0.7152 * gg + 0.0722 * bb
}

fn contrast_ratio_from_luma(l1: f32, l2: f32) -> f32 {
    let (hi, lo) = if l1 >= l2 { (l1, l2) } else { (l2, l1) };
    (hi + 0.05) / (lo + 0.05)
}

// --- 3x3 convolution (for sharpening the analysis image) ---

fn convolve_3x3_clamp_edges(img: &RgbaImage, kernel: [[f32; 3]; 3]) -> RgbaImage {
    let (w, h) = img.dimensions();
    let mut out: RgbaImage = ImageBuffer::new(w, h);

    // helper: clamp coordinate into [0..max]
    let clamp_i32 = |v: i32, lo: i32, hi: i32| -> i32 {
        if v < lo {
            lo
        } else if v > hi {
            hi
        } else {
            v
        }
    };

    for y in 0..h as i32 {
        for x in 0..w as i32 {
            let mut acc_r = 0.0f32;
            let mut acc_g = 0.0f32;
            let mut acc_b = 0.0f32;

            for ky in 0..3 {
                for kx in 0..3 {
                    let ix = clamp_i32(x + (kx as i32 - 1), 0, w as i32 - 1) as u32;
                    let iy = clamp_i32(y + (ky as i32 - 1), 0, h as i32 - 1) as u32;

                    let p = img.get_pixel(ix, iy).0;
                    let k = kernel[ky][kx];

                    acc_r += (p[0] as f32) * k;
                    acc_g += (p[1] as f32) * k;
                    acc_b += (p[2] as f32) * k;
                }
            }

            let a = img.get_pixel(x as u32, y as u32).0[3]; // keep original alpha
            let r = acc_r.round().clamp(0.0, 255.0) as u8;
            let g = acc_g.round().clamp(0.0, 255.0) as u8;
            let b = acc_b.round().clamp(0.0, 255.0) as u8;

            out.put_pixel(x as u32, y as u32, Rgba([r, g, b, a]));
        }
    }

    out
}

// --- output path derivation ---

fn derive_output_path(input: &Path) -> Result<PathBuf> {
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .context("Input filename has no valid stem")?;

    let ext = input.extension().and_then(|e| e.to_str()).unwrap_or("png");

    let filename = format!("{stem}-heatmap.{ext}");
    Ok(parent.join(filename))
}

fn main() -> Result<()> {
    let args = Args::parse();

    // Load original image (this is what we'll overlay onto)
    let original = image::open(&args.input)
        .with_context(|| format!("Failed to open input image: {}", args.input.display()))?
        .to_rgba8();

    let (w, h) = original.dimensions();
    println!("Loaded: {} ({}x{})", args.input.display(), w, h);

    // Sharpened image used ONLY for analysis (like your JS)
    let sharpen_kernel: [[f32; 3]; 3] = [
        [0.0023, -0.0432, 0.0023],
        [-0.0432, 1.1820, -0.0432],
        [0.0023, -0.0432, 0.0023],
    ];
    let analysis_img = convolve_3x3_clamp_edges(&original, sharpen_kernel);

    // Precompute luminance for analysis image (major speed win)
    let mut luma: Vec<f32> = vec![0.0; (w * h) as usize];
    let idx = |x: u32, y: u32| -> usize { (y * w + x) as usize };

    for y in 0..h {
        for x in 0..w {
            let p = analysis_img.get_pixel(x, y).0;
            luma[idx(x, y)] = luminance_rgb(p[0], p[1], p[2]);
        }
    }

    // Create overlay output (start as original)
    let mut overlay = original.clone();

    // Your JS neighborhood: radius=3 => 7x7
    let radius: i32 = 3;
    // Your JS threshold: contrast <= 3
    let threshold: f32 = 3.0;

    // Heatmap color (same as your JS): rgba(234, 14, 14, alpha)
    let heat_r: u8 = 234;
    let heat_g: u8 = 14;
    let heat_b: u8 = 14;

    for y in 0..h {
        for x in 0..w {
            let center_l = luma[idx(x, y)];
            let mut count: u32 = 0;

            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    if dx == 0 && dy == 0 {
                        continue;
                    }

                    let nx_i = x as i32 + dx;
                    let ny_i = y as i32 + dy;

                    if nx_i < 0 || ny_i < 0 || nx_i >= w as i32 || ny_i >= h as i32 {
                        continue;
                    }

                    let nx = nx_i as u32;
                    let ny = ny_i as u32;

                    let neighbor_l = luma[idx(nx, ny)];

                    // JS excluded ratio == 1 (identical luminance); do the same-ish
                    if neighbor_l == center_l {
                        continue;
                    }

                    let ratio = contrast_ratio_from_luma(center_l, neighbor_l);
                    if ratio <= threshold {
                        count += 1;
                    }
                }
            }

            if count == 0 {
                continue;
            }

            // Mimic your alpha scaling logic
            let multiplier: f32 = if count > 25 { 0.02 } else { 0.0052 };
            let alpha_f = (255.0 * multiplier * (count as f32)).round();
            let alpha = alpha_f.clamp(0.0, 255.0) as u8;

            if alpha == 0 {
                continue;
            }

            // Blend heatmap (source) over original (dest)
            let base = overlay.get_pixel(x, y).0;
            let a = (alpha as f32) / 255.0;

            let r = (base[0] as f32 * (1.0 - a) + heat_r as f32 * a).round() as u8;
            let g = (base[1] as f32 * (1.0 - a) + heat_g as f32 * a).round() as u8;
            let b = (base[2] as f32 * (1.0 - a) + heat_b as f32 * a).round() as u8;

            overlay.put_pixel(x, y, Rgba([r, g, b, base[3]]));
        }
    }

    let out_path = derive_output_path(&args.input)?;
    overlay
        .save(&out_path)
        .with_context(|| format!("Failed to save output image: {}", out_path.display()))?;

    println!("Wrote: {}", out_path.display());
    Ok(())
}