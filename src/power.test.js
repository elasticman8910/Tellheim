import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DayNightCycle } from './daynight.js';
import { PowerGrid } from './power.js';

const balance = JSON.parse(await readFile(new URL('../config/balance.json', import.meta.url)));

function makeGrid() {
  const cycle = new DayNightCycle(null, balance.dayNight);
  const grid = new PowerGrid(cycle, balance.power);
  grid.registerConsumer('lifeSupport', balance.power.consumerDrawPerSecond.lifeSupport);
  grid.registerConsumer('suitRack', balance.power.consumerDrawPerSecond.suitRack);
  return { cycle, grid };
}

const daytime = makeGrid();
const dayStart = daytime.grid.battery;
daytime.grid.update(10);
assert.ok(daytime.grid.battery > dayStart, 'surplus solar generation charges the battery by day');

const nighttime = makeGrid();
nighttime.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
assert.equal(nighttime.cycle.phase, 'night');
assert.equal(nighttime.grid.generationPerSecond(), 0, 'solar generation is zero at night');
const nightStart = nighttime.grid.battery;
nighttime.grid.update(10);
assert.ok(nighttime.grid.battery < nightStart, 'registered consumers drain the battery at night');

console.log('Verified daytime charging, nighttime drain, and zero nighttime generation.');

// An empty, overloaded grid drops heaters, then the rack, then life support.
const overloaded = makeGrid();
overloaded.grid.consumers.clear();
overloaded.grid.battery = 0;
overloaded.cycle.update(balance.dayNight.dayDurationSeconds + balance.dayNight.duskDurationSeconds);
const transitions = [];
[
  ['heater:1,1', 'heater'], ['suitRack', 'suitRack'], ['lifeSupport:2,2', 'lifeSupport'],
].forEach(([id, type]) => overloaded.grid.registerConsumer(id, {
  drawPerSecond: 2, type, onPowerChange: (powered) => transitions.push(`${id}:${powered}`),
}));
overloaded.grid.update(1);
assert.deepEqual(transitions, [
  'heater:1,1:false', 'suitRack:false', 'lifeSupport:2,2:false',
], 'overload shutdown follows configured low-to-high priority');
assert.equal(overloaded.grid.brownout, true);

// A charged battery restores the most important devices first (reverse shutdown order).
transitions.length = 0;
overloaded.grid.battery = balance.power.batteryCapacity;
overloaded.grid.update(1);
assert.deepEqual(transitions, [
  'lifeSupport:2,2:true', 'suitRack:true', 'heater:1,1:true',
], 'recovery restarts devices in reverse order');
assert.equal(overloaded.grid.brownout, false);

const expanded = makeGrid();
const podGeneration = expanded.grid.generationPerSecond();
expanded.grid.setSolarPanels(1);
assert.equal(expanded.grid.generationPerSecond(),
  podGeneration + balance.power.solarPanelGenerationPerSecond,
  'one outdoor panel adds its configured daytime generation');

console.log('Verified priority brownouts, reverse recovery, and solar grid expansion.');
