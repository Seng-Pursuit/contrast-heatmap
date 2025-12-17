use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate a low-contrast heatmap overlay next to the input image")]
struct Args {
    /// Input image path (png/jpg/etc)
    #[arg(short, long)]
    input: PathBuf,
}

fn main() -> Result<()> {
    let args = Args::parse();

    let out_path = contrast_heatmap::derive_output_path(&args.input)?;
    let png = contrast_heatmap::generate_heatmap_png_bytes(&args.input, Default::default())?;
    std::fs::write(&out_path, png)
        .with_context(|| format!("Failed to save output image: {}", out_path.display()))?;

    println!("Wrote: {}", out_path.display());
    Ok(())
}