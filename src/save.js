// Serializes the complete playable world to localStorage and safely restores it.
export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_KEY = 'tellheim.save';
export const CORRUPT_SAVE_KEY = 'tellheim.save.corrupt';

// Future schema changes add one { fromVersion, migrate } entry here.
export const migrations = [];

export class SaveManager {
  constructor(storage = globalThis.localStorage, logger = console) {
    this.storage = storage;
    this.logger = logger;
    this.intervalId = null;
    this.game = null;
  }

  load() {
    const raw = this.storage?.getItem(SAVE_KEY);
    if (!raw) {
      this.logger.log('Save load: no save found; starting fresh');
      return null;
    }
    try {
      let save = JSON.parse(raw);
      if (!save || !Number.isInteger(save.schemaVersion)
        || save.schemaVersion > SAVE_SCHEMA_VERSION) throw new Error('Unsupported save schema');
      while (save.schemaVersion < SAVE_SCHEMA_VERSION) {
        const migration = migrations.find(({ fromVersion }) => fromVersion === save.schemaVersion);
        if (!migration) throw new Error(`Missing migration from schema ${save.schemaVersion}`);
        this.logger.log(`Save migration: ${save.schemaVersion} -> ${save.schemaVersion + 1}`);
        save = migration.migrate(save);
      }
      if (typeof save.map?.seed !== 'string' || !Array.isArray(save.map.tileChanges)
        || !Array.isArray(save.map.structures) || typeof save.inventory !== 'object'
        || !save.player || !save.survival || !save.power || !save.clock) {
        throw new Error('Save is missing required game state');
      }
      this.logger.log(`Save load: schema ${save.schemaVersion}`);
      return save;
    } catch (error) {
      this.logger.error('Save corrupt: backing up and starting fresh', error);
      try { this.storage?.setItem(CORRUPT_SAVE_KEY, raw); } catch (backupError) {
        this.logger.error('Save corrupt backup failed', backupError);
      }
      try { this.storage?.removeItem(SAVE_KEY); } catch (removeError) {
        this.logger.error('Save corrupt cleanup failed', removeError);
      }
      return null;
    }
  }

  connect(game, intervalSeconds) {
    this.game = game;
    this.stop();
    this.intervalId = globalThis.setInterval(() => this.save('periodic'), intervalSeconds * 1000);
  }

  stop() {
    if (this.intervalId !== null) globalThis.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  capture(game = this.game) {
    const { map, player, inventory, oxygen, temperature, power, dayNight } = game;
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      map: {
        seed: map.settings.seed,
        tileChanges: map.tiles.flatMap((row, y) => row.map((tile, x) => ({
          x, y, resourceItemId: tile.resourceItemId || null,
          remainingYield: tile.resourceItemId ? 1 : 0,
        }))),
        structures: [...map.baseTiles.entries()].map(([key, value]) => {
          const [x, y] = key.split(',').map(Number);
          return { x, y, itemId: value.itemId };
        }),
      },
      inventory: { ...inventory.counts },
      player: { x: player.sprite.x, y: player.sprite.y },
      survival: { oxygen: oxygen.oxygen, health: oxygen.health, suitPower: temperature.suitPower },
      power: {
        batteryCharge: power.battery,
        deviceStates: Object.fromEntries([...power.consumers].map(([id, device]) => [id, device.powered])),
      },
      clock: { phase: dayNight.phase, elapsed: dayNight.elapsed },
    };
  }

  save(reason = 'event') {
    if (!this.game) return false;
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.capture()));
      this.logger.log(`Save complete: ${reason}`);
      return true;
    } catch (error) {
      this.logger.error('Save failed', error);
      return false;
    }
  }

  // The map is regenerated first; these mutations are then layered over that seed.
  restore(game, save) {
    if (!save) return false;
    const { map, player, inventory, oxygen, temperature, power, dayNight } = game;
    (save.map?.tileChanges || []).forEach(({ x, y, resourceItemId, remainingYield }) => {
      if (remainingYield <= 0 || !resourceItemId) map.removeResource(x, y);
    });
    (save.map?.structures || []).forEach(({ x, y, itemId }) => map.placeBase(x, y, itemId));
    inventory.counts = inventory.reconcile(save.inventory || {});
    if (Number.isFinite(save.player?.x) && Number.isFinite(save.player?.y)) {
      player.path = [];
      player.destination = null;
      player.sprite.setPosition(save.player.x, save.player.y);
      player.sprite.body?.setVelocity?.(0);
    }
    oxygen.oxygen = this.numberOr(save.survival?.oxygen, oxygen.oxygen);
    oxygen.health = this.numberOr(save.survival?.health, oxygen.health);
    temperature.suitPower = this.numberOr(save.survival?.suitPower, temperature.suitPower);
    power.battery = this.numberOr(save.power?.batteryCharge, power.battery);
    dayNight.phase = save.clock?.phase || dayNight.phase;
    dayNight.elapsed = this.numberOr(save.clock?.elapsed, dayNight.elapsed);

    oxygen.recompute();
    temperature.recompute();
    power.setSolarPanels([...map.baseTiles.values()].filter(({ itemId }) => itemId === 'solarPanel').length);
    Object.entries(save.power?.deviceStates || {}).forEach(([id, powered]) => {
      const device = power.consumers.get(id);
      if (device) power.setConsumerPower(device, powered === true);
    });
    oxygen.notify();
    temperature.notify();
    this.logger.log('Save restore: tile changes, systems, and devices restored');
    return true;
  }

  numberOr(value, fallback) { return Number.isFinite(value) ? value : fallback; }

  reset() {
    this.stop();
    this.storage?.removeItem(SAVE_KEY);
    this.logger.log('Save reset: starting new game');
    globalThis.location?.reload?.();
  }
}
