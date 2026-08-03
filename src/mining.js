// Runs tapped resource targets in order, walking into range before mining each one.
export class Mining {
  constructor(map, player, inventory, settings) {
    this.map = map;
    this.player = player;
    this.inventory = inventory;
    this.settings = settings;
    this.pending = new Set();
    this.queue = [];
    this.timer = null;
  }

  queueResource(tile) {
    const itemId = this.map.resourceAt(tile.x, tile.y);
    if (!itemId) return false;
    const tileKey = `${tile.x},${tile.y}`;
    const existing = this.queue.find((entry) => entry.key === tileKey);
    if (existing) {
      this.pulseMarker(existing);
      return true;
    }

    if (this.queue.length >= this.settings.actionQueueLimit) {
      // The first command is already underway; the latest waiting command is replaced.
      const replaceIndex = this.queue.length - 1;
      const entry = this.queue[replaceIndex];
      const oldKey = entry.key;
      entry.tile = { ...tile };
      entry.key = tileKey;
      this.positionMarker(entry);
      this.pulseMarker(entry);
      console.log(`Queue replace: ${oldKey} -> ${tileKey} at position ${replaceIndex + 1}`);
      return true;
    }

    const entry = { tile: { ...tile }, key: tileKey, state: 'waiting', marker: null };
    this.queue.push(entry);
    this.createMarker(entry);
    console.log(`Queue add: ${itemId} at (${tile.x}, ${tile.y}), position ${this.queue.length}`);
    if (this.queue.length === 1) this.startCurrent();
    return true;
  }

  startCurrent() {
    const entry = this.queue[0];
    if (!entry) return;
    const itemId = this.map.resourceAt(entry.tile.x, entry.tile.y);
    if (!itemId) {
      this.completeCurrent();
      return;
    }

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - entry.tile.x) + Math.abs(playerTile.y - entry.tile.y);
    if (distance <= this.settings.maximumTileDistance) {
      this.startMining(entry.tile, () => this.completeCurrent());
      entry.state = 'mining';
      return;
    }

    const tile = entry.tile;
    const destinations = [
      tile,
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    const destination = this.player.moveToNearest(destinations);
    if (!destination) {
      console.log(`No walkable route to resource at (${tile.x}, ${tile.y})`);
      this.completeCurrent();
      return;
    }

    entry.state = 'approaching';
    console.log(`Moving to mine ${itemId} at (${tile.x}, ${tile.y})`);
  }

  clearQueue() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
    this.queue.forEach((entry) => entry.marker?.destroy());
    this.queue = [];
    console.log('Queue clear');
  }

  update() {
    const entry = this.queue[0];
    if (!entry || entry.state !== 'approaching') return;
    const itemId = this.map.resourceAt(entry.tile.x, entry.tile.y);
    if (!itemId) {
      this.completeCurrent();
      return;
    }

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - entry.tile.x)
      + Math.abs(playerTile.y - entry.tile.y);
    if (distance > this.settings.maximumTileDistance) return;

    entry.state = 'mining';
    this.startMining(entry.tile, () => this.completeCurrent());
  }

  startMining(tile, onComplete = null) {
    const tileKey = `${tile.x},${tile.y}`;
    const itemId = this.map.resourceAt(tile.x, tile.y);
    if (!itemId) return false;
    // Console output is visible in Eruda and makes the tile-to-reward identity auditable.
    console.log(`Mining tile-id ${tileKey} -> item-id ${itemId}`);
    this.pending.add(tileKey);
    const ownsPickaxe = this.inventory.count('pickaxe') > 0;
    const delay = this.settings.delayMilliseconds
      * (ownsPickaxe ? this.settings.pickaxeDelayMultiplier : 1);
    console.log(`Mining started: ${itemId} at (${tile.x}, ${tile.y}), delay ${delay}ms`);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.pending.delete(tileKey);
      const minedItem = this.map.removeResource(tile.x, tile.y);
      if (minedItem) {
        this.inventory.add(minedItem);
        console.log(`Mining completed: ${minedItem} at (${tile.x}, ${tile.y})`);
      }
      onComplete?.();
    }, delay);
    return true;
  }

  completeCurrent() {
    const completed = this.queue.shift();
    if (!completed) return;
    completed.marker?.destroy();
    console.log(`Queue complete: ${completed.key}`);
    this.queue.forEach((entry, index) => {
      entry.marker?.setText(String(index + 1));
    });
    this.startCurrent();
  }

  createMarker(entry) {
    const scene = this.map.scene;
    if (!scene?.add?.text) return;
    entry.marker = scene.add.text(0, 0, String(this.queue.length), {
      backgroundColor: '#25333d', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      fontStyle: 'bold', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(10);
    this.positionMarker(entry);
  }

  positionMarker(entry) {
    if (!entry.marker) return;
    const size = this.map.settings.tileSize;
    entry.marker.setPosition(entry.tile.x * size + size / 2, entry.tile.y * size + size / 2);
  }

  pulseMarker(entry) {
    if (!entry.marker) return;
    entry.marker.setScale(this.settings.queueMarkerPulseScale);
    this.map.scene.tweens.add({
      targets: entry.marker,
      scale: 1,
      duration: this.settings.queueMarkerPulseMilliseconds,
    });
  }
}
