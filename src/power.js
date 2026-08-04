// Models the pod solar array, one shared battery, and a registry of power users.
export class PowerGrid {
  constructor(dayNight, settings) {
    this.dayNight = dayNight;
    this.settings = settings;
    this.battery = Math.min(settings.batteryCapacity, settings.batteryStartingCharge);
    this.consumers = new Map();
    this.listeners = [];
    this.wasEmpty = this.battery === 0;
    this.wasFull = this.battery === settings.batteryCapacity;
    dayNight.onPhaseChange(() => this.logPhaseStatus());
  }

  registerConsumer(id, drawPerSecond) { this.consumers.set(id, drawPerSecond); }

  unregisterConsumer(id) { this.consumers.delete(id); }

  onChange(listener) { this.listeners.push(listener); }

  generationPerSecond() {
    return this.settings.solarGenerationPerSecond * this.dayNight.daylightFactor();
  }

  drawPerSecond() {
    return [...this.consumers.values()].reduce((total, draw) => total + draw, 0);
  }

  batteryPercent() { return (this.battery / this.settings.batteryCapacity) * 100; }

  update(deltaSeconds) {
    const net = (this.generationPerSecond() - this.drawPerSecond()) * deltaSeconds;
    this.battery = Math.max(0, Math.min(this.settings.batteryCapacity, this.battery + net));
    const empty = this.battery === 0;
    const full = this.battery === this.settings.batteryCapacity;
    if (empty && !this.wasEmpty) console.log('Power battery: empty');
    if (full && !this.wasFull) console.log('Power battery: full');
    this.wasEmpty = empty;
    this.wasFull = full;
    this.listeners.forEach((listener) => listener(this));
  }

  logPhaseStatus() {
    console.log(`Power ${this.dayNight.phase}: generation ${this.generationPerSecond().toFixed(1)}/s, draw ${this.drawPerSecond().toFixed(1)}/s, battery ${this.batteryPercent().toFixed(0)}%`);
  }
}
