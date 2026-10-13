const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ALL = ['arts', 'graphic_art', 'photos', 'render_art', 'covers']
const args = process.argv.slice(2)
const folders = args.length ? args : ALL

const VERSIONS = [
  { dir: 'thumbs', size: 800, quality: 80 },
  { dir: 'large', size: 3000, quality: 85 },
];

(async () => {
  for (const name of folders) {
    const src = path.join('assets', 'images', name)
    if (!fs.existsSync(src)) {
      console.log('нет папки, пропускаю:', name)
      continue
    }

    for (const v of VERSIONS) fs.mkdirSync(path.join(src, v.dir),
      { recursive: true })

    for (const f of fs.readdirSync(src)) {
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue

      for (const v of VERSIONS) {
        const dest = path.join(src, v.dir, f.replace(/\.\w+$/, '.webp'))
        if (fs.existsSync(dest)) continue
        try {
          await sharp(path.join(src, f), { limitInputPixels: false }).
            rotate().
            resize({
              width: v.size,
              height: v.size,
              fit: 'inside',
              withoutEnlargement: true,
            }).
            webp({ quality: v.quality }).
            toFile(dest)
          console.log('ok:', `${name}/${v.dir}/${f}`)
        } catch (e) {
          console.log('ОШИБКА:', `${name}/${f}`, '-', e.message)
        }
      }
    }
  }
  console.log('готово')
})()