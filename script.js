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
const detailInstruction = document.querySelector(".detail-instruction");
const wireframeToggle = document.querySelector(".wireframe-toggle");
const hero = document.querySelector(".hero");
const isModelFile = (src) => /\.(glb|gltf)$/i.test(src);

// Browsers block fetching model files from file:// pages, so fall back to the embedded copy there.
const resolveModelSrc = (src) => (location.protocol === "file:" && window.EMBEDDED_MODELS?.[src]) || src;

const setModelSrc = (viewer, src) => {
  const resolved = resolveModelSrc(src);
  if (viewer.getAttribute("src") !== resolved) viewer.setAttribute("src", resolved);
};

const wireframeColor = { r: 1, g: 223 / 255, b: 62 / 255 };

function setModelWireframe(viewer, enabled) {
  viewer.dataset.wireframe = String(enabled);
  const sceneKey = Object.getOwnPropertySymbols(viewer).find((key) => key.description === "scene");
  const scene = sceneKey && viewer[sceneKey];
  if (!scene || !viewer.loaded) return;

  scene.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material.userData.original) {
        material.userData.original = {
          color: material.color?.clone(),
          emissive: material.emissive?.clone(),
          metalness: material.metalness,
          roughness: material.roughness,
        };
      }
      const original = material.userData.original;
      material.wireframe = enabled;
      if (enabled) {
        material.color?.setRGB(0, 0, 0);
        material.emissive?.setRGB(wireframeColor.r, wireframeColor.g, wireframeColor.b);
        material.metalness = 0;
        material.roughness = 1;
      } else {
        if (original.color) material.color.copy(original.color);
        if (original.emissive) material.emissive.copy(original.emissive);
        material.metalness = original.metalness;
        material.roughness = original.roughness;
      }
      material.needsUpdate = true;
    });
  });
  scene.queueRender?.();
}

document.querySelectorAll("model-viewer").forEach((viewer) => {
  setModelSrc(viewer, viewer.getAttribute("src"));
  viewer.addEventListener("load", () => setModelWireframe(viewer, viewer.dataset.wireframe === "true"));
  viewer.addEventListener("error", (event) => console.error("Model failed to load:", viewer.getAttribute("src"), event.detail));
});

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
    const image = modelOptions[modelIndex].dataset.image;
    if (model.tagName === "MODEL-VIEWER") {
      if (isModelFile(image)) setModelSrc(model, image);
    } else {
      model.src = image;
    }
    model.className = "carousel-model";
    model.classList.add(distance === 0 ? "is-center" : distance === 1 ? "is-right" : "is-left");
    model.setAttribute("alt", `${modelOptions[modelIndex].dataset.model} model preview`);
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
  const is3D = isModelFile(option.dataset.image);
  if (is3D) {
    setModelSrc(detailModel, option.dataset.image);
    setModelSrc(viewModel, option.dataset.image);
    setModelSrc(viewWireframe, option.dataset.wireframe);
    detailModel.setAttribute("alt", `${option.dataset.model} model`);
    viewModel.setAttribute("alt", `${option.dataset.model} rendered view`);
    viewWireframe.setAttribute("alt", `${option.dataset.model} wireframe view`);
    setModelWireframe(detailModel, false);
    setModelWireframe(viewWireframe, true);
  } else {
    detailModelImage.src = option.dataset.image;
    detailModelImage.alt = `${option.dataset.model} model`;
    viewModelImage.src = option.dataset.image;
    viewModelImage.alt = `${option.dataset.model} rendered view`;
    viewWireframeImage.src = option.dataset.wireframe;
    viewWireframeImage.alt = `${option.dataset.model} wireframe view`;
  }
  detailModelImage.dataset.modelImage = option.dataset.image;
  detailModelImage.dataset.wireframeImage = option.dataset.wireframe;
  detailModel.classList.toggle("is-hidden", !is3D);
  detailModelImage.classList.toggle("is-hidden", is3D);
  viewModel.classList.toggle("is-hidden", !is3D);
  viewModelImage.classList.toggle("is-hidden", is3D);
  viewWireframe.classList.toggle("is-hidden", !is3D);
  viewWireframeImage.classList.toggle("is-hidden", is3D);
  detailModelImage.classList.toggle("is-star", index === 1);
  detailModelImage.classList.toggle("is-thinking", index === 2);
  detailModelImage.classList.remove("is-wireframe");
  rotation = 0;
  detailModelImage.style.transform = "";
  if (detailInstruction) {
    detailInstruction.textContent = is3D
      ? "Drag to rotate the model. Scroll over it to zoom in and out."
      : "Drag the model left or right to rotate it.";
  }
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
    resetModelZoom();
    pageScrollLocked = false;
    if (modelDetail) modelDetail.scrollTop = 0;
    document.body.classList.add("is-detail-active");
  });
});

