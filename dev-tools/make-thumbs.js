const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const src = "assets/images/arts";
const out = "assets/images/arts/thumbs";
fs.mkdirSync(out, { recursive: true });

for (const f of fs.readdirSync(src)) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue;
  sharp(path.join(src, f))
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(out, f.replace(/\.\w+$/, ".webp")));
}
