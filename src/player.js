// Owns the explorer and finds a shortest walkable route to each tapped tile.
export class PlayerController {
  constructor(scene, map, settings) {
    this.scene = scene;
    this.map = map;
    this.settings = settings;
    this.path = [];
    this.destination = null;
    const start = map.findWalkableStart();
    this.sprite = scene.physics.add.image(...this.tileCenter(start), 'player');
    this.sprite.setDisplaySize(settings.width, settings.height).setDepth(2);
    this.sprite.body.setSize(settings.width, settings.height);
    this.sprite.setCollideWorldBounds(true);
  }

  tileCenter(tile) {
    const size = this.map.settings.tileSize;
    return [tile.x * size + size / 2, tile.y * size + size / 2];
  }

  currentTile() {
    const size = this.map.settings.tileSize;
    return { x: Math.floor(this.sprite.x / size), y: Math.floor(this.sprite.y / size) };
  }

  moveTo(target) {
    if (!this.map.isWalkable(target.x, target.y)) {
      this.path = [];
      this.destination = null;
      return false;
    }
    this.path = this.findPath(this.currentTile(), target);
    this.destination = { ...target };
    return this.path.length > 0 || (this.currentTile().x === target.x && this.currentTile().y === target.y);
  }

  moveToNearest(targets) {
    const start = this.currentTile();
    let best = null;

    targets.forEach((target) => {
      if (!this.map.isWalkable(target.x, target.y)) return;
      const path = this.findPath(start, target);
      const alreadyThere = start.x === target.x && start.y === target.y;
      if (!path.length && !alreadyThere) return;
      if (!best || path.length < best.path.length) best = { target, path };
    });

    if (!best) return null;
    this.path = best.path;
    this.destination = { ...best.target };
    return best.target;
  }

  findPath(start, target) {
    const key = ({ x, y }) => `${x},${y}`;
    const queue = [start];
    const previous = new Map([[key(start), null]]);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const current = queue.shift();
      if (current.x === target.x && current.y === target.y) break;
      directions.forEach(([dx, dy]) => {
        const next = { x: current.x + dx, y: current.y + dy };
        if (this.map.isWalkable(next.x, next.y) && !previous.has(key(next))) {
          previous.set(key(next), current);
          queue.push(next);
        }
      });
    }

    if (!previous.has(key(target))) return [];
    const route = [];
    for (let step = target; previous.get(key(step)); step = previous.get(key(step))) route.unshift(step);
    return route;
  }

  update() {
    if (!this.path.length) {
      this.sprite.body.setVelocity(0);
      return;
    }
    // A newly placed wall can invalidate a route that was calculated moments earlier.
    if (!this.map.isWalkable(this.path[0].x, this.path[0].y)) {
      const destination = this.destination;
      if (!destination || !this.moveTo(destination)) {
        this.path = [];
        this.sprite.body.setVelocity(0);
        return;
      }
    }
    const [targetX, targetY] = this.tileCenter(this.path[0]);
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, targetX, targetY);
    if (distance < 3) {
      this.sprite.setPosition(targetX, targetY);
      this.path.shift();
      return;
    }
    this.scene.physics.moveTo(this.sprite, targetX, targetY, this.settings.moveSpeedPixelsPerSecond);
  }
}
