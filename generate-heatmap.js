const { intToRGBA, rgbaToInt, colorDiff } = require("@jimp/utils");
const { Jimp } = require('jimp');
const {fs} = require('fs');

// function getRandomRgbaInt(){
//   let r = Math.floor(Math.random() * 256); // Random between 0-255
//   let g = Math.floor(Math.random() * 256); // Random between 0-255
//   let b = Math.floor(Math.random() * 256); // Random between 0-255
//   return rgbaToInt(r, g, b, 255);
// };


async function generateHeatmap() {
  const inputImage = await Jimp.read('input/test-screenshot.png')
  const outputImage = new Jimp({ width: inputImage.bitmap.width, height: inputImage.bitmap.height, color: 0xffffff00 });

  const maxWidth = inputImage.bitmap.width;
  const maxHeight = inputImage.bitmap.height;

  // METHOD ONE: using while loop with manual coordinate handling
  const currentCoordinates = { x: 0, y: 0 };
  const alertColor = (differentSiblingsCount) => rgbaToInt(234, 14, 14, ((255*0.125)*differentSiblingsCount))

  function withinBounds(coord) {
    return (coord.x >= 0 && coord.x < maxWidth) && (coord.y >= 0 && coord.y < maxHeight)
  }

  while ((currentCoordinates.x <= maxWidth && currentCoordinates.y <= maxHeight)) {
    console.log('Processing pixel at:', currentCoordinates.x, currentCoordinates.y);
    const currentColor = intToRGBA(inputImage.getPixelColor(currentCoordinates.x, currentCoordinates.y));

    //step 1: get array of all pixel 'siblings' (adjacent pixels)
    const siblings = [-1, 0, 1].flatMap(dx =>
      [-1, 0, 1].map(dy => ({ x: currentCoordinates.x + dx, y: currentCoordinates.y + dy }))
    ).filter(coord => withinBounds(coord) && !(coord.x === currentCoordinates.x && coord.y === currentCoordinates.y))
     .filter(sibling => {
      const siblingColor = intToRGBA(inputImage.getPixelColor(sibling.x, sibling.y));
      return colorDiff(currentColor, siblingColor) > 0;
    })
    // step 3: Mark pixel based on the sibling count. 
    outputImage.setPixelColor(alertColor(siblings.length), currentCoordinates.x, currentCoordinates.y);
    

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