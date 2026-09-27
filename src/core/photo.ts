// On-device water colour analysis. Pixels never leave the phone.
// Method: citizens photograph stream water in a white cup/tray from above;
// we average the central region and classify the tint in HSV space.

import type { PhotoAnalysis } from './types';

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/** Analyse RGBA pixel data (e.g. from canvas.getImageData). */
export function analysePixels(data: Uint8ClampedArray | number[], width: number, height: number): PhotoAnalysis {
  const x0 = Math.floor(width * 0.2), x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2), y1 = Math.ceil(height * 0.8);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      // Skip specular highlights and deep shadows — they carry no colour information.
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum > 250 || lum < 12) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  if (n === 0) {
    return { meanRgb: [0, 0, 0], hue: 0, saturation: 0, brightness: 0, greenIndex: 0, tint: 'clear', confidence: 0 };
  }
  const mean: [number, number, number] = [r / n, g / n, b / n];
  const [hue, saturation, brightness] = rgbToHsv(...mean);
  const greenIndex = mean[1] / (mean[0] + mean[1] + mean[2] || 1);

  let tint: PhotoAnalysis['tint'] = 'clear';
  let confidence: number;
  if (saturation < 0.1) {
    // Nearly colourless: clear if bright, milky grey if dim/dull.
    tint = brightness < 0.72 ? 'grey' : 'clear';
    confidence = tint === 'grey' ? Math.min(1, 0.5 + (0.72 - brightness) * 2) : 0.6 + (0.1 - saturation) * 3;
  } else if (hue >= 55 && hue <= 170 && greenIndex > 0.36) {
    tint = 'green';
    confidence = Math.min(1, 0.4 + saturation * 1.5);
  } else if (hue >= 12 && hue < 55) {
    tint = 'brown';
    confidence = Math.min(1, 0.4 + saturation * 1.4);
  } else {
    tint = 'clear';
    confidence = 0.45;
  }
  return { meanRgb: mean.map(Math.round) as [number, number, number], hue, saturation, brightness, greenIndex, tint, confidence: Math.round(confidence * 100) / 100 };
}
