// Remember the last resource tap for each mining controller so two quick taps can reset it.
const lastResourceTaps = new WeakMap();
const doubleTapMilliseconds = 300;

// Turns a world tap into a queued resource command or an interrupting ground move.
export function handleWorldTap(worldX, worldY, tileSize, mining, player, tappedAt = Date.now()) {
  const resourceTile = mining.snappedResourceAt(worldX, worldY);
  if (resourceTile) {
    const key = `${resourceTile.x},${resourceTile.y}`;
    const previous = lastResourceTaps.get(mining);
    const isDoubleTap = previous?.key === key
      && tappedAt - previous.tappedAt <= doubleTapMilliseconds;
    lastResourceTaps.set(mining, { key, tappedAt });

    if (isDoubleTap) {
      console.log(`Queue double-tap-reset: ${key}`);
      mining.resetQueue(resourceTile);
      return 'resource-reset';
    }

    const wasPaused = mining.paused;
    mining.queueResource(resourceTile);
    if (wasPaused) {
      console.log(`Queue append-resume: ${key}`);
      mining.resumeQueue('append-resume');
    }
    return 'resource';
  }

  lastResourceTaps.delete(mining);
  // Pause before issuing the manual move so the queue cannot take movement control back.
  mining.pauseQueue();
  player.moveTo({ x: Math.floor(worldX / tileSize), y: Math.floor(worldY / tileSize) });
  return 'ground';
}
