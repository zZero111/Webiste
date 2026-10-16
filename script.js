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
// Page 4: the model from fixed angles (front, back and three-quarter views of each).
const angleGrids = document.querySelectorAll(".angle-grid");
const angleViews = document.querySelectorAll(".view-angle");
const viewModelImage = document.querySelector(".view-model-image");
const viewWireframeImage = document.querySelector(".view-wireframe-image");
const detailBack = document.querySelector(".detail-back");
const wireframeToggle = document.querySelector(".wireframe-toggle");
const hero = document.querySelector(".hero");
const isModelFile = (src) => /\.(glb|gltf)$/i.test(src);

// Browsers block fetching model files from file:// pages, so fall back to the embedded copy there.
const resolveModelSrc = (src) => (location.protocol === "file:" && window.EMBEDDED_MODELS?.[src]) || src;

const setModelSrc = (viewer, src) => {
  const resolved = resolveModelSrc(src);
  if (viewer.getAttribute("src") === resolved) return;
  // A new model is framed around its own centre, not wherever the camera was aimed for the last one.
  viewer.cameraTarget = "auto auto auto";
  viewer.setAttribute("src", resolved);
};

const wireframeColor = { r: 1, g: 223 / 255, b: 62 / 255 };

// model-viewer keeps its three.js scene under a private symbol; reach it to restyle the model.
function getModelScene(viewer) {
  const sceneKey = Object.getOwnPropertySymbols(viewer).find((key) => key.description === "scene");
  return sceneKey && viewer[sceneKey];
}

function setModelWireframe(viewer, enabled) {
  viewer.dataset.wireframe = String(enabled);
  const scene = getModelScene(viewer);
  if (!scene || !viewer.loaded) return;

  scene.traverse((object) => {
    if (object.userData.isCastShadow) object.visible = !enabled;
    if (!object.isMesh || object.userData.isCastShadow) return;
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

// A shadow in the shape of the model, cast onto the floor by a light above and to one side.
// model-viewer's own shadow falls straight down and fades with height, which leaves only a faint line
// under a tall, thin model like the scythe. Instead, each part of the model gets a flattened copy that
// is squashed onto the floor along the light direction every frame, so the shadow keeps the scythe's
// silhouette and stays put on the floor as the model is rotated, tilted, zoomed or panned.
const shadowLight = { x: 0.55, y: 1.4, z: 0.45 }; // direction towards the light (right, above, in front)
const shadowOpacity = 0.42;

function addCastShadow(viewer) {
  let shadows = [];

  const build = () => {
    const scene = getModelScene(viewer);
    if (!scene) return;
    shadows.forEach((shadow) => shadow.removeFromParent());
    shadows = [];

    const parts = [];
    scene.traverse((object) => {
      // Only the model's own parts, not model-viewer's helpers (such as its built-in shadow plane).
      if (object.isMesh && object.material?.isMeshStandardMaterial && !object.userData.isCastShadow) parts.push(object);
    });
    if (!parts.length) return;

    // The floor is the lowest point of the model. Track it relative to one part so it follows the
    // model when model-viewer shifts it around (as zooming toward the pointer does).
    scene.updateMatrixWorld(true);
    const anchor = parts[0];
    const point = anchor.position.clone();
    let lowest = Infinity;
    parts.forEach((part) => {
      const positions = part.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        lowest = Math.min(lowest, point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld).y);
      }
    });
    const floorOffset = lowest - anchor.matrixWorld.elements[13];
    const projection = anchor.matrixWorld.clone();

    parts.forEach((part) => {
      // Black with alpha, blended with MAX so overlapping pieces don't stack up darker and the
      // shadow never darkens the model itself.
      const material = part.material.clone();
      Object.assign(material, {
        transparent: true,
        depthWrite: false,
        wireframe: false,
        toneMapped: false,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0,
        map: null,
        blending: 5, // THREE.CustomBlending
        blendEquation: 104, // THREE.MaxEquation
        blendEquationAlpha: 104,
      });
      material.color.setRGB(0, 0, 0);
      material.emissive?.setRGB(0, 0, 0);
      // Output flat black at the shadow's opacity, ignoring the environment lighting model-viewer adds.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\n  gl_FragColor = vec4(0.0, 0.0, 0.0, opacity);",
        );
      };
      material.customProgramCacheKey = () => "cast-shadow";

      const shadow = new part.constructor(part.geometry, material);
      shadow.userData.isCastShadow = true;
      shadow.matrixAutoUpdate = false;
      shadow.matrixWorldAutoUpdate = false;
      shadow.frustumCulled = false;
      shadow.visible = viewer.dataset.wireframe !== "true";
      shadow.onBeforeRender = (renderer, renderScene, camera) => {
        const floor = anchor.matrixWorld.elements[13] + floorOffset + 0.001;
        const { x, y, z } = shadowLight;
        // Planar projection onto the floor (y = floor) along the light direction.
        projection.set(
          y, -x, 0, x * floor,
          0, 0, 0, y * floor,
          0, -z, y, z * floor,
          0, 0, 0, y,
        );
        shadow.matrixWorld.multiplyMatrices(projection, part.matrixWorld);
        // Hide it when looking up from below the floor.
        material.opacity = camera.matrixWorld.elements[13] > floor ? shadowOpacity : 0;
      };
      scene.add(shadow);
      shadows.push(shadow);
    });
    scene.queueRender?.();
  };

  viewer.addEventListener("load", build);
  if (viewer.loaded) build();
}

