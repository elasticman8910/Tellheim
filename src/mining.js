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
    this.completionListeners = [];
    this.mode = settings.defaultMode || 'all';
  }

  onMineComplete(listener) { this.completionListeners.push(listener); }

  onQueueChange(listener) {
    this.queueListeners.push(listener);
  }

  queueContents() {
    return this.queue.map((entry) => entry.key);
  }

  setMode(mode) {
    if (!['all', 'one'].includes(mode)) return false;
    this.mode = mode;
    console.log(`Gather mode: ${mode === 'all' ? 'Gather All' : 'Gather One'}`);
    return true;
  }

  toggleMode() { this.setMode(this.mode === 'all' ? 'one' : 'all'); return this.mode; }

  notifyQueueChange() {
    this.renumberQueueMarkers();
    this.queueListeners.forEach((listener) => listener(this.queue, this.paused));
  }

  // Marker labels always describe the queue as it looks now, not its original numbering.
  renumberQueueMarkers() {
    this.queue.forEach((entry, index) => {
      entry.number = index + 1;
      entry.marker?.setText(`${entry.mode === 'one' ? '\u25cb' : '\u25cf'} ${entry.number}`);
    });
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
      entry.mode = this.mode;
      this.positionMarker(entry);
      this.pulseMarker(entry);
      console.log(`Queue replace: ${oldKey} -> ${tileKey} at position ${replaceIndex + 1}`);
      this.notifyQueueChange();
      return true;
    }

    const entry = {
      tile: { ...tile }, key: tileKey, state: 'waiting', marker: null,
      number: this.queue.length + 1, mode: this.mode, feedback: null,
    };
    this.queue.push(entry);
    this.createMarker(entry);
    console.log(`Queue add: ${itemId} at (${tile.x}, ${tile.y}), position ${this.queue.length}, mode ${entry.mode}`);
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
      this.startMining(entry.tile, () => this.unitFinished(entry));
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
    const entry = this.queue[0];
    this.destroyFeedback(entry);
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
    this.startMining(entry.tile, () => this.unitFinished(entry));
  }

  startMining(tile, onComplete = null) {
    const tileKey = `${tile.x},${tile.y}`;
    const itemId = this.map.resourceAt(tile.x, tile.y);
    if (!itemId) return false;
    // Console output is visible in Eruda and makes the tile-to-reward identity auditable.
    console.log(`Mining tile-id ${tileKey} -> item-id ${itemId}`);
    this.pending.add(tileKey);
    const ownsPickaxe = this.inventory.count('pickaxe') > 0;
    const delay = (this.settings.materials?.[itemId]?.millisecondsPerUnit
      ?? this.settings.delayMilliseconds)
      * (ownsPickaxe ? this.settings.pickaxeDelayMultiplier : 1);
    const entry = this.queue.find((candidate) => candidate.key === tileKey);
    this.createFeedback(entry);
    this.updateFeedback(entry, 0);
    console.log(`Mining started: ${itemId} at (${tile.x}, ${tile.y}), delay ${delay}ms`);
    const startedAt = Date.now();
    if (entry && this.map.scene?.time?.addEvent) {
      entry.progressEvent = this.map.scene.time.addEvent({
        delay: this.settings.progressRefreshMilliseconds, loop: true, callback: () => {
          this.updateFeedback(entry, Math.min(1, (Date.now() - startedAt) / delay));
        },
      });
    }
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.pending.delete(tileKey);
      entry?.progressEvent?.remove?.();
      if (entry) entry.progressEvent = null;
      const minedItem = this.map.mineResourceUnit
        ? this.map.mineResourceUnit(tile.x, tile.y)
        : this.map.removeResource(tile.x, tile.y);
      if (minedItem) {
        this.inventory.add(minedItem);
        const remaining = this.map.resourceNodeAt?.(tile.x, tile.y)?.remainingYield ?? 0;
        console.log(`Mining yield: +1 ${minedItem} at (${tile.x}, ${tile.y}), mode ${entry?.mode || this.mode}, remaining ${remaining}`);
        this.updateFeedback(entry, 1, true);
        this.completionListeners.forEach((listener) => listener({ ...tile, itemId: minedItem }));
      }
      onComplete?.();
    }, delay);
    return true;
  }

  unitFinished(entry) {
    if (!entry || this.queue[0] !== entry) return;
    const hasMore = Boolean(this.map.resourceAt(entry.tile.x, entry.tile.y));
    if (entry.mode === 'all' && hasMore && !this.paused) {
      this.startMining(entry.tile, () => this.unitFinished(entry));
    } else {
      this.completeCurrent(entry);
    }
  }

  completeCurrent(expectedEntry = this.queue[0]) {
    // Ignore a cancelled timer callback instead of completing a newer first target.
    if (!expectedEntry || this.queue[0] !== expectedEntry) return;
    const completed = this.queue.shift();
    completed.marker?.destroy();
    this.destroyFeedback(completed);
    this.renumberQueueMarkers();
    const next = this.queue[0];
    if (next && !this.paused) {
      console.log(`Queue advance: completed ${completed.number} -> starting ${next.number}`);
      this.startCurrent();
    } else {
      console.log(`Queue complete: target ${completed.number} (${completed.key})`);
    }
    this.notifyQueueChange();
  }

  createMarker(entry) {
    const scene = this.map.scene;
    if (!scene?.add?.text) return;
    entry.marker = scene.add.text(0, 0, `${entry.mode === 'one' ? '\u25cb' : '\u25cf'} ${entry.number}`, {
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

  createFeedback(entry) {
    if (!entry || entry.feedback || !this.map.scene?.add?.rectangle) return;
    const size = this.map.settings.tileSize;
    const x = entry.tile.x * size + size / 2;
    const y = entry.tile.y * size;
    const back = this.map.scene.add.rectangle(x, y - 7, size, 5, 0x25333d).setDepth(11);
    const bar = this.map.scene.add.rectangle(x - size / 2, y - 7, size, 5, 0x55cce0)
      .setOrigin(0, 0.5).setDepth(12);
    const label = this.map.scene.add.text(x, y - 13, '', {
      color: '#ffffff', backgroundColor: '#25333dcc', fontFamily: 'sans-serif', fontSize: '12px',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(12);
    entry.feedback = { back, bar, label };
  }

  updateFeedback(entry, progress, pulse = false) {
    if (!entry?.feedback) return;
    entry.feedback.bar.scaleX = progress;
    const node = this.map.resourceNodeAt?.(entry.tile.x, entry.tile.y);
    entry.feedback.label.setText(`${node?.remainingYield ?? 0}/${node?.totalYield ?? 0}`);
    if (pulse) {
      entry.feedback.label.setScale(this.settings.counterPulseScale);
      this.map.scene?.tweens?.add?.({
        targets: entry.feedback.label, scale: 1,
        duration: this.settings.counterPulseMilliseconds,
      });
    }
  }

  destroyFeedback(entry) {
    entry?.progressEvent?.remove?.();
    if (!entry?.feedback) return;
    Object.values(entry.feedback).forEach((object) => object?.destroy?.());
    entry.feedback = null;
  }
}
