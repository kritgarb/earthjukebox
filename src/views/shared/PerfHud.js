// A small readout for measuring the experience on the machine that matters (the demo laptop, an
// exhibition screen): add ?perf to the address. It is never created otherwise.
//   fps / frame: how long frames take and how steady they are (p95 = the slowest 1 in 20)
//   cpu: time spent in our own code per frame. If frame is much higher than cpu, the GPU is the
//        limit and a lower resolution or no bloom is what helps; if they are close, it is the CPU.
//   draws / tris: what the last frame sent to the GPU, all passes included
export class PerfHud {
  constructor(scene) {
    this.scene = scene;
    this.frames = [];
    this.cpu = [];
    this.longTasks = 0;
    this.last = 0;
    this.shownAt = 0;

    this.el = document.createElement('pre');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      zIndex: '99999',
      margin: '0',
      padding: '8px 10px',
      font: '12px/1.4 ui-monospace, Consolas, monospace',
      color: '#bfffd0',
      background: 'rgba(0, 0, 0, 0.72)',
      borderRadius: '8px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });
    document.body.append(this.el);

    // Everything the first frame needs from the scene's renderer is read per frame; info must not
    // reset between the passes of the post-processing, so it is reset by hand (see begin).
    scene.renderer.info.autoReset = false;
    try {
      new PerformanceObserver((list) => (this.longTasks += list.getEntries().length)).observe({ type: 'longtask', buffered: true });
    } catch {
      /* long tasks are not reported by this browser */
    }
  }

  begin() {
    this.scene.renderer.info.reset();
    this.t0 = performance.now();
  }

  end(timestamp) {
    const now = performance.now();
    if (this.last) this.frames.push(timestamp - this.last);
    this.last = timestamp;
    this.cpu.push(now - this.t0);
    if (this.frames.length > 240) this.frames.shift();
    if (this.cpu.length > 240) this.cpu.shift();
    if (now - this.shownAt < 500) return;
    this.shownAt = now;
    this.#show();
  }

  #show() {
    const s = this.scene;
    const info = s.renderer.info;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const sorted = [...this.frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const frame = avg(this.frames);
    const size = s.renderer.domElement;
    const heap = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'n/a';
    this.el.textContent = [
      `fps    ${frame ? (1000 / frame).toFixed(0) : '–'}   frame ${frame.toFixed(1)} ms   p95 ${p95.toFixed(1)} ms`,
      `cpu    ${avg(this.cpu).toFixed(1)} ms`,
      `draws  ${info.render.calls}   tris ${info.render.triangles.toLocaleString('pt-BR')}`,
      `canvas ${size.width}×${size.height}   ratio ${s.ratio}   bloom ${s.fx.bloom.enabled ? 'on' : 'off'}   depth ${s.reversedDepth ? 'reversed' : 'log'}`,
      `memory ${info.memory.textures} textures   heap ${heap}   long tasks ${this.longTasks}`,
    ].join('\n');
  }
}
