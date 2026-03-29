const Tesseract = require('tesseract.js');
const fs = require('fs');

async function testOCR() {
  console.log("Creating dummy image...");
  // 1x1 white pixel base64
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync('test_image.png', buffer);

  console.log("Running Tesseract recognize...");
  try {
    const { data: { text } } = await Tesseract.recognize('test_image.png', 'eng', { logger: m => console.log(m) });
    console.log("OCR Result:", text);
  } catch(e) {
    console.error("Tesseract Error:", e.message);
  }
}

testOCR();
