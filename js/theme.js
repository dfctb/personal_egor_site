(() => {
  const THEMES = ['valve', 'light', 'dark']
  const DEFAULT = 'dark'          // <- тема по умолчанию
  const root = document.documentElement
  const btn = document.getElementById('theme-toggle')

  function getSaved () {
    let t
    try { t = localStorage.getItem('theme') } catch (e) {}
    return THEMES.includes(t) ? t : DEFAULT
  }

  function apply (t, save) {
    root.dataset.theme = t
    if (save) { try { localStorage.setItem('theme', t) } catch (e) {} }
    if (btn) btn.textContent = `[ theme: ${t} ]`
  }

  apply(getSaved(), false)         // при загрузке ничего не сохраняем

  if (btn) {
    btn.addEventListener('click', () => {
      const next = THEMES[(THEMES.indexOf(root.dataset.theme) + 1) %
      THEMES.length]
      apply(next, true)            // сохраняем только выбор пользователя
    })
  }
})()