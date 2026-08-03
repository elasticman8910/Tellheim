import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Crafting } from './crafting.js';
import { Inventory } from './inventory.js';
import { TemperateMap } from './mapgen.js';
import { Mining } from './mining.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url)));
const mineableItems = Object.values(items).filter((item) => item.mineable === true);
const craftedItems = Object.values(items).filter((item) => item.recipe);
const mineCount = 5;
globalThis.window = { setTimeout(callback) { callback(); return 1; }, clearTimeout() {} };

// Item visuals must stay one-to-one, so presentation can never make ids ambiguous.
const spriteKeys = Object.values(items).map((item) => item.spriteKey);
const colors = Object.values(items).map((item) => manifest[item.spriteKey]?.color);
assert.equal(new Set(spriteKeys).size, spriteKeys.length, 'every item needs a unique texture key');
assert.ok(colors.every(Boolean), 'every item texture needs a placeholder color');
assert.equal(new Set(colors).size, colors.length, 'every item needs a unique placeholder color');

// Exercise every raw resource N times through the real mining completion path. Crafted
// inventory starts non-zero so the test also proves mining never mutates those ids.
for (const expectedItem of mineableItems) {
  const startingCounts = Object.fromEntries(craftedItems.map((item) => [item.id, 1]));
  const inventory = new Inventory(items, startingCounts);
  const map = Object.create(TemperateMap.prototype);
  map.items = items;
  map.resourceSprites = new Map();
  const mining = new Mining(map, {}, inventory, {
    delayMilliseconds: 0,
    maximumTileDistance: 1,
    pickaxeDelayMultiplier: 0.5,
  });

  for (let attempt = 0; attempt < mineCount; attempt += 1) {
    map.tiles = [[{ resourceItemId: expectedItem.id }]];
    mining.startMining({ x: 0, y: 0 });
  }

  assert.equal(inventory.count(expectedItem.id), mineCount);
  mineableItems.filter((item) => item.id !== expectedItem.id).forEach((item) => {
    assert.equal(inventory.count(item.id), 0, `${item.id} changed while mining ${expectedItem.id}`);
  });
  craftedItems.forEach((item) => {
    assert.equal(inventory.count(item.id), 1, `${item.id} changed while mining ${expectedItem.id}`);
  });
}

assert.ok(mineableItems.length > 0, 'at least one mineable resource must be configured');
assert.ok(mineableItems.every((item) => item.recipe === null));

const invalidMap = Object.create(TemperateMap.prototype);
invalidMap.items = items;
invalidMap.tiles = [[{ resourceItemId: 'copperIngot' }]];
assert.equal(invalidMap.resourceAt(0, 0), null, 'crafted items cannot resolve as mining rewards');

const reconciledInventory = new Inventory(items, { pickaxe: 9 });
assert.equal(reconciledInventory.count('pickaxe'), 9, 'loaded pickaxes keep their full count');
reconciledInventory.add('pickaxe', 4);
assert.equal(reconciledInventory.count('pickaxe'), 13, 'pickaxes can be added repeatedly');
const crafting = new Crafting(reconciledInventory, items);
assert.ok(crafting.recipes().some((item) => item.id === 'pickaxe'));

// Queue commands retain tap order, replace only the newest waiting command, and
// advance automatically each time the active mining timer finishes.
const timers = [];
globalThis.window = {
  setTimeout(callback) { timers.push(callback); return timers.length; },
  clearTimeout() {},
};
const queueResources = new Map([
  ['1,0', 'stone'], ['2,0', 'copper'], ['3,0', 'fiber'], ['4,0', 'stone'],
]);
const queueMap = {
  scene: null,
  settings: { tileSize: 32 },
  resourceAt(x, y) { return queueResources.get(`${x},${y}`) || null; },
  removeResource(x, y) {
    const key = `${x},${y}`;
    const resource = queueResources.get(key) || null;
    queueResources.delete(key);
    return resource;
  },
};
const queuePlayer = {
  currentTile() { return { x: 0, y: 0 }; },
  moveToNearest(targets) { return targets[0]; },
};
const queueInventory = new Inventory(items);
const queuedMining = new Mining(queueMap, queuePlayer, queueInventory, {
  delayMilliseconds: 1,
  maximumTileDistance: 10,
  pickaxeDelayMultiplier: 0.5,
  actionQueueLimit: 3,
  tapSnapRadiusTiles: 0.6,
  queueMarkerPulseMilliseconds: 180,
  queueMarkerPulseScale: 1.35,
});
queuedMining.queueResource({ x: 1, y: 0 });
queuedMining.queueResource({ x: 2, y: 0 });
queuedMining.queueResource({ x: 3, y: 0 });
queuedMining.queueResource({ x: 4, y: 0 });
assert.deepEqual(queuedMining.queue.map((entry) => entry.key), ['1,0', '2,0', '4,0']);
timers.shift()();
timers.shift()();
timers.shift()();
assert.equal(queuedMining.queue.length, 0);
assert.deepEqual(queueInventory.counts, { stone: 2, copper: 1 });

// Near-miss taps snap to the closest resource, while taps beyond the configured radius do not.
queueResources.set('2,2', 'fiber');
assert.deepEqual(queuedMining.snappedResourceAt(2.95 * 32, 2.5 * 32), { x: 2, y: 2 });
assert.equal(queuedMining.snappedResourceAt(3.11 * 32, 2.5 * 32), null);

// Ground movement pauses without losing commands; resume restarts the uncompleted target.
const pauseTimers = new Map();
let nextTimer = 1;
globalThis.window = {
  setTimeout(callback) { const id = nextTimer; nextTimer += 1; pauseTimers.set(id, callback); return id; },
  clearTimeout(id) { pauseTimers.delete(id); },
};
const pauseMining = new Mining(queueMap, queuePlayer, new Inventory(items), {
  delayMilliseconds: 1,
  maximumTileDistance: 10,
  pickaxeDelayMultiplier: 0.5,
  actionQueueLimit: 3,
  tapSnapRadiusTiles: 0.6,
});
pauseMining.queueResource({ x: 2, y: 2 });
pauseMining.pauseQueue();
assert.equal(pauseMining.paused, true);
assert.deepEqual(pauseMining.queueContents(), ['2,2']);
assert.equal(pauseTimers.size, 0, 'pausing cancels mining in progress');
pauseMining.resumeQueue();
assert.equal(pauseMining.paused, false);
assert.equal(pauseTimers.size, 1, 'resuming restarts the current target');
queueResources.set('4,0', 'stone');
pauseMining.resetQueue({ x: 4, y: 0 });
assert.deepEqual(pauseMining.queueContents(), ['4,0']);
pauseMining.clearQueue();
assert.deepEqual(pauseMining.queueContents(), []);

console.log(`Verified ${mineCount} isolated rewards for each of ${mineableItems.length} resource types.`);
