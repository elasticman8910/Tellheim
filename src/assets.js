// Turns manifest entries into Phaser textures, whether they use placeholders or real art.
export class AssetRegistry {
  static queueImages(scene, manifest) {
    Object.entries(manifest).forEach(([key, asset]) => {
      if (asset.type === 'image') scene.load.image(key, asset.path);
    });
  }

  static createPlaceholders(scene, manifest) {
    Object.entries(manifest).forEach(([key, asset]) => {
      if (asset.type !== 'generated') return;

      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      const color = Phaser.Display.Color.HexStringToColor(asset.color).color;
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, 0, asset.width, asset.height);
      graphics.generateTexture(key, asset.width, asset.height);
      graphics.destroy();
    });
  }
}
