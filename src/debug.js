// Keeps Eruda hidden until three quick taps land in the top-left debug corner.
export class DebugToggle {
  constructor(settings) {
    this.settings = settings;
    this.taps = [];
    this.visible = false;
  }

  recordTap(pointer) {
    if (pointer.x > this.settings.cornerSizePixels || pointer.y > this.settings.cornerSizePixels) {
      this.taps = [];
      return;
    }
    const now = performance.now();
    this.taps = [...this.taps.filter((time) => now - time <= this.settings.tripleTapWindowMilliseconds), now];
    if (this.taps.length < 3) return;
    this.taps = [];
    if (!window.eruda) {
      console.warn('Eruda is unavailable; check the network connection.');
      return;
    }
    if (!window.__erudaReady) {
      window.eruda.init();
      window.__erudaReady = true;
    }
    this.visible = !this.visible;
    window.eruda[this.visible ? 'show' : 'hide']();
  }
}
