// Oscilloscope + spectrum drawn from the live audio analysers: the sound is visible too.
export class ScopeView {
  constructor(canvas, audio, { color = '#ffd23f', bars = 'rgba(31, 196, 107, 0.3)' } = {}) {
    this.canvas = canvas;
    this.audio = audio;
    this.color = color;
    this.bars = bars;
    this.ctx = canvas.getContext('2d');
    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(canvas);
    this.resize();
    this.frame = this.frame.bind(this);
    // Drawn only while it can be seen: with the panels hidden (key H) or the sheet closed on a
    // phone it used to keep reading the analysers and painting a canvas nobody sees.
    this.visible = true;
    this.running = true;
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.running) {
        this.running = true;
        requestAnimationFrame(this.frame);
      }
    }).observe(canvas);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  frame() {
    if (!this.visible) {
      this.running = false;
      return;
    }
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const spectrum = this.audio.spectrum();
    if (spectrum) {
      const bw = w / spectrum.length;
      ctx.fillStyle = this.bars;
      spectrum.forEach((db, i) => {
        const v = Math.max(0, Math.min(1, (db + 100) / 80));
        ctx.fillRect(i * bw, h - v * h, Math.max(1, bw - 1), v * h);
      });
    }

    ctx.strokeStyle = 'rgba(255, 236, 190, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const wave = this.audio.waveform();
    if (wave) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * w;
        const y = h / 2 - Math.max(-1, Math.min(1, wave[i] * 2.2)) * (h / 2 - 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    requestAnimationFrame(this.frame);
  }
}
