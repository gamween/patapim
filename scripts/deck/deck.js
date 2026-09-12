const slides = [...document.querySelectorAll(".slide")];
const notesData = JSON.parse(document.querySelector("#notes-data").textContent);
const prev = document.querySelector("#prev");
const next = document.querySelector("#next");
const notesButton = document.querySelector("#notes");
const overviewButton = document.querySelector("#overview");
const panel = document.querySelector("#notes-panel");
let current = 0;
let overview = false;
function resize() {
  document.documentElement.style.setProperty(
    "--zoom",
    Math.min(innerWidth / 1280, Math.max(120, innerHeight - 60) / 720),
  );
  const columns = innerWidth <= 700 ? 1 : 2;
  document.documentElement.style.setProperty(
    "--overview-zoom",
    (innerWidth - 48 - (columns - 1) * 24) / columns / 1280,
  );
}
function show(index, updateHash = true) {
  current = Math.max(
    0,
    Math.min(slides.length - 1, Number.isFinite(index) ? index : 0),
  );
  slides.forEach((slide, i) => {
    slide.hidden = i !== current;
    slide.classList.toggle("active", i === current);
    slide.classList.toggle("current", i === current);
  });
  document.querySelector("#count").innerHTML =
    `<strong>${String(current + 1).padStart(2, "0")}</strong> / ${String(slides.length).padStart(2, "0")}`;
  document.querySelector(".progress").style.width =
    `${((current + 1) / slides.length) * 100}%`;
  document.querySelector("#speaker-copy").textContent = notesData[current].note;
  document.querySelector("#speaker-time").textContent =
    `${notesData[current].time} · ${notesData[current].tag}`;
  prev.disabled = current === 0;
  next.disabled = current === slides.length - 1;
  if (updateHash) history.replaceState(null, "", `#${current + 1}`);
  if (!overview) scrollTo(0, 0);
}
function toggleNotes() {
  panel.hidden = !panel.hidden;
  notesButton.setAttribute("aria-pressed", String(!panel.hidden));
}
function toggleOverview(force) {
  overview = typeof force === "boolean" ? force : !overview;
  document.body.classList.toggle("overview", overview);
  overviewButton.setAttribute("aria-pressed", String(overview));
  resize();
  if (overview) slides[current].scrollIntoView({ block: "center" });
  else scrollTo(0, 0);
}
prev.addEventListener("click", () => show(current - 1));
next.addEventListener("click", () => show(current + 1));
notesButton.addEventListener("click", toggleNotes);
document.querySelector("#close-notes").addEventListener("click", toggleNotes);
overviewButton.addEventListener("click", () => toggleOverview());
document
  .querySelector("#print")
  .addEventListener("click", () => window.print());
document.querySelector("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* Presentation remains usable when fullscreen is unavailable. */
  }
});
slides.forEach((slide, i) =>
  slide.addEventListener("click", (event) => {
    if (overview && !event.target.closest("a,button")) {
      toggleOverview(false);
      show(i);
    }
  }),
);
document.addEventListener("keydown", (event) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.isContentEditable ||
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
  )
    return;
  const key = event.key;
  if (
    ["ArrowRight", "PageDown"].includes(key) ||
    (key === " " && !event.target.closest("button,a"))
  ) {
    event.preventDefault();
    show(current + 1);
  } else if (["ArrowLeft", "PageUp"].includes(key)) {
    event.preventDefault();
    show(current - 1);
  } else if (key === "Home") {
    event.preventDefault();
    show(0);
  } else if (key === "End") {
    event.preventDefault();
    show(slides.length - 1);
  } else if (key.toLowerCase() === "n") toggleNotes();
  else if (key.toLowerCase() === "o") toggleOverview();
  else if (key === "Escape") {
    if (overview) toggleOverview(false);
    if (!panel.hidden) toggleNotes();
  }
});
window.addEventListener("resize", resize);
window.addEventListener("hashchange", () =>
  show((Number(location.hash.slice(1)) || 1) - 1, false),
);
resize();
show((Number(location.hash.slice(1)) || 1) - 1);
