const root = document.documentElement;
const btn = document.getElementById("theme-toggle");

function apply(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch (e) {}
  if (btn) btn.textContent = theme === "dark" ? "[ light ]" : "[ dark ]";
}

apply(root.dataset.theme || "light");
if (btn) btn.addEventListener("click", () =>
  apply(root.dataset.theme === "dark" ? "light" : "dark"));

document.querySelectorAll("[data-year]").forEach(el => {
  el.textContent = new Date().getFullYear();
});
