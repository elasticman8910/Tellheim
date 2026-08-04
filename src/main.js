import { TemperateMap } from './mapgen.js';
import { PlayerController } from './player.js';
import { DebugToggle } from './debug.js';
import { AssetRegistry } from './assets.js';
import { Inventory } from './inventory.js';
import { Mining } from './mining.js';
import { GameUI } from './ui.js';
import { Crafting } from './crafting.js';
import { handleWorldTap } from './input.js';
import { Building } from './building.js';

class TemperateScene extends Phaser.Scene {
  constructor() { super('temperate'); }

  preload() {
    this.load.json('assets', 'assets/manifest.json');
    this.load.json('balance', 'config/balance.json');
    this.load.json('items', 'config/items.json');
    this.load.once('filecomplete-json-assets', (_, __, manifest) => {
      AssetRegistry.queueImages(this, manifest);
    });
  }

  create() {
    const balance = this.cache.json.get('balance');
    const items = this.cache.json.get('items');
    AssetRegistry.createPlaceholders(this, this.cache.json.get('assets'));
    this.debugToggle = new DebugToggle(balance.debug);
    this.map = new TemperateMap(this, balance.map, items);
    this.map.create();
    this.player = new PlayerController(this, this.map, balance.player);
    this.inventory = new Inventory(items);
    this.crafting = new Crafting(this.inventory, items);
    this.mining = new Mining(this.map, this.player, this.inventory, balance.mining);
    this.building = new Building(this.map, this.player, this.inventory, items);
    this.ui = new GameUI(
      this, this.inventory, this.crafting, items, balance.ui, this.mining, this.building,
    );
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#202820');

    this.input.on('pointerup', (pointer) => {
      console.log(`Tap at screen (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`);
      this.debugToggle.recordTap(pointer);
      if (this.ui.open) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.building.active) {
        this.building.handleTap(world.x, world.y);
        return;
      }
      handleWorldTap(world.x, world.y, balance.map.tileSize, this.mining, this.player);
    });
    console.log(`Tellheim booted: Temperate seed "${balance.map.seed}"`);
  }

  update() {
    this.player.update();
    this.mining.update();
  }
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
