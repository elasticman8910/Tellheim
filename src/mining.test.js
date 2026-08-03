import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Crafting } from './crafting.js';
import { TemperateMap } from './mapgen.js';
import { Mining } from './mining.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const mineableItems = Object.values(items).filter((item) => item.mineable === true);

// Exercise every configured raw-resource tile through the real mining completion path.
for (const expectedItem of mineableItems) {
  const inventory = {
    granted: [],
    add(itemId) { this.granted.push(itemId); },
    count() { return 0; },
  };
  const map = Object.create(TemperateMap.prototype);
  map.items = items;
  map.tiles = [[{ resource: expectedItem.id }]];
  map.resourceSprites = new Map();

  const mining = new Mining(map, {}, inventory, {
    delayMilliseconds: 0,
    maximumTileDistance: 1,
    pickaxeDelayMultiplier: 0.5,
  });
  const originalSetTimeout = globalThis.window;
  globalThis.window = { setTimeout(callback) { callback(); } };
  assert.equal(map.resourceTypeAt(0, 0), expectedItem.spriteKey);
  mining.startMining({ x: 0, y: 0 }, map.resourceAt(0, 0));
  globalThis.window = originalSetTimeout;

  assert.deepEqual(inventory.granted, [expectedItem.id]);
}

assert.ok(mineableItems.length > 0, 'at least one mineable resource must be configured');
assert.ok(mineableItems.every((item) => item.recipe === null));

const invalidMap = Object.create(TemperateMap.prototype);
invalidMap.items = items;
invalidMap.tiles = [[{ resource: 'copperIngot' }]];
assert.equal(invalidMap.resourceAt(0, 0), null, 'crafted items cannot resolve as mining rewards');

const pickaxeInventory = { count: (itemId) => (itemId === 'pickaxe' ? 1 : 0) };
assert.ok(!new Crafting(pickaxeInventory, items).recipes().some((item) => item.id === 'pickaxe'));
console.log(`Verified mining rewards for ${mineableItems.length} resource types.`);
