document.documentElement.classList.add("js");

const modelOptions = document.querySelectorAll(".model-option");
const carouselModels = document.querySelectorAll(".carousel-model");
const stageName = document.querySelector(".stage-name");
const stageNumber = document.querySelector(".stage-number");
const modelSelection = document.querySelector(".model-selection");
const modelDetail = document.querySelector(".model-detail");
const detailTitle = document.querySelector("#detail-title");
const detailModel = document.querySelector(".detail-model");
const detailBack = document.querySelector(".detail-back");
const wireframeToggle = document.querySelector(".wireframe-toggle");
const hero = document.querySelector(".hero");
let pageScrollLocked = false;
let touchStartY = 0;
let goToPage = null;

function selectModel(option, index) {
  modelOptions.forEach((item) => {
    const selected = item === option;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });

  stageName.textContent = option.dataset.model;
  stageNumber.textContent = `${String(index + 1).padStart(2, "0")} / 03`;
  detailTitle.textContent = option.dataset.model;
  detailModel.src = option.dataset.image;
  detailModel.alt = `${option.dataset.model} model`;
  detailModel.dataset.modelImage = option.dataset.image;
  detailModel.dataset.wireframeImage = option.dataset.wireframe;
  detailModel.classList.toggle("is-star", index === 1);
  detailModel.classList.toggle("is-thinking", index === 2);
  detailModel.classList.remove("is-wireframe");
  wireframeToggle?.setAttribute("aria-pressed", "false");

  carouselModels.forEach((model) => {
    const modelIndex = Number(model.dataset.index);
    const distance = (modelIndex - index + modelOptions.length) % modelOptions.length;
    model.className = "carousel-model";
    model.classList.add(distance === 0 ? "is-center" : distance === 1 ? "is-right" : "is-left");
    model.alt = `${modelOptions[modelIndex].dataset.model} model preview`;
  });
}

modelOptions.forEach((option, index) => {
  option.addEventListener("mouseenter", () => selectModel(option, index));
  option.addEventListener("focus", () => selectModel(option, index));
  option.addEventListener("click", () => {
    selectModel(option, index);
    modelDetail?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  modelSelection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

wireframeToggle?.addEventListener("click", () => {
  const showingWireframe = wireframeToggle.getAttribute("aria-pressed") === "true";
  wireframeToggle.setAttribute("aria-pressed", String(!showingWireframe));
  detailModel.src = showingWireframe
    ? detailModel.dataset.modelImage
    : detailModel.dataset.wireframeImage;
  detailModel.classList.toggle("is-wireframe", !showingWireframe);
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
    const atModels = window.scrollY >= modelSelection.offsetTop - 2 && window.scrollY < modelDetail.offsetTop - 2;
    const atDetail = window.scrollY >= modelDetail.offsetTop - 2;

    if (event.deltaY > 0 && atHome) {
      event.preventDefault();
      goToPage(modelSelection);
    } else if (event.deltaY > 0 && atModels) {
      event.preventDefault();
      return;
    } else if (event.deltaY < 0 && atDetail) {
      event.preventDefault();
      goToPage(modelSelection);
    } else if (event.deltaY < 0 && atModels) {
      event.preventDefault();
      goToPage(hero);
    }
  }, { passive: false });

  window.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchend", (event) => {
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    const atHome = window.scrollY <= 2;
    const atModels = window.scrollY >= modelSelection.offsetTop - 2 && window.scrollY < modelDetail.offsetTop - 2;
    const atDetail = window.scrollY >= modelDetail.offsetTop - 2;

    if (Math.abs(swipeDistance) < 30) return;
    if (swipeDistance > 0 && atHome) goToPage(modelSelection);
    if (swipeDistance > 0 && atModels) return;
    if (swipeDistance < 0 && atDetail) goToPage(modelSelection);
    if (swipeDistance < 0 && atModels) goToPage(hero);
  }, { passive: true });
}
