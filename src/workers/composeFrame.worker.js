// Composes one satellite frame off the main thread: the first image (NOAA-20) wins, and where it
// has no data (black) the next ones (Aqua, Terra) fill in. On the main thread this took about
// 0.66 s per day and ~64 MB of temporary memory, and froze the page while the storm loaded.
const SIZE = 2048;

self.onmessage = async ({ data: { id, bitmaps } }) => {
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const layers = bitmaps.map((bitmap) => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
    bitmap.close();
    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  });

  const out = ctx.createImageData(SIZE, SIZE);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    let src = null;
    for (const layer of layers) {
      if (layer[i] + layer[i + 1] + layer[i + 2] > 24) {
        src = layer;
        break;
      }
    }
    if (src) {
      px[i] = src[i];
      px[i + 1] = src[i + 1];
      px[i + 2] = src[i + 2];
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);

  // Flipped here so the texture can be uploaded as is (WebGL ignores flipY for an ImageBitmap).
  const bitmap = await createImageBitmap(canvas, { imageOrientation: 'flipY' });
  self.postMessage({ id, bitmap }, [bitmap]);
};
