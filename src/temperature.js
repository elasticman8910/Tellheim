// Turns the day/night light curve into weather, suit heating, and instant warm rooms.
export class TemperatureSystem {
  constructor(map, player, dayNight, power, survival, settings, powerDraw) {
    this.map = map;
    this.player = player;
    this.dayNight = dayNight;
    this.power = power;
    this.survival = survival;
    this.settings = settings;
    this.powerDraw = powerDraw;
    this.suitPower = settings.suitPowerCapacity;
    this.ambientTemperature = this.calculateAmbient();
    this.listeners = [];
    this.heaterOn = false;
    this.coldDamage = false;
    this.suitEmptyLogged = false;
    this.warmRegionKeys = new Set();
    this.recompute();
  }

  onChange(listener) { this.listeners.push(listener); }

  notify() { this.listeners.forEach((listener) => listener(this)); }

  calculateAmbient() {
    const warmth = this.dayNight.daylightFactor() ** this.settings.daylightCurveExponent;
    return this.settings.nightAmbientCelsius
      + (this.settings.dayAmbientCelsius - this.settings.nightAmbientCelsius) * warmth;
  }

  regionKey(region) {
    return region.tiles.map(({ x, y }) => `${x},${y}`).sort().join('|');
  }

  regionHasPodObject(region, objectId) {
    const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    return region.tiles.some(({ x, y }) => directions.some(([dx, dy]) =>
      this.map.podObjectAt?.(x + dx, y + dy)?.id === objectId));
  }

  regionHasHeatSource(region) {
    return region.tiles.some(({ x, y }) => (this.map.baseAt(x, y) === 'heater'
      && this.power.isPowered(`heater:${x},${y}`)))
      || (this.regionHasPodObject(region, 'thermalControl')
        && this.power.isPowered('thermalControl'));
  }

  recompute() {
    const next = new Set();
    (this.survival.regions || []).forEach((region) => {
      if (this.regionHasHeatSource(region) && this.power.hasPower()) next.add(this.regionKey(region));
    });
    next.forEach((key) => {
      if (!this.warmRegionKeys.has(key)) console.log('Room temperature: warm');
    });
    this.warmRegionKeys.forEach((key) => {
      if (!next.has(key)) console.log('Room temperature: cold');
    });
    this.warmRegionKeys = next;
    this.syncHeatConsumers();
  }

  syncHeatConsumers() {
    [...this.power.consumers.keys()]
      .filter((id) => id.startsWith('heater:'))
      .forEach((id) => this.power.unregisterConsumer(id));
    this.power.unregisterConsumer('thermalControl');
    let hasThermalControl = false;
    (this.survival.regions || []).forEach((region) => region.tiles.forEach(({ x, y }) => {
      if (this.map.baseAt(x, y) === 'heater') {
        this.power.registerConsumer(`heater:${x},${y}`, {
          drawPerSecond: this.powerDraw.heater,
          type: 'heater',
          onPowerChange: (powered) => this.map.setBasePowered?.(x, y, powered),
        });
      }
      if (this.regionHasPodObject(region, 'thermalControl')) hasThermalControl = true;
    }));
    if (hasThermalControl) this.power.registerConsumer('thermalControl', {
      drawPerSecond: this.powerDraw.thermalControl,
      type: 'heater',
      onPowerChange: (powered) => this.map.setPodObjectPowered?.('thermalControl', powered),
    });
  }

  isPlayerWarm() {
    const tile = this.player.currentTile();
    const region = this.survival.tileRegions.get(`${tile.x},${tile.y}`);
    return Boolean(region) && this.warmRegionKeys.has(this.regionKey(region));
  }

  setHeaterState(on) {
    if (on === this.heaterOn) return;
    this.heaterOn = on;
    console.log(`Suit heater: ${on ? 'on' : 'off'}`);
  }

  setColdDamage(on) {
    if (on === this.coldDamage) return;
    this.coldDamage = on;
    console.log(`Cold damage: ${on ? 'started' : 'stopped'}`);
  }

  update(deltaSeconds) {
    this.ambientTemperature = this.calculateAmbient();
    this.recompute();
    const tile = this.player.currentTile();
    const byRack = this.map.isAdjacentToSuitRack?.(tile.x, tile.y);
    if (byRack && this.suitPower < this.settings.suitPowerCapacity) {
      this.power.registerConsumer('suitRack', {
        drawPerSecond: this.powerDraw.suitRack,
        type: 'suitRack',
        onPowerChange: (powered) => this.map.setPodObjectPowered?.('suitRack', powered),
      });
      if (this.power.isPowered('suitRack')) {
      this.suitPower += this.settings.suitRackRechargePerSecond * deltaSeconds;
      }
    } else {
      this.power.unregisterConsumer('suitRack');
    }
    this.suitPower = Math.min(this.settings.suitPowerCapacity, this.suitPower);

    const exposedToCold = this.ambientTemperature < this.settings.safeMinimumCelsius
      && !this.isPlayerWarm();
    const heating = exposedToCold && this.suitPower > 0;
    this.setHeaterState(heating);
    if (heating) {
      this.suitPower = Math.max(0,
        this.suitPower - this.settings.suitHeaterDrainPerSecond * deltaSeconds);
      if (this.suitPower === 0 && !this.suitEmptyLogged) {
        console.log('Suit power: empty');
        this.suitEmptyLogged = true;
      }
    }
    if (this.suitPower > 0) this.suitEmptyLogged = false;
    const takingDamage = exposedToCold && this.suitPower === 0;
    this.setColdDamage(takingDamage);
    if (takingDamage) this.survival.health = Math.max(0,
      this.survival.health - this.settings.coldHealthDrainPerSecond * deltaSeconds);
    this.notify();
  }
}
