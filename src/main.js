import { TemperateMap } from './mapgen.js';
import { PlayerController } from './player.js';
import { DebugToggle } from './debug.js';
import { AssetRegistry } from './assets.js';

class TemperateScene extends Phaser.Scene {
  constructor() { super('temperate'); }

  preload() {
    this.load.json('assets', 'assets/manifest.json');
    this.load.json('balance', 'config/balance.json');
    this.load.once('filecomplete-json-assets', (_, __, manifest) => {
      AssetRegistry.queueImages(this, manifest);
    });
  }

  create() {
    const balance = this.cache.json.get('balance');
    AssetRegistry.createPlaceholders(this, this.cache.json.get('assets'));
    this.debugToggle = new DebugToggle(balance.debug);
    this.map = new TemperateMap(this, balance.map);
    this.map.create();
    this.player = new PlayerController(this, this.map, balance.player);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#202820');

    this.input.on('pointerup', (pointer) => {
      console.log(`Tap at screen (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`);
      this.debugToggle.recordTap(pointer);
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const size = balance.map.tileSize;
      this.player.moveTo({ x: Math.floor(world.x / size), y: Math.floor(world.y / size) });
    });
    console.log(`Tellheim booted: Temperate seed "${balance.map.seed}"`);
  }

  update() { this.player.update(); }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#202820',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: TemperateScene,
  render: { pixelArt: true, antialias: false },
});

window.addEventListener('error', (event) => console.error('Tellheim error:', event.error || event.message));
window.tellheimGame = game;