document.querySelectorAll(".hero-art model-viewer, .detail-model, .view-angle").forEach(addCastShadow);

let pageScrollLocked = false;
let touchStartY = 0;
let goToPage = null;
let selectedIndex = 0;

// Trackpads keep sending wheel events for a moment after a swipe (momentum). After a page change,
// wait for that stream to stop before the wheel can change page again, so one swipe moves one page.
const wheelGestureGap = 200;
let lastWheelTime = -Infinity;
let waitForNewWheelGesture = false;

function isNewWheelGesture(event) {
  const gap = event.timeStamp - lastWheelTime;
  lastWheelTime = event.timeStamp;
  if (gap >= wheelGestureGap) waitForNewWheelGesture = false;
  return !waitForNewWheelGesture;
}

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

// Page 2 groups the models into categories (Weapons for now). A closed category shows its models
// bundled together in the middle of the stage; opening it bursts them out into the carousel.
const categories = [...document.querySelectorAll(".category")];
let openCategory = null;

const categoryOf = (option) => option.closest(".category");
const optionsIn = (category) => [...category.querySelectorAll(".model-option")];

function setStageLabel(number, name) {
  stageNumber.textContent = number;
  stageName.textContent = name;
}

// Places a category's models: on the carousel ring around the model at `index` when the category is
// open, or bundled in the middle of the stage when it is closed. Models from other categories hide.
function updateCarousel(index) {
  const current = modelOptions[index];
  const category = categoryOf(current);
  const items = optionsIn(category);
  const open = category === openCategory;
  const position = items.indexOf(current);

  if (open) {
    setStageLabel(`${String(position + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`, current.dataset.model);
  }

  carouselModels.forEach((model) => {
    const option = modelOptions[Number(model.dataset.index)];
    const image = option.dataset.image;
    if (model.tagName === "MODEL-VIEWER") {
      if (isModelFile(image)) setModelSrc(model, image);
    } else {
      model.src = image;
    }
    model.setAttribute("alt", `${option.dataset.model} model preview`);
    model.className = "carousel-model";

    if (categoryOf(option) !== category) {
      model.classList.add("is-away");
      return;
    }
    const slot = items.indexOf(option);
    // Fanned out like weapons on a rack while the category is closed.
    const fan = slot - (items.length - 1) / 2;
    model.style.setProperty("--gather-x", `${fan * 22}%`);
    model.style.setProperty("--gather-r", `${fan * 14}deg`);
    if (!open) {
      model.classList.add("is-gathered");
      return;
    }
    // The models sit on a ring: one in the centre, one to each side and (with four or more) the rest
    // waiting out of sight on the far side, sliding in as the carousel turns.
    const distance = (slot - position + items.length) % items.length;
    model.classList.add(distance === 0 ? "is-center" : distance === 1 ? "is-right" : distance === items.length - 1 ? "is-left" : "is-far");
  });
}

function setCategoryOpen(category, open) {
  categories.forEach((item) => {
    const isOpen = open && item === category;
    item.classList.toggle("is-open", isOpen);
    item.querySelector(".category-toggle").setAttribute("aria-expanded", String(isOpen));
    item.querySelector(".category-items").inert = !isOpen;
  });
  openCategory = open ? category : null;
  modelSelection.classList.toggle("is-category-open", open);
  if (!open) setStageLabel("Category", category.querySelector(".category-name").textContent);

  // Show the open category around its selected model (or its first one), otherwise bundle it up.
  const selected = modelOptions[selectedIndex];
  const target = categoryOf(selected) === category ? selected : optionsIn(category)[0];
  updateCarousel([...modelOptions].indexOf(target));
}

