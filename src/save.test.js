import assert from 'node:assert/strict';
import {
  CORRUPT_SAVE_KEY, migrations, SAVE_KEY, SAVE_SCHEMA_VERSION, SaveManager,
} from './save.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function sprite(x, y) {
  return {
    x, y, body: { setVelocity() {} }, setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; },
  };
}

function makeGame() {
  const map = {
    settings: { seed: 'regression-seed' },
    tiles: [[
      { resourceItemId: 'ore' }, { resourceItemId: null }, { resourceItemId: null },
    ]],
    baseTiles: new Map(),
    removeResource(x, y) { this.tiles[y][x].resourceItemId = null; },
    placeBase(x, y, itemId) { this.baseTiles.set(`${x},${y}`, { itemId }); return true; },
  };
  const power = {
    battery: 50,
    consumers: new Map(),
    setSolarPanels() {},
    setConsumerPower(device, powered) { device.powered = powered; },
  };
  const oxygen = {
    oxygen: 100, health: 100, sealed: false,
    recompute() {
      this.sealed = map.baseTiles.has('1,0') && map.baseTiles.has('2,0');
      power.consumers.set('lifeSupport:1,0', { powered: true });
    },
    notify() {},
  };
  return {
    map,
    player: { sprite: sprite(16, 24), path: [], destination: null },
    inventory: {
      counts: {},
      reconcile(counts) { return { ...counts }; },
    },
    oxygen,
    temperature: { suitPower: 100, recompute() {}, notify() {} },
    power,
    dayNight: { phase: 'day', elapsed: 0 },
  };
}

const storage = new MemoryStorage();
const logs = [];
const logger = { log: (message) => logs.push(message), error: (message) => logs.push(message) };
const manager = new SaveManager(storage, logger);
const original = makeGame();
original.map.removeResource(0, 0);
original.map.placeBase(1, 0, 'wall');
original.map.placeBase(2, 0, 'lifeSupportUnit');
original.inventory.counts = { ore: 7, wall: 2 };
original.player.sprite.setPosition(61.5, 19.25);
original.oxygen.oxygen = 42.5;
original.oxygen.health = 81;
original.temperature.suitPower = 33;
original.power.battery = 246;
original.dayNight.phase = 'night';
original.dayNight.elapsed = 27.75;
original.oxygen.recompute();
original.power.consumers.get('lifeSupport:1,0').powered = true;

manager.game = original;
assert.equal(manager.save('regression test'), true);
const savedSnapshot = manager.capture(original);
const reloaded = makeGame();
assert.equal(manager.restore(reloaded, manager.load()), true);
assert.deepEqual(manager.capture(reloaded), savedSnapshot,
  'save and reload preserve position, inventory, structures, meters, clock, and power');
assert.equal(reloaded.map.tiles[0][0].resourceItemId, null, 'mined nodes stay mined');
assert.equal(reloaded.oxygen.sealed, true, 'sealed regions recompute after structures load');
assert.equal(reloaded.power.consumers.get('lifeSupport:1,0').powered, true,
  'sealed room life support remains powered');

storage.setItem(SAVE_KEY, '{broken json');
assert.equal(manager.load(), null, 'corrupt saves fall back to a fresh game');
assert.equal(storage.getItem(CORRUPT_SAVE_KEY), '{broken json');
assert.equal(storage.getItem(SAVE_KEY), null);
assert.ok(logs.some((message) => message.startsWith('Save corrupt')));
assert.equal(SAVE_SCHEMA_VERSION, 2);
assert.equal(migrations[0].fromVersion, 1, 'schema one saves gain resource-node timing fields');

const legacy = manager.capture(makeGame());
legacy.schemaVersion = 1;
legacy.map.tileChanges.forEach((tile) => {
  delete tile.totalYield;
  delete tile.regrowAt;
});
storage.setItem(SAVE_KEY, JSON.stringify(legacy));
const migrated = manager.load();
assert.equal(migrated.schemaVersion, 2);
assert.ok(migrated.map.tileChanges.every((tile) => Number.isFinite(tile.totalYield)));
assert.ok(migrated.map.tileChanges.every((tile) => tile.regrowAt === null));

console.log('Verified exact save/reload, mined nodes, sealed power, versioning, and corrupt fallback.');
