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
      if (asset.borderColor && asset.borderWidth) {
        const borderColor = Phaser.Display.Color.HexStringToColor(asset.borderColor).color;
        graphics.lineStyle(asset.borderWidth, borderColor, 1);
        const inset = asset.borderWidth / 2;
        graphics.strokeRect(inset, inset, asset.width - asset.borderWidth, asset.height - asset.borderWidth);
      }
      graphics.generateTexture(key, asset.width, asset.height);
      graphics.destroy();
    });
  }
}
