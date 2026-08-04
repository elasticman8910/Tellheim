// Balances solar generation, battery output, and prioritized powered devices.
export class PowerGrid {
  constructor(dayNight, settings) {
    this.dayNight = dayNight;
    this.settings = settings;
    this.battery = Math.min(settings.batteryCapacity, settings.batteryStartingCharge);
    this.consumers = new Map();
    this.solarPanels = 0;
    this.listeners = [];
    this.brownout = false;
    this.batteryDraining = false;
    this.wasEmpty = this.battery === 0;
    this.wasFull = this.battery === settings.batteryCapacity;
    dayNight.onPhaseChange(() => this.logPhaseStatus());
  }

  registerConsumer(id, drawOrOptions, type = 'lifeSupport') {
    const options = typeof drawOrOptions === 'number'
      ? { drawPerSecond: drawOrOptions, type }
      : drawOrOptions;
    const existing = this.consumers.get(id);
    this.consumers.set(id, {
      id,
      drawPerSecond: options.drawPerSecond,
      type: options.type,
      onPowerChange: options.onPowerChange || existing?.onPowerChange,
      powered: existing?.powered ?? true,
    });
  }

  unregisterConsumer(id) { this.consumers.delete(id); }

  onChange(listener) { this.listeners.push(listener); }

  setSolarPanels(count) { this.solarPanels = Math.max(0, count); }

  generationPerSecond() {
    const totalSolar = this.settings.solarGenerationPerSecond
      + this.solarPanels * this.settings.solarPanelGenerationPerSecond;
    return totalSolar * this.dayNight.daylightFactor();
  }

  demandPerSecond() {
    return [...this.consumers.values()].reduce((total, consumer) => total + consumer.drawPerSecond, 0);
  }

  drawPerSecond() {
    return [...this.consumers.values()]
      .filter((consumer) => consumer.powered)
      .reduce((total, consumer) => total + consumer.drawPerSecond, 0);
  }

  isPowered(id) { return this.consumers.get(id)?.powered === true; }

  hasPower() { return this.generationPerSecond() > 0 || this.battery > 0; }

  batteryPercent() { return (this.battery / this.settings.batteryCapacity) * 100; }

  shutdownRank(consumer) {
    const rank = this.settings.shutdownOrder.indexOf(consumer.type);
    return rank < 0 ? this.settings.shutdownOrder.length : rank;
  }

  setConsumerPower(consumer, powered) {
    if (consumer.powered === powered) return;
    consumer.powered = powered;
    consumer.onPowerChange?.(powered);
    console.log(`Power device ${powered ? 'restart' : 'shutdown'}: ${consumer.id}`);
  }

  // Lower-priority devices are removed until active draw fits the available supply.
  allocate(availablePerSecond) {
    const ordered = [...this.consumers.values()].sort((a, b) => {
      const priority = this.shutdownRank(a) - this.shutdownRank(b);
      return priority || a.id.localeCompare(b.id);
    });
    let demand = ordered.reduce((total, consumer) => total + consumer.drawPerSecond, 0);
    const powered = new Set(ordered.map((consumer) => consumer.id));
    for (const consumer of ordered) {
      if (demand <= availablePerSecond) break;
      powered.delete(consumer.id);
      demand -= consumer.drawPerSecond;
    }
    // Apply shutdowns in configured order, then restarts in the exact reverse order.
    ordered.forEach((consumer) => {
      if (!powered.has(consumer.id)) this.setConsumerPower(consumer, false);
    });
    [...ordered].reverse().forEach((consumer) => {
      if (powered.has(consumer.id)) this.setConsumerPower(consumer, true);
    });
  }

  update(deltaSeconds) {
    if (deltaSeconds <= 0) return;
    const generation = this.generationPerSecond();
    const batteryOutput = Math.min(this.settings.batteryMaximumOutputPerSecond, this.battery / deltaSeconds);
    this.allocate(generation + batteryOutput);
    const draw = this.drawPerSecond();
    const batteryNet = generation - draw;
    this.batteryDraining = batteryNet < 0 && this.battery > 0;
    this.battery = Math.max(0, Math.min(this.settings.batteryCapacity,
      this.battery + batteryNet * deltaSeconds));
    const nextBrownout = this.drawPerSecond() < this.demandPerSecond();
    if (nextBrownout !== this.brownout) console.log(`Power brownout: ${nextBrownout ? 'started' : 'ended'}`);
    this.brownout = nextBrownout;
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
