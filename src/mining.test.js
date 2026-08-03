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
globalThis.window = { setTimeout(callback) { callback(); } };

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
assert.equal(reconciledInventory.count('pickaxe'), 1, 'loaded pickaxes are reconciled to maxCount');
reconciledInventory.add('pickaxe', 4);
assert.equal(reconciledInventory.count('pickaxe'), 1, 'pickaxe additions are capped at maxCount');
const crafting = new Crafting(reconciledInventory, items);
assert.ok(!crafting.recipes().some((item) => item.id === 'pickaxe'));
assert.equal(crafting.canCraft(items.pickaxe.recipe), false);

console.log(`Verified ${mineCount} isolated rewards for each of ${mineableItems.length} resource types.`);
