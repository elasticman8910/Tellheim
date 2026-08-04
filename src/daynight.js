// Keeps the shared clock and draws a soft darkness layer over the world.
export class DayNightCycle {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.phase = 'day';
    this.elapsed = 0;
    this.phaseListeners = [];
    this.changeListeners = [];
    this.overlay = null;

    if (scene?.add?.rectangle) {
      this.overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x071126)
        .setOrigin(0).setDepth(15).setScrollFactor(0).setAlpha(0);
      scene.scale.on('resize', () => this.resizeOverlay());
    }
  }

  onPhaseChange(listener) { this.phaseListeners.push(listener); }

  onChange(listener) { this.changeListeners.push(listener); }

  durationFor(phase = this.phase) {
    return this.settings[`${phase}DurationSeconds`];
  }

  timeRemaining() { return Math.max(0, this.durationFor() - this.elapsed); }

  // Solar strength also drives the gradual dawn and dusk tint.
  daylightFactor() {
    const progress = Math.min(1, this.elapsed / this.durationFor());
    if (this.phase === 'day') return 1;
    if (this.phase === 'night') return 0;
    if (this.phase === 'dawn') return progress;
    return 1 - progress;
  }

  darknessAlpha() {
    return this.settings.nightOverlayMaximumAlpha * (1 - this.daylightFactor());
  }

  resizeOverlay() {
    this.overlay?.setSize(this.scene.scale.width, this.scene.scale.height);
  }

  update(deltaSeconds) {
    this.elapsed += deltaSeconds;
    const order = ['day', 'dusk', 'night', 'dawn'];
    while (this.elapsed >= this.durationFor()) {
      this.elapsed -= this.durationFor();
      this.phase = order[(order.indexOf(this.phase) + 1) % order.length];
      console.log(`Day/night phase: ${this.phase}`);
      this.phaseListeners.forEach((listener) => listener(this));
    }
    this.overlay?.setAlpha(this.darknessAlpha());
    this.changeListeners.forEach((listener) => listener(this));
  }
}
