document.documentElement.classList.add("js");

const modelOptions = document.querySelectorAll(".model-option");
const carouselModels = document.querySelectorAll(".carousel-model");
const stageName = document.querySelector(".stage-name");
const stageNumber = document.querySelector(".stage-number");
const modelSelection = document.querySelector(".model-selection");
const modelDetail = document.querySelector(".model-detail");
const modelViews = document.querySelector(".model-views");
const modelMaterials = document.querySelector(".model-materials");
const detailTitle = document.querySelector("#detail-title");
const detailModel = document.querySelector(".detail-model");
const detailModelImage = document.querySelector(".detail-model-image");
const viewModel = document.querySelector(".view-model-3d");
const viewModelImage = document.querySelector(".view-model-image");
const viewWireframe = document.querySelector(".view-wireframe-3d");
const viewWireframeImage = document.querySelector(".view-wireframe-image");
const detailBack = document.querySelector(".detail-back");
const wireframeToggle = document.querySelector(".wireframe-toggle");
const hero = document.querySelector(".hero");
let pageScrollLocked = false;
let touchStartY = 0;
let goToPage = null;

const animateElementScrollTo = (element, target) => {
  const start = element.scrollTop;
  const distance = target - start;
  const duration = 1200;
  const startTime = performance.now();

  return new Promise((resolve) => {
    const step = () => {
      const now = performance.now();
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      element.scrollTop = start + distance * eased;

      if (progress >= 1) {
        window.clearInterval(animation);
        element.scrollTop = target;
        resolve();
      }
    };

    const animation = window.setInterval(step, 16);
  });
};

function updateCarousel(index) {
  carouselModels.forEach((model) => {
    const modelIndex = Number(model.dataset.index);
    const distance = (modelIndex - index + modelOptions.length) % modelOptions.length;
    model.src = modelOptions[modelIndex].dataset.image;
    model.className = "carousel-model";
    model.classList.add(distance === 0 ? "is-center" : distance === 1 ? "is-right" : "is-left");
    model.alt = `${modelOptions[modelIndex].dataset.model} model preview`;
  });
}

function highlightModel(option, highlighted) {
  option.classList.toggle("is-active", highlighted);
}

function selectModel(option, index) {
  modelOptions.forEach((item) => {
    item.setAttribute("aria-pressed", String(item === option));
  });

  stageName.textContent = option.dataset.model;
  stageNumber.textContent = `${String(index + 1).padStart(2, "0")} / 03`;
  detailTitle.textContent = option.dataset.model;
  const isScythe = /\.(glb|gltf)$/i.test(option.dataset.image);
  if (isScythe) {
    detailModel.src = option.dataset.image;
    viewModel.src = option.dataset.image;
    viewWireframe.src = option.dataset.wireframe;
  }
  detailModel.alt = `${option.dataset.model} model`;
  detailModelImage.src = option.dataset.image;
  detailModelImage.alt = `${option.dataset.model} model`;
  detailModel.dataset.modelImage = option.dataset.image;
  detailModel.dataset.wireframeImage = option.dataset.wireframe;
  viewModel.alt = `${option.dataset.model} rendered view`;
  viewModelImage.src = option.dataset.image;
  viewModelImage.alt = `${option.dataset.model} rendered view`;
  viewWireframe.alt = `${option.dataset.model} wireframe view`;
  viewWireframeImage.src = option.dataset.wireframe;
  viewWireframeImage.alt = `${option.dataset.model} wireframe view`;
  detailModel.classList.toggle("is-hidden", !isScythe);
  detailModelImage.classList.toggle("is-hidden", isScythe);
  viewModel.classList.toggle("is-hidden", !isScythe);
  viewModelImage.classList.toggle("is-hidden", isScythe);
  viewWireframe.classList.toggle("is-hidden", !isScythe);
  viewWireframeImage.classList.toggle("is-hidden", isScythe);
  detailModel.classList.toggle("is-star", index === 1);
  detailModel.classList.toggle("is-thinking", index === 2);
  wireframeToggle?.setAttribute("aria-pressed", "false");

  updateCarousel(index);
}

modelOptions.forEach((option, index) => {
  option.addEventListener("mouseenter", () => {
    highlightModel(option, true);
    updateCarousel(index);
  });
  option.addEventListener("mouseleave", () => highlightModel(option, false));
  option.addEventListener("focus", () => {
    highlightModel(option, true);
    selectModel(option, index);
  });
  option.addEventListener("click", () => {
    selectModel(option, index);
    pageScrollLocked = false;
    if (modelDetail) modelDetail.scrollTop = 0;
    document.body.classList.add("is-detail-active");
  });
});

selectModel(modelOptions[0], 0);

let rotation = 0;
let dragStartX = 0;
let rotationStart = 0;

detailModel?.addEventListener("pointerdown", (event) => {
  detailModel.classList.add("is-dragging");
  detailModel.setPointerCapture(event.pointerId);
  dragStartX = event.clientX;
  rotationStart = rotation;
});

