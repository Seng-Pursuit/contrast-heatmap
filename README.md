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