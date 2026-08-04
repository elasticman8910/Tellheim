import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OxygenSystem } from './oxygen.js';
import { DayNightCycle } from './daynight.js';
import { PowerGrid } from './power.js';
import { TemperateMap } from './mapgen.js';

const items = JSON.parse(await readFile(new URL('../config/items.json', import.meta.url)));
const balance = JSON.parse(await readFile(new URL('../config/balance.json', import.meta.url)));

function testWorld(size = 9) {
  const map = Object.create(TemperateMap.prototype);
  map.items = items;
  map.settings = { tileSize: 32, widthInTiles: size, heightInTiles: size };
  map.scene = null;
  map.baseTiles = new Map();
  map.resourceSprites = new Map();
  map.tiles = Array.from({ length: size }, () => Array.from({ length: size }, () => ({
    terrain: 'terrainGrass', resourceItemId: null,
  })));
  const player = {
    tile: { x: 0, y: 0 }, settings: balance.player,
    currentTile() { return this.tile; }, respawn() { this.tile = { ...map.landingPod.spawn }; },
    sprite: { setTexture() {} },
  };
  return { map, player };
}

function enclose(map, min, max) {
  for (let coordinate = min; coordinate <= max; coordinate += 1) {
    map.baseTiles.set(`${coordinate},${min}`, { itemId: 'wall' });
    map.baseTiles.set(`${coordinate},${max}`, { itemId: 'wall' });
    map.baseTiles.set(`${min},${coordinate}`, { itemId: 'wall' });
    map.baseTiles.set(`${max},${coordinate}`, { itemId: 'wall' });
  }
}

// A sealed player-built box without life support drains exactly like outdoors.
const plain = testWorld(7);
enclose(plain.map, 1, 5);
plain.player.tile = { x: 3, y: 3 };
const plainOxygen = new OxygenSystem(null, plain.map, plain.player, balance.oxygen);
assert.equal(plainOxygen.regions.length, 1, 'closed box is sealed');
plainOxygen.oxygen = 100;
plainOxygen.update(1);
assert.equal(plainOxygen.oxygen, 100 - balance.oxygen.outdoorDrainPerSecond,
  'a sealed room without life support drains at the outside rate');

// A crafted Life Support Unit supplies its sealed region.
plain.map.baseTiles.set('3,3', { itemId: 'lifeSupportUnit' });
plainOxygen.recompute({ action: 'place', itemId: 'lifeSupportUnit' });
plainOxygen.oxygen = 100;
plainOxygen.update(1);
assert.equal(plainOxygen.oxygen, 100 + balance.oxygen.refillPerSecond,
  'crafted Life Support Unit refills a player-built sealed room');

// The pod is a sealed room with built-in life support, and the rack works independently.
const pod = testWorld();
pod.map.placeLandingPod();
pod.player.tile = { ...pod.map.landingPod.center };
const podOxygen = new OxygenSystem(null, pod.map, pod.player, balance.oxygen);
assert.equal(podOxygen.tileRegions.has(`${pod.player.tile.x},${pod.player.tile.y}`), true,
  'pod interior registers as sealed');
podOxygen.oxygen = 100;
podOxygen.update(1);
assert.equal(podOxygen.oxygen, 100 + balance.oxygen.refillPerSecond,
  'pod Life Support refills the interior');

const rack = pod.map.landingPod.objects.find((object) => object.id === 'suitRack');
pod.player.tile = { x: rack.x, y: rack.y + 1 };
podOxygen.oxygen = 100;
podOxygen.update(1);
assert.equal(podOxygen.oxygen, 100 + balance.oxygen.refillPerSecond,
  'standing adjacent to the Suit Rack refills even outside the pod seal');

console.log('Verified oxygen drain parity, pod and crafted life support, and Suit Rack adjacency.');

// Powered room air drains slowly during a life-support brownout and refills after recovery.
const powered = testWorld(7);
enclose(powered.map, 1, 5);
powered.map.baseTiles.set('2,2', { itemId: 'lifeSupportUnit' });
powered.player.tile = { x: 3, y: 3 };
const cycle = new DayNightCycle(null, balance.dayNight);
cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
const grid = new PowerGrid(cycle, balance.power);
grid.battery = 0;
const poweredOxygen = new OxygenSystem(null, powered.map, powered.player, balance.oxygen,
  grid, balance.power.consumerDrawPerSecond);
grid.update(1);
poweredOxygen.oxygen = 100;
poweredOxygen.update(1);
assert.equal(poweredOxygen.oxygen, 100 - balance.oxygen.unpoweredRoomDrainPerSecond,
  'unpowered sealed life support uses the slow room-air drain');
grid.battery = balance.power.batteryCapacity;
grid.update(1);
poweredOxygen.update(1);
assert.equal(poweredOxygen.oxygen,
  100 - balance.oxygen.unpoweredRoomDrainPerSecond + balance.oxygen.refillPerSecond,
  'restored life support refills room oxygen again');

console.log('Verified slow room-air loss and refill after life-support recovery.');
