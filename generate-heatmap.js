const { intToRGBA, rgbaToInt } = require("@jimp/utils");
const { Jimp } = require('jimp');



//----------- Color Contrast Calculations ----------
/**
 * Convert an sRGB channel (0–255) into linear light (0–1).
 * sRGB values are gamma-corrected, meaning they are not stored in true brightness.
 * WCAG luminance calculations require linear values, so we must "undo" gamma correction.
 */
function srgbToLinear(c) {
  c /= 255; // Convert from 0–255 range to 0–1 range

  // Apply the official inverse sRGB gamma formula
  return c <= 0.03928
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the relative luminance (brightness) of an RGB color.
 * Uses WCAG's luminance formula, which weights R, G, B differently
 * based on human visual sensitivity.
 */
function luminance({ r, g, b}) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // Weighted sum of linear RGB values (official WCAG formula)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculate the WCAG contrast ratio between two RGB colors.
 * Takes luminance of both colors, finds which is lighter and darker,
 * then applies contrast ratio formula:
 * (lighter + 0.05) / (darker + 0.05)
 */
function contrastRatio(color1, color2) {
  // color one and 2 are RGBA values, we want to strip the value from it for this calculation
  // Create copies of the colors without the alpha channel
  newColor1 = { r: color1.r, g: color1.g, b: color1.b };
  newColor2 = { r: color2.r, g: color2.g, b: color2.b };

  const L1 = luminance(newColor1);
  const L2 = luminance(newColor2);
  return (Math.max(L1, L2) + 0.05) /
         (Math.min(L1, L2) + 0.05);
}



async function generateHeatmap() {
  const originalImage = await Jimp.read('input/test-screenshot-small.png');
  //we want to sharpen the image to make sure we're not reading any browser anti-aliasing. 
  //references: 
  // https://en.wikipedia.org/wiki/Kernel_(image_processing)
  // https://jimp-dev.github.io/jimp/api/jimp/classes/jimp/#convolute
  // https://blog.demofox.org/2022/02/26/image-sharpening-convolution-kernels/
  // const inputImage = originalImage.clone().convolution([
  //   [ 0, -1,  0],
  //   [-1,  5, -1],
  //   [ 0, -1,  0]
  // ]);

  const inputImage = originalImage.clone().convolution([
    [ 0.0023, -0.0432,  0.0023],
    [-0.0432,  1.182, -0.0432],
    [ 0.0023, -0.0432,  0.0023]
  ]);
  inputImage.write('output/temp-sharper.png');
  // const inputImage = originalImage.clone().pixelate(6);
  const outputImage = new Jimp({ width: inputImage.bitmap.width, height: inputImage.bitmap.height, color: 0xffffff00 });

  const maxWidth = inputImage.bitmap.width;
  const maxHeight = inputImage.bitmap.height;

  // METHOD ONE: using while loop with manual coordinate handling
  const currentCoordinates = { x: 0, y: 0 };
  // -3 to +3 step for siblings (49 possible siblings)
  // const alertColor = (differentSiblingsCount) => rgbaToInt(234, 14, 14, ((255*0.0052)*differentSiblingsCount))
  const alertColor = (count, multiplier) => rgbaToInt(234, 14, 14, Math.min(255, Math.round(255 * multiplier * count)));

  function withinBounds(coord) {
    return (coord.x >= 0 && coord.x < maxWidth) && (coord.y >= 0 && coord.y < maxHeight)
  }

  while ((currentCoordinates.x <= maxWidth && currentCoordinates.y <= maxHeight)) {
    console.log('Processing pixel at:', currentCoordinates.x, currentCoordinates.y);
    const currentColor = intToRGBA(inputImage.getPixelColor(currentCoordinates.x, currentCoordinates.y));

    //step 1: get array of all pixel 'siblings' (adjacent pixels)
    const siblings = [-3, -2, -1, 0, 1, 2, 3].flatMap(dx =>
      [-3, -2, -1, 0, 1, 2, 3].map(dy => ({ x: currentCoordinates.x + dx, y: currentCoordinates.y + dy }))
    ).filter(coord => withinBounds(coord) && !(coord.x === currentCoordinates.x && coord.y === currentCoordinates.y))
     .filter(sibling => {
      const siblingColor = intToRGBA(inputImage.getPixelColor(sibling.x, sibling.y));
      const siblingRatio = contrastRatio(currentColor, siblingColor);
      // console.dir(siblingRatio);
      return ((siblingRatio !== 1) && (siblingRatio <= 3));
    })
    // console.log('total siblings with sufficient contrast:', siblings.length);
    if (siblings.length > 0) {
      const opacityMultiplier = siblings.length > 25 ? 0.02 : 0.0052;
      outputImage.setPixelColor(alertColor(siblings.length, opacityMultiplier), currentCoordinates.x, currentCoordinates.y);
    }
        

    if (currentCoordinates.x < maxWidth - 1) {
      prevColor = intToRGBA(inputImage.getPixelColor(currentCoordinates.x, currentCoordinates.y));
      currentCoordinates.x += 1;
    } else {
      prevColor = intToRGBA(inputImage.getPixelColor(1, (currentCoordinates.y)));
      currentCoordinates.y += 1;
      if (currentCoordinates.y >! maxHeight) {
        currentCoordinates.x = 0;
        prevColor = { r: 0, g: 0, b: 0, a: 0 };
      }
    }

  }

  // console.dir(inputImage.bitmap.data)
  console.log('Image loaded:', inputImage.bitmap.width, 'x', inputImage.bitmap.height);
  outputImage.write('output/heatmap-output.png');

}

generateHeatmap();