let rotation = 0;
let dragStartX = 0;
let rotationStart = 0;

selectModel(modelOptions[0], 0);

// Flat images fake rotation by squashing; 3D models orbit with model-viewer's camera controls.
detailModelImage?.addEventListener("pointerdown", (event) => {
  detailModelImage.classList.add("is-dragging");
  detailModelImage.setPointerCapture(event.pointerId);
  dragStartX = event.clientX;
  rotationStart = rotation;
});

detailModelImage?.addEventListener("pointermove", (event) => {
  if (!detailModelImage.classList.contains("is-dragging")) return;
  rotation = rotationStart + (event.clientX - dragStartX) * .65;
  const facing = Math.cos(rotation * Math.PI / 180);
  detailModelImage.style.transform = `rotateY(${rotation}deg) scaleX(${Math.max(.16, Math.abs(facing))})`;
});

detailModelImage?.addEventListener("pointerup", () => detailModelImage.classList.remove("is-dragging"));
detailModelImage?.addEventListener("pointercancel", () => detailModelImage.classList.remove("is-dragging"));
detailBack?.addEventListener("click", () => {
  document.body.classList.remove("is-detail-active");
  modelSelection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Scrolling over the 3D model zooms it: up zooms in, down zooms back out. Once it is fully
// zoomed out, a fresh scroll down moves on to the next page as normal.
const minModelZoom = 0.3;
const zoomGestureGap = 400;
let modelZoom = 1;
let lastZoomWheel = 0;

function applyModelZoom() {
  const orbit = detailModel.getCameraOrbit?.();
  if (!orbit) return;
  detailModel.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${(modelZoom * 135).toFixed(1)}%`;
}

function resetModelZoom() {
  modelZoom = 1;
  if (detailModel.loaded) applyModelZoom();
}

function handleModelZoom(event) {
  const overModel = !detailModel.classList.contains("is-hidden")
    && event.target instanceof Element
    && event.target.closest(".detail-model");
  if (!overModel || modelDetail.scrollTop > 2) return false;

  // event.timeStamp is when the scroll happened, so a busy frame cannot split one gesture in two.
  const now = event.timeStamp;
  const sameGesture = now - lastZoomWheel < zoomGestureGap;
  const zoomingOut = event.deltaY > 0;

  // Fully zoomed out: let a new scroll down change page, but swallow the tail of the zoom-out gesture.
  if (zoomingOut && modelZoom >= 1 && !sameGesture) return false;

  lastZoomWheel = now;
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
  modelZoom = Math.min(1, Math.max(minModelZoom, modelZoom * Math.exp(delta * 0.0015)));
  applyModelZoom();
  return true;
}

modelDetail?.addEventListener("wheel", (event) => {
  if (!document.body.classList.contains("is-detail-active")) return;
  event.preventDefault();

  if (pageScrollLocked || !modelViews) return;
  if (handleModelZoom(event)) return;

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
  if (!detailModel.classList.contains("is-hidden")) {
    setModelWireframe(detailModel, !showingWireframe);
    return;
  }
  detailModelImage.src = showingWireframe
    ? detailModelImage.dataset.modelImage
    : detailModelImage.dataset.wireframeImage;
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