categories.forEach((category) => {
  category.querySelector(".category-toggle").addEventListener("click", () => {
    setCategoryOpen(category, openCategory !== category);
  });
});

// Clicking the bundled models opens their category too.
document.querySelector(".model-window")?.addEventListener("click", () => {
  if (!openCategory) setCategoryOpen(categoryOf(modelOptions[selectedIndex]), true);
});

function highlightModel(option, highlighted) {
  option.classList.toggle("is-active", highlighted);
}

function selectModel(option, index) {
  modelOptions.forEach((item) => {
    item.setAttribute("aria-pressed", String(item === option));
  });

  selectedIndex = index;
  detailTitle.textContent = option.dataset.model;
  const is3D = isModelFile(option.dataset.image);
  if (is3D) {
    setModelSrc(detailModel, option.dataset.image);
    angleViews.forEach((view) => {
      setModelSrc(view, option.dataset.image);
      view.setAttribute("alt", `${option.dataset.model} ${view.dataset.label}`);
    });
    detailModel.setAttribute("alt", `${option.dataset.model} model`);
    setModelWireframe(detailModel, false);
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
  angleGrids.forEach((grid) => grid.classList.toggle("is-hidden", !is3D));
  viewModelImage.classList.toggle("is-hidden", is3D);
  viewWireframeImage.classList.toggle("is-hidden", is3D);
  detailModelImage.classList.remove("is-wireframe");
  rotation = 0;
  detailModelImage.style.transform = "";
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
  option.addEventListener("blur", () => highlightModel(option, false));
  option.addEventListener("click", () => {
    if (transitionPlaying) return;
    selectModel(option, index);
    resetModelZoom();
    // The model's page opens behind a full-screen wipe, with its name slammed across the screen.
    playModelTransition({
      name: option.dataset.model,
      category: categoryOf(option)?.dataset.category ?? "",
      accent: option.dataset.accent,
    }, openDetail);
  });
});

// Hovering previews other models; moving off the list brings back the selected one.
document.querySelectorAll(".model-list").forEach((list) => {
  list.addEventListener("mouseleave", () => updateCarousel(selectedIndex));
});

// A Persona-style transition: slanted bands of colour sweep across the screen, the model's name is
// slammed on top, and the next page is switched in behind the bands before they sweep away. Works for
// any model: it only needs a name, and optionally a category and an accent colour (data-accent on the
// model's menu button) for the stripes and name plate.
const personaTransition = document.querySelector(".persona-transition");
let transitionPlaying = false;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

async function playModelTransition({ name, category = "", accent }, onCovered) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!personaTransition || reduceMotion) {
    onCovered();
    return;
  }

  transitionPlaying = true;
  personaTransition.querySelector(".pt-name").textContent = name;
  personaTransition.querySelector(".pt-category").textContent = category;
  personaTransition.style.setProperty("--pt-accent", accent || "var(--yellow)");

  personaTransition.classList.add("is-active");
  await frame();
  personaTransition.classList.add("is-covering");   // bands sweep in, name slams down
  await wait(1000);
  onCovered();                                       // switch pages while the screen is covered
  await wait(120);
  personaTransition.classList.add("is-leaving");    // bands sweep away, revealing the new page
  await wait(760);

  personaTransition.classList.remove("is-active", "is-covering", "is-leaving");
  transitionPlaying = false;
}

function openDetail() {
  pageScrollLocked = false;
  modelDetail.scrollTop = 0;
  modelDetail.inert = false;
  document.body.classList.add("is-detail-active");
  detailBack?.focus({ preventScroll: true });
  showRotateHint();
}

// Like Sketchfab: shortly after a 3D model opens, a hand icon swings it gently back and forth to show
// it can be rotated. It stops as soon as the visitor drags or zooms the model.
function showRotateHint() {
  if (detailModel.classList.contains("is-hidden")) return;
  detailModel.interactionPrompt = "auto";
  detailModel.resetInteractionPrompt?.();
}

function hideRotateHint() {
  detailModel.interactionPrompt = "none";
}

function closeDetail() {
  hideRotateHint();
  document.body.classList.remove("is-detail-active");
  modelDetail.inert = true;
  modelSelection?.scrollIntoView({ behavior: "smooth", block: "start" });
  modelOptions[selectedIndex]?.focus({ preventScroll: true });
}

// The detail overlay is invisible until a model is opened, so keep it out of the tab order until then.
if (modelDetail) modelDetail.inert = true;

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
detailBack?.addEventListener("click", closeDetail);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("is-detail-active")) closeDetail();
});

