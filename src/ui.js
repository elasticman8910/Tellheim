// Provides the small HUD button and a full-screen, touch-friendly inventory overlay.
export class GameUI {
  constructor(scene, inventory, items, settings) {
    this.scene = scene;
    this.inventory = inventory;
    this.items = items;
    this.settings = settings;
    this.open = false;
    this.overlayObjects = [];

    this.inventoryButton = scene.add.text(0, 0, 'Inventory', {
      backgroundColor: '#25333d', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '18px',
      align: 'center',
    }).setFixedSize(120, settings.touchTargetSize).setDepth(20).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.inventoryButton.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.showInventory();
    });
    scene.scale.on('resize', () => this.layout());
    inventory.onChange(() => { if (this.open) this.showInventory(); });
    this.layout();
  }

  layout() {
    this.inventoryButton.setPosition(this.settings.screenPadding, this.settings.screenPadding);
    if (this.open) this.showInventory();
  }

  showInventory() {
    this.closeInventory();
    this.open = true;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const padding = this.settings.screenPadding;
    const add = (object) => { this.overlayObjects.push(object); return object; };
    add(this.scene.add.rectangle(0, 0, width, height, 0x162027, 0.98)
      .setOrigin(0).setDepth(30).setScrollFactor(0).setInteractive());
    add(this.scene.add.text(padding, padding, 'Inventory', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '28px', fontStyle: 'bold',
    }).setDepth(31).setScrollFactor(0));

    Object.values(this.items).forEach((item, index) => {
      const y = padding + 64 + index * this.settings.inventoryRowHeight;
      add(this.scene.add.image(padding + 20, y + 20, item.spriteKey)
        .setDisplaySize(40, 40).setDepth(31).setScrollFactor(0));
      add(this.scene.add.text(padding + 52, y + 8, `${item.name}  × ${this.inventory.count(item.id)}`, {
        color: '#ffffff', fontFamily: 'sans-serif', fontSize: '20px',
      }).setDepth(31).setScrollFactor(0));
    });

    const close = add(this.scene.add.text(width / 2, height - padding, 'Close', {
      backgroundColor: '#3e6680', color: '#ffffff', fontFamily: 'sans-serif', fontSize: '20px',
      align: 'center',
    }).setFixedSize(150, this.settings.touchTargetSize).setOrigin(0.5, 1).setDepth(31)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    close.on('pointerup', (_, __, ___, event) => {
      event.stopPropagation();
      this.closeInventory();
    });
  }

  closeInventory() {
    this.overlayObjects.forEach((object) => object.destroy());
    this.overlayObjects = [];
    this.open = false;
  }
}
