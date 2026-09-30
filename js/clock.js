// live clock in the status bar, no seconds ticking sound obviously, just text
function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  el.textContent =
    `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
});
