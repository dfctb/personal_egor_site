(function () {
  const TYPE_MS = 110, ERASE_MS = 70, HOLD_FULL = 2500, HOLD_EMPTY = 700;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // фразы грузим один раз на страницу
  let phrasesPromise;
  const getPhrases = () =>
    (phrasesPromise ||= fetch("/js/json/phrases.json").then((r) => r.json()).catch(() => ({})));

  // случайная фраза, не повторяющая предыдущую
  function pick(list, prev) {
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    let s;
    do { s = list[Math.floor(Math.random() * list.length)]; } while (s === prev);
    return s;
  }

  async function run(el) {
    const fallback = el.dataset.text || el.textContent.trim();
    const loop = el.dataset.loop !== "false";
    const list = el.dataset.phrases ? (await getPhrases())[el.dataset.phrases] : null;
    el.textContent = "";
    let prev = null;

    while (true) {
      const text = pick(list, prev) || fallback;
      prev = text;

      el.classList.add("typing");
      for (let i = 1; i <= text.length; i++) {
        el.textContent = text.slice(0, i);
        await wait(TYPE_MS * (list ? 0.5 : 1) + Math.random() * 70);
      }
      el.classList.remove("typing");
      if (!loop) return;
      await wait(HOLD_FULL);

      el.classList.add("typing");
      for (let i = text.length - 1; i >= 0; i--) {
        el.textContent = text.slice(0, i);
        await wait(ERASE_MS / (list ? 2 : 1));
      }
      el.classList.remove("typing");
      await wait(HOLD_EMPTY);
    }
  }

  document.querySelectorAll(".typewriter").forEach(run);
})();
