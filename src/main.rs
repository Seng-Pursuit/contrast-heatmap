use anyhow::{Context, Result};
use clap::Parser;
use image::{ImageBuffer, Rgba, RgbaImage};

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate a low-contrast neighbor heatmap from an image")]
struct Args {
    /// Input image path (PNG recommended)
    #[arg(short, long)]
    input: String,

    /// Output heatmap image path (PNG)
    #[arg(short, long)]
    output: String,

    /// Neighborhood radius (your JS uses 3 => 7x7 window)
    #[arg(short = 'r', long, default_value_t = 3)]
    radius: i32,

    /// Contrast ratio upper threshold (your JS uses <= 3)
    #[arg(short = 't', long, default_value_t = 3.0)]
    threshold: f32,
}

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

fn main() -> Result<()> {
    let args = Args::parse();

    // 1) Load input
    let img = image::open(&args.input)
        .with_context(|| format!("Failed to open input image: {}", args.input))?
        .to_rgba8();

    let (w, h) = img.dimensions();
    println!("Loaded image: {}x{}", w, h);

    // 2) Precompute luminance per pixel (huge speed win vs recomputing in inner loop)
    let mut luma: Vec<f32> = vec![0.0; (w * h) as usize];
    for y in 0..h {
        for x in 0..w {
            let p = img.get_pixel(x, y);
            let [r, g, b, _a] = p.0;
            luma[(y * w + x) as usize] = luminance_rgb(r, g, b);
        }
    }

    // 3) Create output (transparent canvas)
    let mut out: RgbaImage = ImageBuffer::from_pixel(w, h, Rgba([255, 255, 255, 0]));

    // Helper closure for bounds check and indexing
    let idx = |x: u32, y: u32, w: u32| -> usize { (y * w + x) as usize };

    // 4) Main scan: for each pixel, check neighbors in a (2r+1)x(2r+1) window
    let r = args.radius;
    let thr = args.threshold;

    for y in 0..h {
        for x in 0..w {
            let center_l = luma[idx(x, y, w)];

            let mut count: u32 = 0;

            for dy in -r..=r {
                for dx in -r..=r {
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

                    let neighbor_l = luma[idx(nx, ny, w)];

                    // Your JS excludes ratio == 1.0 (equal luminance).
                    if neighbor_l == center_l {
                        continue;
                    }

                    let ratio = contrast_ratio_from_luma(center_l, neighbor_l);
                    if ratio <= thr {
                        count += 1;
                    }
                }
            }

            if count > 0 {
                // Mimic your alpha behavior
                let multiplier = if count > 25 { 0.02_f32 } else { 0.0052_f32 };
                let alpha_f = (255.0 * multiplier * (count as f32)).round();
                let alpha = alpha_f.clamp(0.0, 255.0) as u8;

                out.put_pixel(x, y, Rgba([234, 14, 14, alpha]));
            }
        }
    }

    // 5) Save output
    out.save(&args.output)
        .with_context(|| format!("Failed to save output image: {}", args.output))?;

    println!("Wrote heatmap: {}", args.output);
    Ok(())
}