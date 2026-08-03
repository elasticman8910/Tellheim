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
    this.paused = false;
    this.queueListeners = [];
    this.nextTargetNumber = 1;
  }

  onQueueChange(listener) {
    this.queueListeners.push(listener);
  }

  queueContents() {
    return this.queue.map((entry) => entry.key);
  }

  notifyQueueChange() {
    this.queueListeners.forEach((listener) => listener(this.queue, this.paused));
  }

  // A near miss still selects a resource when it falls within the configured radius.
  snappedResourceAt(worldX, worldY) {
    const size = this.map.settings.tileSize;
    const tapX = worldX / size;
    const tapY = worldY / size;
    const radius = this.settings.tapSnapRadiusTiles;
    let nearest = null;
    for (let y = Math.floor(tapY - radius); y <= Math.floor(tapY + radius); y += 1) {
      for (let x = Math.floor(tapX - radius); x <= Math.floor(tapX + radius); x += 1) {
        if (!this.map.resourceAt(x, y)) continue;
        const distance = Math.hypot(tapX - (x + 0.5), tapY - (y + 0.5));
        if (distance <= radius && (!nearest || distance < nearest.distance)) {
          nearest = { x, y, distance };
        }
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  resetQueue(tile) {
    const oldContents = this.queueContents();
    this.clearQueue(false);
    console.log(`Queue reset: [${oldContents.join(', ')}] -> [${tile.x},${tile.y}]`);
    this.queueResource(tile);
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
      this.notifyQueueChange();
      return true;
    }

    const entry = {
      tile: { ...tile }, key: tileKey, state: 'waiting', marker: null,
      number: this.nextTargetNumber,
    };
    this.nextTargetNumber += 1;
    this.queue.push(entry);
    this.createMarker(entry);
    console.log(`Queue add: ${itemId} at (${tile.x}, ${tile.y}), position ${this.queue.length}`);
    if (this.queue.length === 1 && !this.paused) this.startCurrent();
    this.notifyQueueChange();
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
      entry.state = 'mining';
      this.startMining(entry.tile, () => this.completeCurrent(entry));
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

  stopCurrent() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
  }

  pauseQueue() {
    if (!this.queue.length || this.paused) return false;
    this.stopCurrent();
    this.paused = true;
    this.queue[0].state = 'waiting';
    this.queue.forEach((entry) => entry.marker?.setAlpha(0.45));
    console.log(`Queue pause: [${this.queueContents().join(', ')}]`);
    this.notifyQueueChange();
    return true;
  }

  resumeQueue(source = 'resume-button') {
    if (!this.queue.length || !this.paused) return false;
    this.paused = false;
    this.queue.forEach((entry) => entry.marker?.setAlpha(1));
    console.log(`Queue ${source}: [${this.queueContents().join(', ')}]`);
    this.startCurrent();
    this.notifyQueueChange();
    return true;
  }

  clearQueue(log = true) {
    const contents = this.queueContents();
    this.stopCurrent();
    this.queue.forEach((entry) => entry.marker?.destroy());
    this.queue = [];
    this.paused = false;
    this.nextTargetNumber = 1;
    if (log) console.log(`Queue clear: [${contents.join(', ')}]`);
    this.notifyQueueChange();
  }

  cancelQueue() {
    console.log(`Queue cancel: [${this.queueContents().join(', ')}]`);
    this.clearQueue(false);
  }

  update() {
    const entry = this.queue[0];
    if (!entry || entry.state !== 'approaching') return;
    const itemId = this.map.resourceAt(entry.tile.x, entry.tile.y);
    if (!itemId) {
      this.completeCurrent(entry);
      return;
    }

    const playerTile = this.player.currentTile();
    const distance = Math.abs(playerTile.x - entry.tile.x)
      + Math.abs(playerTile.y - entry.tile.y);
    if (distance > this.settings.maximumTileDistance) return;

    entry.state = 'mining';
    this.startMining(entry.tile, () => this.completeCurrent(entry));
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

  completeCurrent(expectedEntry = this.queue[0]) {
    // Ignore a cancelled timer callback instead of completing a newer first target.
    if (!expectedEntry || this.queue[0] !== expectedEntry) return;
    const completed = this.queue.shift();
    completed.marker?.destroy();
    const next = this.queue[0];
    if (next && !this.paused) {
      console.log(`Queue advance: completed ${completed.number} -> starting ${next.number}`);
      this.startCurrent();
    } else {
      console.log(`Queue complete: target ${completed.number} (${completed.key})`);
      if (!next) this.nextTargetNumber = 1;
    }
    this.notifyQueueChange();
  }

  createMarker(entry) {
    const scene = this.map.scene;
    if (!scene?.add?.text) return;
    entry.marker = scene.add.text(0, 0, String(entry.number), {
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