// Scrolling over the 3D model zooms it: up zooms in, down zooms back out. Once it is fully
// zoomed out, a fresh scroll down moves on to the next page as normal.
const minModelZoom = 0.3;
const zoomGestureGap = 400;
let modelZoom = 1;
let lastZoomWheel = 0;

// Zooming aims at the pointer: the camera's look-at point slides toward whatever is under the
// cursor (or between the two fingers), so that spot stays put on screen while the model grows.
let defaultTarget = null;   // where the camera looks when fully zoomed out (the model's centre)
let zoomedOutRadius = 0;    // camera distance at modelZoom = 1
let modelPan = { x: 0, y: 0, z: 0 };

function applyModelZoom() {
  const orbit = detailModel.getCameraOrbit?.();
  if (!orbit) return;
  detailModel.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${(modelZoom * 135).toFixed(1)}%`;
  applyModelTarget();
}

function applyModelTarget() {
  if (defaultTarget) {
    const x = defaultTarget.x + modelPan.x;
    const y = defaultTarget.y + modelPan.y;
    const z = defaultTarget.z + modelPan.z;
    detailModel.cameraTarget = `${x}m ${y}m ${z}m`;
  }
}

// Change the zoom, keeping the point under (clientX, clientY) fixed on screen.
function setModelZoom(newZoom, clientX, clientY) {
  hideRotateHint();
  const previous = modelZoom;
  modelZoom = Math.min(1, Math.max(minModelZoom, newZoom));
  if (modelZoom === previous) return;

  const orbit = detailModel.getCameraOrbit?.();
  const rect = detailModel.getBoundingClientRect();
  if (!orbit || !defaultTarget || !zoomedOutRadius || !rect.width || !rect.height) {
    applyModelZoom();
    return;
  }

  if (modelZoom > previous) {
    // Zooming out drifts back to the centre, arriving exactly there when fully zoomed out.
    const was = (1 - previous) / (1 - minModelZoom);
    const now = (1 - modelZoom) / (1 - minModelZoom);
    const keep = was > 0 ? now / was : 0;
    modelPan = { x: modelPan.x * keep, y: modelPan.y * keep, z: modelPan.z * keep };
  } else {
    // Camera axes from the orbit angles (theta around the vertical axis, phi down from the top).
    const sinPhi = Math.sin(orbit.phi);
    const dir = [sinPhi * Math.sin(orbit.theta), Math.cos(orbit.phi), sinPhi * Math.cos(orbit.theta)];
    let right = [dir[2], 0, -dir[0]];
    const rightLength = Math.hypot(...right) || 1;
    right = right.map((value) => value / rightLength);
    const up = [
      dir[1] * right[2] - dir[2] * right[1],
      dir[2] * right[0] - dir[0] * right[2],
      dir[0] * right[1] - dir[1] * right[0],
    ];

    // How far the pointer is from the screen centre, in world units at the distance of the target.
    const halfHeight = Math.tan((detailModel.getFieldOfView() * Math.PI / 180) / 2) * zoomedOutRadius * previous;
    const ndcX = ((clientX - rect.left) / rect.width - 0.5) * 2;
    const ndcY = -((clientY - rect.top) / rect.height - 0.5) * 2;
    const offsetX = ndcX * halfHeight * (rect.width / rect.height);
    const offsetY = ndcY * halfHeight;
    const slide = 1 - modelZoom / previous;
    modelPan.x += (right[0] * offsetX + up[0] * offsetY) * slide;
    modelPan.y += (right[1] * offsetX + up[1] * offsetY) * slide;
    modelPan.z += (right[2] * offsetX + up[2] * offsetY) * slide;
  }
  applyModelZoom();
}

// Opening a model starts from its default view: front-on, fully zoomed out.
function resetModelZoom() {
  modelZoom = 1;
  modelPan = { x: 0, y: 0, z: 0 };
  if (!detailModel.loaded) return;
  detailModel.cameraOrbit = "0deg 75deg 135%";
  // Look at the centre of whichever model is opening (a different model may still be loading).
  detailModel.cameraTarget = "auto auto auto";
}

// Remember the framing the viewer chose for the model, once it has loaded.
async function captureModelFraming() {
  modelPan = { x: 0, y: 0, z: 0 };
  const target = detailModel.getCameraTarget();
  defaultTarget = { x: target.x, y: target.y, z: target.z };
  // Start each newly loaded model front-on, then wait for the camera to actually move there before
  // measuring it (the jump only happens on the viewer's next update).
  detailModel.cameraOrbit = `0deg 75deg ${(modelZoom * 135).toFixed(1)}%`;
  detailModel.jumpCameraToGoal();
  await detailModel.updateComplete;
  zoomedOutRadius = detailModel.getCameraOrbit().radius / modelZoom;
  applyModelTarget();
}

detailModel?.addEventListener("load", captureModelFraming);
if (detailModel?.loaded) captureModelFraming();

// Two-finger pinch on touch screens: fingers apart zooms in, together zooms out. One finger still
// rotates the model and swiping up or down still changes page.
let pinchStartDistance = 0;
let pinchStartZoom = 1;

const touchDistance = (touches) => Math.hypot(
  touches[0].clientX - touches[1].clientX,
  touches[0].clientY - touches[1].clientY,
);

detailModel?.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 2) return;
  pinchStartDistance = touchDistance(event.touches) || 1;
  pinchStartZoom = modelZoom;
}, { passive: true });

detailModel?.addEventListener("touchmove", (event) => {
  if (event.touches.length !== 2 || !pinchStartDistance) return;
  if (event.cancelable) event.preventDefault();
  const ratio = pinchStartDistance / (touchDistance(event.touches) || 1);
  const [a, b] = event.touches;
  setModelZoom(pinchStartZoom * ratio, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
}, { passive: false });

const endPinch = (event) => {
  if (event.touches.length < 2) pinchStartDistance = 0;
};
detailModel?.addEventListener("touchend", endPinch, { passive: true });
detailModel?.addEventListener("touchcancel", endPinch, { passive: true });

function handleModelZoom(event) {
  const overModel = !detailModel.classList.contains("is-hidden")
    && event.target instanceof Element
    && event.target.closest(".detail-model");
  if (!overModel || modelDetail.scrollTop > 2) return false;

  // Trackpad pinches arrive as ctrl+wheel with small deltas: always zoom, never change page.
  if (event.ctrlKey) {
    setModelZoom(modelZoom * Math.exp(event.deltaY * 0.01), event.clientX, event.clientY);
    return true;
  }

  // event.timeStamp is when the scroll happened, so a busy frame cannot split one gesture in two.
  const now = event.timeStamp;
  const sameGesture = now - lastZoomWheel < zoomGestureGap;
  const zoomingOut = event.deltaY > 0;

  // Fully zoomed out: let a new scroll down change page, but swallow the tail of the zoom-out gesture.
  if (zoomingOut && modelZoom >= 1 && !sameGesture) return false;

  lastZoomWheel = now;
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
  setModelZoom(modelZoom * Math.exp(delta * 0.0015), event.clientX, event.clientY);
  return true;
}

modelDetail?.addEventListener("wheel", (event) => {
  if (!document.body.classList.contains("is-detail-active")) return;
  const newGesture = isNewWheelGesture(event);
  if (handleModelZoom(event)) {
    event.preventDefault();
    return;
  }
  if (event.ctrlKey) return; // let the browser zoom the page
  event.preventDefault();

  if (pageScrollLocked || !newGesture || Math.abs(event.deltaY) < 8 || !modelViews) return;

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
  waitForNewWheelGesture = true;
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
    if (pageScrollLocked || Math.abs(window.scrollY - page.offsetTop) <= 2) return;

    pageScrollLocked = true;
    waitForNewWheelGesture = true;
    animateScrollTo(page.offsetTop).then(() => {
      pageScrollLocked = false;
    });
  };

  // The home and model pages move one whole page at a time, so the browser never scrolls them by hand.
  window.addEventListener("wheel", (event) => {
    if (document.body.classList.contains("is-detail-active") || event.ctrlKey) return;
    event.preventDefault();

    const newGesture = isNewWheelGesture(event);
    if (pageScrollLocked || !newGesture || Math.abs(event.deltaY) < 8) return;
    goToPage(event.deltaY > 0 ? modelSelection : hero);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (document.body.classList.contains("is-detail-active") || event.target.closest?.("button, a, input, textarea")) return;
    const down = ["ArrowDown", "PageDown", " "].includes(event.key);
    const up = ["ArrowUp", "PageUp"].includes(event.key);
    if (!down && !up) return;
    event.preventDefault();
    goToPage(down ? modelSelection : hero);
  });

  window.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    // Swipes change page on touchend; the detail overlay scrolls normally.
    if (!document.body.classList.contains("is-detail-active") && event.cancelable) event.preventDefault();
  }, { passive: false });

  window.addEventListener("touchend", (event) => {
    if (document.body.classList.contains("is-detail-active")) return;
    const swipeDistance = touchStartY - event.changedTouches[0].clientY;
    if (Math.abs(swipeDistance) < 30) return;
    goToPage(swipeDistance > 0 ? modelSelection : hero);
  }, { passive: true });
}
