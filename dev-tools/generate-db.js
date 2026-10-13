const fs = require('fs')
const path = require('path')
const exifr = require('exifr')

const ALL = ['arts', 'graphic_art', 'photos', 'render_art', 'covers']
const args = process.argv.slice(2)
const folders = args.length ? args : ALL

fs.mkdirSync(path.join('js', 'json'), { recursive: true })

function dateFromName (f) {
  const m = f.match(/(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/)   // ровно 8 цифр подряд
  if (!m) return null
  const day = +m[1], mon = +m[2], year = +m[3]
  const d = new Date(year, mon - 1, day)
  const valid = year >= 2000 && year <= 2035 &&
    d.getMonth() === mon - 1 && d.getDate() === day
  return valid ? d : null                                    // мусор отбрасываем
}

async function getDate (file, filename) {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])
    const d = exif && (exif.DateTimeOriginal || exif.CreateDate)
    if (d instanceof Date && !isNaN(d)) return d
  } catch (e) {}
  return dateFromName(filename) || fs.statSync(file).mtime
}

(async () => {
  for (const name of folders) {
    const dir = path.join('assets', 'images', name)
    if (!fs.existsSync(dir)) {
      console.log('нет папки, пропускаю:', name)
      continue
    }

    // читаем старый JSON, чтобы не потерять подписи (caption) и свои правки
    const jsonPath = path.join('js', 'json', `${name}-data.json`)
    let old = {}
    if (fs.existsSync(jsonPath)) {
      try {
        for (const o of JSON.parse(
          fs.readFileSync(jsonPath, 'utf8'))) old[o.filename] = o
      } catch (e) {}
    }

    const files = fs.readdirSync(dir).
      filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    const data = []
    for (const f of files) {
      const d = await getDate(path.join(dir, f), f)
      data.push({
        ...(old[f] || {}),
        id: (old[f] && old[f].id) || path.parse(f).name.replace(/\s+/g, '_'),
        title: (old[f] && old[f].title) || path.parse(f).name,
        src: `/assets/images/${name}/${f}`,
        filename: f,
        date: d.toISOString(),
      })
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))
    console.log(`${name}: ${data.length} файлов`)
  }
})()