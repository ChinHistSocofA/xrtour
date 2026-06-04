import path from 'path';
import sharp from 'sharp';
import { Lame } from 'node-lame';

const MAX_DIMENSION = 1500;

export async function optimizeImage(inputPath) {
  const stats = await sharp(inputPath).stats();
  const usePng = path.extname(inputPath).toLowerCase() === '.png' && !stats.isOpaque;

  const ext = usePng ? '.png' : '.jpg';
  const outputPath = inputPath.replace(/\.[^.]+$/, `-optimized${ext}`);

  let pipeline = sharp(inputPath).resize(MAX_DIMENSION, MAX_DIMENSION, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (usePng) {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 85 });
  }

  const { width, height } = await pipeline.toFile(outputPath);
  return {
    outputPath,
    width,
    height,
    contentType: usePng ? 'image/png' : 'image/jpeg',
  };
}

export async function optimizeAudio(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '-optimized.mp3');
  const encoder = new Lame({ output: outputPath, bitrate: 128 }).setFile(inputPath);
  await encoder.encode();
  return {
    outputPath,
    contentType: 'audio/mpeg',
  };
}
