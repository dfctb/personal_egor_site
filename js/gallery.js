const container = document.getElementById('art-container')
const CATEGORY = container ? container.dataset.category : null // arts, photos, graphic_art, render_art, covers

const yearFilter = document.getElementById('year-filter')
const sortBtn = document.getElementById('sort-btn')
const lightboxOverlay = document.getElementById('lightbox-overlay')
const lightboxImage = document.getElementById('lightbox-image')
const closeBtn = document.getElementById('lightbox-close')

let items = []
let sortAscending = false

// "19122024.png" -> 19.12.2024 (если даты в имени нет, вернёт null)
function extractDate (filename) {
  const m = (filename || '').match(/(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/)
  if (!m) return null
  const day = +m[1], mon = +m[2], year = +m[3]
  const d = new Date(year, mon - 1, day)
  const valid = year >= 2000 && year <= 2035 &&
    d.getMonth() === mon - 1 && d.getDate() === day
  return valid ? d : null
}

async function load () {
  if (!container || !CATEGORY) return
  try {
    const res = await fetch(`/js/json/${CATEGORY}-data.json`)
    const raw = await res.json()
    items = raw.map((it) => {
      const d = it.date ? new Date(it.date) : extractDate(it.filename)
      return {
        ...it,
        parsedDate: d,
        yearStr: d ? String(d.getFullYear()) : 'Unknown',
        dateStr: d
          ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).
            padStart(2, '0')}.${d.getFullYear()}`
          : '',
      }
    })
    populateYears()
    render()
  } catch (e) {
    console.error(`Не удалось загрузить ${CATEGORY}-data.json:`, e)
    container.innerHTML = '<li class="loading-text">Error: run dev-tools/generate-db.js</li>'
  }
}

function populateYears () {
  if (!yearFilter) return
  const years = [...new Set(items.map((i) => i.yearStr))].filter(
    (y) => y !== 'Unknown').sort((a, b) => b - a)
  // если годов нет вообще (нет дат в именах файлов), прячем фильтр
  if (!years.length) {
    yearFilter.style.display = 'none'
    return
  }
  years.forEach((y) => {
    const o = document.createElement('option')
    o.value = y
    o.textContent = y
    yearFilter.appendChild(o)
  })
}

function render () {
  const year = yearFilter ? yearFilter.value : 'all'
  const list = items.filter((i) => year === 'all' || i.yearStr === year).
    sort((a, b) => {
      const da = a.parsedDate || new Date(0)
      const db = b.parsedDate || new Date(0)
      return sortAscending ? da - db : db - da
    })

  container.innerHTML = ''
  if (!list.length) {
    container.innerHTML = '<li class="loading-text">Nothing found</li>'
    return
  }

  const frag = document.createDocumentFragment()
  list.forEach((it, idx) => {
    const li = document.createElement('li')
    li.className = 'art-item'

    const webpName = it.filename.replace(/\.\w+$/, '.webp')
    const full = encodeURI(`/assets/images/${CATEGORY}/large/${webpName}`)
    const thumb = encodeURI(`/assets/images/${CATEGORY}/thumbs/${webpName}`)
    const n = String(idx + 1).padStart(2, '0')

    // подпись показываем, только если она есть в JSON (пригодится для обложек)
    const caption = it.caption
      ? `<div class="video-title">${it.caption}</div>`
      : ''
    const date = it.dateStr
      ? `<span class="date-label">Date: ${it.dateStr}</span>`
      : ''

    li.innerHTML = `
      <span class="idx">[${n}]</span>
      <div class="entry-content">
        <img src="${thumb}" data-full="${full}" alt="${it.title || CATEGORY}" class="art-image" loading="lazy">
        ${caption}
        ${date}
      </div>`
    frag.appendChild(li)
  })
  container.appendChild(frag)
}

if (yearFilter) yearFilter.addEventListener('change', () => {
  yearFilter.blur()
  render()
})

if (sortBtn) {
  sortBtn.addEventListener('click', () => {
    sortAscending = !sortAscending
    sortBtn.textContent = sortAscending
      ? 'Sort: Oldest first ▲'
      : 'Sort: Newest first ▼'
    sortBtn.blur()
    render()
  })
}

// ---- лайтбокс ----
if (container && lightboxOverlay && lightboxImage) {
  container.addEventListener('click', (e) => {
    if (!e.target.classList.contains('art-image')) return
    lightboxImage.src = e.target.dataset.full
    lightboxOverlay.classList.remove('lightbox-hidden')
    requestAnimationFrame(
      () => lightboxOverlay.classList.add('lightbox-active'))
    document.body.style.overflow = 'hidden'
  })

  const close = () => {
    lightboxOverlay.classList.remove('lightbox-active')
    setTimeout(() => {
      lightboxOverlay.classList.add('lightbox-hidden')
      document.body.style.overflow = ''
      lightboxImage.src = ''
    }, 300)
  }

  if (closeBtn) closeBtn.addEventListener('click', close)
  lightboxOverlay.addEventListener('click',
    (e) => { if (e.target === lightboxOverlay) close() })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' &&
      !lightboxOverlay.classList.contains('lightbox-hidden')) close()
  })
  lightboxImage.addEventListener('dragstart', (e) => e.preventDefault())
}

load()