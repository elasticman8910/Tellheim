import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Building } from './building.js';
import { Crafting } from './crafting.js';
import { Inventory } from './inventory.js';
import { TemperateMap } from './mapgen.js';
import { PlayerController } from './player.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const inventory = new Inventory(items, { stoneSlab: 2, copperIngot: 1 });
const crafting = new Crafting(inventory, items);
assert.equal(crafting.craft('wall'), true, 'a wall can be crafted from intermediate materials');
assert.equal(inventory.count('wall'), 1);

// A small open map makes the route around the center wall unambiguous.
const map = Object.create(TemperateMap.prototype);
map.items = items;
map.settings = { tileSize: 32 };
map.scene = null;
map.baseTiles = new Map();
map.tiles = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({
  terrain: 'terrainGrass', resourceItemId: null,
})));
const player = { currentTile: () => ({ x: 0, y: 1 }) };
const building = new Building(map, player, inventory, items);

building.setActive(true);
assert.equal(building.select('wall'), true);
assert.equal(building.handleTap(1.5 * 32, 1.5 * 32), 'placed');
assert.equal(inventory.count('wall'), 0, 'placement consumes one wall');
assert.equal(map.baseAt(1, 1), 'wall', 'the map records the occupied tile');
assert.equal(map.isWalkable(1, 1), false, 'walls block movement');

const pathfinder = Object.create(PlayerController.prototype);
pathfinder.map = map;
const route = pathfinder.findPath({ x: 0, y: 1 }, { x: 2, y: 1 });
assert.equal(route.length, 4, 'pathfinding routes around the wall');
assert.ok(!route.some(({ x, y }) => x === 1 && y === 1));

assert.equal(building.handleTap(1.5 * 32, 1.5 * 32), 'removed');
assert.equal(inventory.count('wall'), 1, 'removal refunds the wall');
assert.equal(map.baseAt(1, 1), null, 'removal clears the occupied tile');
assert.equal(map.isWalkable(1, 1), true);

console.log('Verified craft, placement, collision, rerouting, removal, and refund.');
