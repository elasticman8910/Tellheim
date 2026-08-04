// Finds airtight rooms and owns oxygen, suffocation, and respawning.
export class OxygenSystem {
  constructor(scene, map, player, settings) {
    this.scene = scene;
    this.map = map;
    this.player = player;
    this.settings = settings;
    this.oxygen = settings.capacitySeconds;
    this.health = player.settings.healthCapacity;
    this.regions = [];
    this.tileRegions = new Map();
    this.tintSprites = [];
    this.listeners = [];
    this.state = null;
    this.recompute();
  }

  onChange(listener) { this.listeners.push(listener); }

  notify() { this.listeners.forEach((listener) => listener(this)); }

  isSealTile(x, y) {
    const part = this.map.baseAt(x, y);
    return part === 'wall' || part === 'door';
  }

  // Flood every open tile. A component is airtight only when it never touches an edge.
  findRegions() {
    const width = this.map.settings.widthInTiles || this.map.tiles[0].length;
    const height = this.map.settings.heightInTiles || this.map.tiles.length;
    const visited = new Set();
    const regions = [];
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const startKey = `${x},${y}`;
      if (visited.has(startKey) || this.isSealTile(x, y)) continue;
      const tiles = [];
      const queue = [{ x, y }];
      let reachesEdge = false;
      visited.add(startKey);
      while (queue.length) {
        const tile = queue.shift();
        tiles.push(tile);
        if (tile.x === 0 || tile.y === 0 || tile.x === width - 1 || tile.y === height - 1) reachesEdge = true;
        directions.forEach(([dx, dy]) => {
          const next = { x: tile.x + dx, y: tile.y + dy };
          const key = `${next.x},${next.y}`;
          if (next.x >= 0 && next.y >= 0 && next.x < width && next.y < height
            && !visited.has(key) && !this.isSealTile(next.x, next.y)) {
            visited.add(key);
            queue.push(next);
          }
        });
      }
      if (!reachesEdge) {
        regions.push({
          tiles,
          hasGenerator: tiles.some((tile) => this.map.baseAt(tile.x, tile.y) === 'oxygenGenerator'),
        });
      }
    }
    return regions;
  }

  recompute(change = null) {
    const oldKeys = new Set(this.regions.map((region) => region.tiles.map(({ x, y }) => `${x},${y}`).sort().join('|')));
    const next = this.findRegions();
    const nextKeys = new Set(next.map((region) => region.tiles.map(({ x, y }) => `${x},${y}`).sort().join('|')));
    next.forEach((region) => {
      const key = region.tiles.map(({ x, y }) => `${x},${y}`).sort().join('|');
      if (!oldKeys.has(key)) console.log(`Oxygen seal: region size ${region.tiles.length}`);
    });
    this.regions.forEach((region) => {
      const key = region.tiles.map(({ x, y }) => `${x},${y}`).sort().join('|');
      if (!nextKeys.has(key)) console.log(`Oxygen unseal${change?.action === 'remove' ? ' (breach)' : ''}: region size ${region.tiles.length}`);
    });
    this.regions = next;
    this.tileRegions.clear();
    next.forEach((region) => region.tiles.forEach(({ x, y }) => this.tileRegions.set(`${x},${y}`, region)));
    this.redrawTint();
  }

  redrawTint() {
    this.tintSprites.forEach((sprite) => sprite.destroy());
    this.tintSprites = [];
    if (!this.scene?.add?.image) return;
    const size = this.map.settings.tileSize;
    this.regions.forEach((region) => region.tiles.forEach(({ x, y }) => {
      this.tintSprites.push(this.scene.add.image(x * size + size / 2, y * size + size / 2, 'sealedTint')
        .setAlpha(0.18).setDepth(0.5));
    }));
  }

  oxygenState() {
    const tile = this.player.currentTile();
    const pod = this.map.landingPod;
    const atPod = pod && Math.abs(tile.x - pod.x) + Math.abs(tile.y - pod.y) <= 1;
    const region = this.tileRegions.get(`${tile.x},${tile.y}`);
    if (atPod) return 'pod-refill';
    if (region?.hasGenerator) return 'room-refill';
    if (region) return 'sealed-drain';
    return 'outdoor-drain';
  }

  update(deltaSeconds) {
    const state = this.oxygenState();
    if (state !== this.state) {
      console.log(`Oxygen state: ${this.state || 'start'} -> ${state}`);
      this.state = state;
      this.player.sprite?.setTexture?.(state.endsWith('refill') ? 'playerNoHelmet' : 'player');
    }
    if (state.endsWith('refill')) this.oxygen += this.settings.refillPerSecond * deltaSeconds;
    else this.oxygen -= (state === 'sealed-drain' ? this.settings.sealedDrainPerSecond
      : this.settings.outdoorDrainPerSecond) * deltaSeconds;
    this.oxygen = Math.max(0, Math.min(this.settings.capacitySeconds, this.oxygen));
    if (this.oxygen === 0) this.health -= this.settings.healthDrainPerSecond * deltaSeconds;
    if (this.health <= 0) {
      console.log('Oxygen death: respawning at landing pod with inventory intact');
      this.player.respawn();
      this.health = this.player.settings.healthCapacity;
      this.oxygen = this.settings.capacitySeconds;
    }
    this.notify();
  }
}
