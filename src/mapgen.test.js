import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TemperateMap } from './mapgen.js';
import { PlayerController } from './player.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const map = Object.create(TemperateMap.prototype);
map.items = items;
map.settings = { tileSize: 32, widthInTiles: 9, heightInTiles: 9 };
map.scene = null;
map.baseTiles = new Map();
map.resourceSprites = new Map();
map.tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({
  terrain: 'terrainWater', resourceItemId: 'stone',
})));

map.placeLandingPod();
const { center, hullTiles, door, floorTiles, objects, spawn } = map.landingPod;
assert.equal(hullTiles.length, 11, 'cornerless border has eleven walls plus its door');
assert.equal(floorTiles.length, 9, 'inner 3x3 is pod floor');
assert.deepEqual(door, { x: center.x, y: center.y + 2 }, 'door is centered on the south side');
assert.equal(map.isWalkable(door.x, door.y), true, 'pod door is passable');
hullTiles.forEach(({ x, y }) => assert.equal(map.isWalkable(x, y), false, 'pod walls are solid'));
objects.forEach((object) => {
  assert.equal(map.isWalkable(object.x, object.y), false, `${object.name} is solid`);
  assert.equal(map.placeBase(object.x, object.y, 'wall'), false, `${object.name} is permanent`);
});
assert.deepEqual(objects.map(({ name }) => name), [
  'Suit Rack', 'Thermal Control', 'High-Capacity Battery', 'Life Support',
]);

const pathfinder = Object.create(PlayerController.prototype);
pathfinder.map = map;
const route = pathfinder.findPath(spawn, center);
assert.ok(route.some((tile) => tile.x === door.x && tile.y === door.y),
  'the interior is reachable only through the door');
assert.deepEqual(map.findWalkableStart(), spawn, 'player starts outside near the door');

for (let y = center.y - 2; y <= center.y + 2; y += 1) {
  for (let x = center.x - 2; x <= center.x + 2; x += 1) {
    assert.equal(map.resourceAt(x, y), null, 'complete 5x5 footprint has no resources');
    assert.equal(map.tiles[y][x].terrain, 'terrainGrass', 'complete footprint is clear land');
  }
}
[...hullTiles, door].forEach(({ x, y }) => {
  assert.equal(map.placeBase(x, y, 'wall'), false, 'pod perimeter cannot be built over');
});

console.log('Verified 5x5 pod perimeter, solid stations, protected fixtures, spawn, and door-only access.');
