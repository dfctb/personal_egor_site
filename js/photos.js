import { createPhotoCamera } from "./widgets/photo_camera.js";

createPhotoCamera("photo-camera-widget");

const container = document.getElementById("photo-container");
const yearFilter = document.getElementById("year-filter");
const sortBtn = document.getElementById("sort-btn");
const lightboxOverlay = document.getElementById("lightbox-overlay");
const lightboxImage = lightboxOverlay.querySelector(".lightbox-image");
const closeBtn = lightboxOverlay.querySelector(".lightbox-close");

let photosData = [];
let sortAscending = false;

async function loadPhotosData() {
  try {
    const response = await fetch("../js/photos-data.json");
    photosData = await response.json();

    populateYearFilter();
    applyFiltersAndSort();
  } catch (error) {
    console.error("Ошибка загрузки photos-data.json:", error);
    container.innerHTML =
      '<div class="loading-text">Error: Run dev-tools/generate-photos-db.js</div>';
  }
}

function populateYearFilter() {
  const years = [...new Set(photosData.map((photo) => photo.year))].sort(
    (a, b) => b - a,
  );
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
}

function applyFiltersAndSort() {
  const selectedYear = yearFilter.value;

  let filtered = photosData.filter((photo) => {
    return selectedYear === "all" || photo.year === selectedYear;
  });

  filtered.sort((a, b) => {
    return sortAscending ? a.year - b.year : b.year - a.year;
  });

  renderPhotos(filtered);
}

function renderPhotos(photosToRender) {
  container.innerHTML = "";

  if (photosToRender.length === 0) {
    container.innerHTML = '<div class="loading-text">No photos found</div>';
    return;
  }

  photosToRender.forEach((photo) => {
    const item = document.createElement("div");
    item.className = "art-item"; // Используем тот же класс для единого стиля сетки
    item.dataset.year = photo.year;

    item.innerHTML = `
            <img src="${photo.src}" alt="${photo.title}" class="art-image" loading="lazy">
            <span class="date-label">Year: ${photo.year}</span>
        `;
    container.appendChild(item);
  });
}

// Event Listeners
yearFilter.addEventListener("change", () => {
  yearFilter.blur();
  applyFiltersAndSort();
});

sortBtn.addEventListener("click", () => {
  sortAscending = !sortAscending;
  sortBtn.textContent = sortAscending
    ? "Sort: Oldest first ▼"
    : "Sort: Newest first ▼";
  applyFiltersAndSort();
});

// Lightbox (делегирование)
container.addEventListener("click", (e) => {
  if (e.target.classList.contains("art-image")) {
    lightboxImage.src = e.target.src;
    lightboxOverlay.classList.remove("lightbox-hidden");
    requestAnimationFrame(() => {
      lightboxOverlay.classList.add("lightbox-active");
    });
    document.body.style.overflow = "hidden";
  }
});

function closeLightbox() {
  lightboxOverlay.classList.remove("lightbox-active");
  setTimeout(() => {
    lightboxOverlay.classList.add("lightbox-hidden");
    document.body.style.overflow = "";
    lightboxImage.src = "";
  }, 300);
}

closeBtn.addEventListener("click", closeLightbox);
lightboxOverlay.addEventListener("click", (e) => {
  if (e.target === lightboxOverlay) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    !lightboxOverlay.classList.contains("lightbox-hidden")
  ) {
    closeLightbox();
  }
});
lightboxImage.addEventListener("dragstart", (e) => e.preventDefault());

loadPhotosData();
