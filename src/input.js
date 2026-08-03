// Turns a world tap into either a fresh resource queue or an interrupting ground move.
export function handleWorldTap(worldX, worldY, tileSize, mining, player) {
  const resourceTile = mining.snappedResourceAt(worldX, worldY);
  if (resourceTile) {
    // A resource tap always replaces a paused queue instead of resuming it.
    mining.resetQueue(resourceTile);
    return 'resource';
  }

  // Pause before issuing the manual move so the queue cannot take movement control back.
  mining.pauseQueue();
  player.moveTo({ x: Math.floor(worldX / tileSize), y: Math.floor(worldY / tileSize) });
  return 'ground';
}