detailModel?.addEventListener("pointermove", (event) => {
  if (!detailModel.classList.contains("is-dragging")) return;
  rotation = rotationStart + (event.clientX - dragStartX) * .65;
  const facing = Math.cos(rotation * Math.PI / 180);
  detailModel.style.transform = `rotateY(${rotation}deg) scaleX(${Math.max(.16, Math.abs(facing))})`;
});

detailModel?.addEventListener("pointerup", () => detailModel.classList.remove("is-dragging"));
detailModel?.addEventListener("pointercancel", () => detailModel.classList.remove("is-dragging"));
detailBack?.addEventListener("click", () => {
  document.body.classList.remove("is-detail-active");
  modelSelection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

modelDetail?.addEventListener("wheel", (event) => {
  if (!document.body.classList.contains("is-detail-active")) return;
  event.preventDefault();

  if (pageScrollLocked || !modelViews) return;

  const pageStops = [0, modelViews.offsetTop];
  if (modelMaterials) pageStops.push(modelMaterials.offsetTop);
  const currentStop = pageStops.reduce((closest, stop, index) => {
    return Math.abs(modelDetail.scrollTop - stop) < Math.abs(modelDetail.scrollTop - pageStops[closest]) ? index : closest;
  }, 0);
  const nextStop = event.deltaY > 0
    ? pageStops[Math.min(currentStop + 1, pageStops.length - 1)]
    : pageStops[Math.max(currentStop - 1, 0)];
  const target = nextStop === pageStops[currentStop] ? null : nextStop;

  if (target === null) return;
  pageScrollLocked = true;
  animateElementScrollTo(modelDetail, target).then(() => {
    pageScrollLocked = false;
  });
}, { passive: false });

wireframeToggle?.addEventListener("click", () => {
  const showingWireframe = wireframeToggle.getAttribute("aria-pressed") === "true";
  wireframeToggle.setAttribute("aria-pressed", String(!showingWireframe));
  detailModelImage.src = showingWireframe
    ? detailModel.dataset.modelImage
    : detailModel.dataset.wireframeImage;
  detailModelImage.classList.toggle("is-wireframe", !showingWireframe);
});

if (hero && modelSelection && modelDetail) {
  let transitionFrame;

  const updatePageTransition = () => {
    transitionFrame = undefined;
    const progress = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
    hero.style.setProperty("--page-transition", progress.toFixed(3));
    modelSelection.style.setProperty("--page-transition", progress.toFixed(3));
  };

  window.addEventListener("scroll", () => {
    if (transitionFrame === undefined) {
      transitionFrame = window.requestAnimationFrame(updatePageTransition);
    }
  }, { passive: true });

  updatePageTransition();

  const animateScrollTo = (target) => {
    const start = window.scrollY;
    const distance = target - start;
    const duration = 1200;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        window.scrollTo(0, start + distance * eased);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          window.scrollTo(0, target);
          resolve();
        }
      };

      window.requestAnimationFrame(step);
    });
  };

  goToPage = (page) => {
    if (pageScrollLocked) return;

    pageScrollLocked = true;
    animateScrollTo(page.offsetTop).then(() => {
      pageScrollLocked = false;
    });
  };

  window.addEventListener("wheel", (event) => {
    if (pageScrollLocked) {
      event.preventDefault();
      return;
    }

    if (Math.abs(event.deltaY) < 8) return;

    const atHome = window.scrollY <= 2;
    const atModels = window.scrollY >= modelSelection.offsetTop - 2;
    const atDetail = document.body.classList.contains("is-detail-active");

    if (event.deltaY > 0 && atHome) {
      event.preventDefault();
      goToPage(modelSelection);
    } else if (event.deltaY > 0 && atModels) {
      event.preventDefault();
      return;
    } else if (event.deltaY < 0 && atDetail) {
      event.preventDefault();
      return;
    } else if (event.deltaY < 0 && atModels) {
      event.preventDefault();
      goToPage(hero);
    }
  }, { passive: false });

  window.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    const atDetail = window.scrollY >= modelDetail.offsetTop - 2;
    const movingUp = event.touches[0].clientY > touchStartY;
    if (atDetail && movingUp) event.preventDefault();
  }, { passive: false });

  window.addEventListener("touchend", (event) => {
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    const atHome = window.scrollY <= 2;
    const atModels = window.scrollY >= modelSelection.offsetTop - 2;
    const atDetail = document.body.classList.contains("is-detail-active");

    if (Math.abs(swipeDistance) < 30) return;
    if (swipeDistance > 0 && atHome) goToPage(modelSelection);
    if (swipeDistance > 0 && atModels) return;
    if (swipeDistance < 0 && atDetail) return;
    if (swipeDistance < 0 && atModels) goToPage(hero);
  }, { passive: true });
}
