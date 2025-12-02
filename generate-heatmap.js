const { Jimp } = require('jimp');


async function generateHeatmap() {
  const input_image = await Jimp.read('input/test-screenshot.png')

  console.log('Image loaded:', input_image.bitmap.width, 'x', input_image.bitmap.height);
}

generateHeatmap()