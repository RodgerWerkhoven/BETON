const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginName = document.querySelector("#loginName");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const logoutButton = document.querySelector("#logoutButton");
const gallery = document.querySelector("#gallery");
const count = document.querySelector("#count");
const controls = document.querySelector(".controls");
const addedFilter = document.querySelector("#addedFilter");
const deletedFilter = document.querySelector("#deletedFilter");
const clientVoteFilter = document.querySelector("#clientVoteFilter");
const adminVoteFilter = document.querySelector("#adminVoteFilter");
const cropDialog = document.querySelector("#cropDialog");
const cropCanvas = document.querySelector("#cropCanvas");
const cropContext = cropCanvas.getContext("2d");
const cropTitle = document.querySelector("#cropTitle");
const cropGroup = document.querySelector("#cropGroup");
const cropMeta = document.querySelector("#cropMeta");
const undoCrop = document.querySelector("#undoCrop");
const resetCrop = document.querySelector("#resetCrop");
const saveCrop = document.querySelector("#saveCrop");
const downloadCrop = document.querySelector("#downloadCrop");
const aspectButtons = {
  free: document.querySelector("#aspectFree"),
  grid: document.querySelector("#aspectGrid"),
  square: document.querySelector("#aspectSquare"),
};
const toggleTextEdit = document.querySelector("#toggleTextEdit");
const saveTextEdit = document.querySelector("#saveTextEdit");
const resetTextEdit = document.querySelector("#resetTextEdit");
const addFileInput = document.querySelector("#addFileInput");
const editableTextNodes = Array.from(document.querySelectorAll("[data-edit-key]"));

const cropStoreKey = "beton-logo-crops-v2";
const cropHistoryStoreKey = "beton-logo-crop-history-v1";
const reviewStoreKey = "beton-logo-review-state-v1";
const addedItemsStoreKey = "beton-logo-added-items-v1";
const textStoreKey = "beton-logo-page-text-v1";
const ratingOptions = ["🤩", "🙂", "🆗", "🤔", "🤮"];
const defaults = Object.fromEntries(editableTextNodes.map((node) => [node.dataset.editKey, node.textContent]));
const activeClient = new URLSearchParams(window.location.search).get("client") || "Alien";

let logos = [];
let cropOverrides = readJson(cropStoreKey, {});
let cropHistory = readJson(cropHistoryStoreKey, {});
let reviewState = readJson(reviewStoreKey, {});
let addedItems = readJson(addedItemsStoreKey, {});
let activeFilter = "all";
let activeLogo = null;
let activeImage = null;
let activeAspect = "free";
let imageRect = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let crop = { x: 0, y: 0, width: 1, height: 1 };
let pointer = null;
let pendingPatch = {};
let persistTimer = null;
let currentSession = null;

function showLogin(message = "") {
  loginView.hidden = false;
  appView.hidden = true;
  loginError.textContent = message;
  loginName.focus();
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mergePatch(base, patch) {
  Object.entries(patch || {}).forEach(([section, values]) => {
    base[section] = base[section] || {};
    Object.entries(values || {}).forEach(([key, value]) => {
      if (value === null) delete base[section][key];
      else base[section][key] = value;
    });
  });
}

function localSnapshot() {
  return {
    crops: cropOverrides,
    cropHistory,
    review: reviewState,
    addedItems,
    text: readJson(textStoreKey, currentTextValues()),
  };
}

function hasState(state) {
  return ["crops", "cropHistory", "review", "addedItems", "text"].some((key) => (
    Object.keys(state[key] || {}).length
  ));
}

function applyState(state) {
  cropOverrides = state.crops || {};
  cropHistory = state.cropHistory || {};
  reviewState = state.review || {};
  addedItems = state.addedItems || {};
  writeJson(cropStoreKey, cropOverrides);
  writeJson(cropHistoryStoreKey, cropHistory);
  writeJson(reviewStoreKey, reviewState);
  writeJson(addedItemsStoreKey, addedItems);
  writeJson(textStoreKey, state.text || {});
  applySavedText();
}

async function persistNow(patch) {
  mergePatch(pendingPatch, patch);
  const toSend = pendingPatch;
  pendingPatch = {};
  try {
    const response = await fetch(`/api/state?client=${encodeURIComponent(activeClient)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSend),
    });
    if (!response.ok) throw new Error(await response.text());
    applyState(await response.json());
  } catch (error) {
    if (String(error.message || "").includes("401")) showLogin("Log opnieuw in.");
    mergePatch(pendingPatch, toSend);
    console.error("State save failed", error);
  }
}

function schedulePersist(patch) {
  mergePatch(pendingPatch, patch);
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistNow({}), 450);
}

async function loadSharedState() {
  try {
    const response = await fetch(`/api/state?client=${encodeURIComponent(activeClient)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const remote = await response.json();
    const local = localSnapshot();
    if (hasState(remote)) {
      applyState(remote);
    } else if (hasState(local)) {
      applyState(local);
      await persistNow(local);
    }
  } catch (error) {
    if (String(error.message || "").includes("401")) {
      showLogin("Log in om deze images te bekijken.");
      return;
    }
    console.error("State load failed, local backup active", error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

function logoPath(file) {
  return `/logos/${encodeURIComponent(file).replace(/[()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

function logoStateKey(logo) {
  return logo.stateKey || logo.file;
}

function imageCopy(value) {
  return String(value || "").replace(/\blogo's\b/gi, "images").replace(/\blogos\b/gi, "images").replace(/\blogo\b/gi, "image");
}

function imageSource(logo) {
  const key = logoStateKey(logo);
  if (logo.dataUrl) return cropOverrides[key] || logo.dataUrl;
  return cropOverrides[key] || logoPath(logo.file);
}

function imageFallbackSource(logo) {
  return logo.dataUrl ? "" : logoPath(logo.file);
}

function allLogos() {
  return [...logos, ...Object.values(addedItems)];
}

function isImageLogo(logo) {
  return !logo.type || logo.type.startsWith("image/");
}

function visibleLogos() {
  const list = allLogos();
  if (activeFilter === "deleted") return list.filter((logo) => reviewState[logoStateKey(logo)]?.deleted);
  const active = list.filter((logo) => !reviewState[logoStateKey(logo)]?.deleted);
  if (activeFilter === "TOEGEVOEGD") return active.filter((logo) => logo.group === "TOEGEVOEGD" || logo.group === "ADDED");
  if (activeFilter === "vote-client") return active.filter((logo) => hasVote(logo, "client"));
  if (activeFilter === "vote-admin") return active.filter((logo) => hasVote(logo, "admin"));
  if (activeFilter === "all") return active;
  return active.filter((logo) => tagsFor(logo, logoReview(logo)).includes(activeFilter));
}

function logoReview(logo) {
  return reviewState[logoStateKey(logo)] || {};
}

function currentRatingRole() {
  return currentSession?.role === "admin" ? "admin" : "client";
}

function ratingsFor(review) {
  return review.ratings || (review.rating ? { client: review.rating } : {});
}

function hasVote(logo, role) {
  return Boolean(ratingsFor(logoReview(logo))[role]);
}

function normalizeTag(tag) {
  return String(tag || "")
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function tagLabel(tag) {
  const normalized = normalizeTag(tag);
  return normalized ? `#${normalized}` : "";
}

function uniqueTags(tags) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

function inferredTags(logo) {
  const text = `${logo.group || ""} ${logo.source || ""} ${logo.name || ""} ${logo.file || ""}`;
  const tags = [logo.group || "TOEGEVOEGD"];
  if (/\b3d\b/i.test(text)) tags.push("3D");
  else tags.push("GRAFISCH");
  return uniqueTags(tags);
}

function tagsFor(logo, review) {
  return review.customTags ? uniqueTags(review.customTags) : inferredTags(logo);
}

function isTagFiltered() {
  return !["all", "TOEGEVOEGD", "deleted", "vote-client", "vote-admin"].includes(activeFilter);
}

function renderTags(logo, review) {
  const tags = tagsFor(logo, review);
  const allTag = isTagFiltered()
    ? `<button class="tag tag-all" type="button" data-tag-filter="all">#ALL</button>`
    : "";
  return `
    <div class="tag-row">
      <div class="tags">${allTag}${tags.map((tag) => `<button class="tag" type="button" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tagLabel(tag))}</button>`).join("")}</div>
      <button class="tag-edit" type="button" data-action="tag-edit" data-id="${logo.id}" aria-label="Tags aanpassen">#</button>
    </div>
  `;
}

function allTagFilters() {
  const tags = new Set();
  allLogos().forEach((logo) => {
    if (reviewState[logoStateKey(logo)]?.deleted) return;
    tagsFor(logo, logoReview(logo)).forEach((tag) => tags.add(tag));
  });
  return [...tags].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
}

function renderFilters() {
  const tagButtons = allTagFilters().map((tag) => (
    `<button class="filter ${activeFilter === tag ? "active" : ""}" data-filter="${escapeHtml(tag)}">${escapeHtml(tagLabel(tag))}</button>`
  ));
  controls.innerHTML = `<button class="filter ${activeFilter === "all" ? "active" : ""}" data-filter="all">TAGS</button>${tagButtons.join("")}`;
  addedFilter.classList.toggle("active", activeFilter === "TOEGEVOEGD");
  deletedFilter.classList.toggle("active", activeFilter === "deleted");
  clientVoteFilter.classList.toggle("active", activeFilter === "vote-client");
  adminVoteFilter.classList.toggle("active", activeFilter === "vote-admin");
}

function currentCommentPrefix() {
  return currentSession?.role === "admin" ? "R:" : "A:";
}

function commentValue(review) {
  if (review.comment) return review.comment;
  if (review.commentOpen) return `${currentCommentPrefix()} `;
  return "";
}

function fitTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function fitCommentTextareas() {
  gallery.querySelectorAll(".comment textarea").forEach(fitTextarea);
}

function saveReview() {
  writeJson(reviewStoreKey, reviewState);
}

function saveReviewItem(file) {
  writeJson(reviewStoreKey, reviewState);
  schedulePersist({ review: { [file]: reviewState[file] || null } });
}

function saveAddedItems() {
  writeJson(addedItemsStoreKey, addedItems);
}

function saveCropState(file) {
  writeJson(cropStoreKey, cropOverrides);
  writeJson(cropHistoryStoreKey, cropHistory);
  if (file) {
    schedulePersist({
      crops: { [file]: cropOverrides[file] || null },
      cropHistory: { [file]: cropHistory[file] || null },
    });
  }
}

function pushCropHistory(file) {
  cropHistory[file] = cropHistory[file] || [];
  cropHistory[file].push(cropOverrides[file] || null);
  cropHistory[file] = cropHistory[file].slice(-12);
}

function undoLogoCrop(logo) {
  const key = logoStateKey(logo);
  const history = cropHistory[key] || [];
  if (!history.length) return false;
  const previous = history.pop();
  if (previous) cropOverrides[key] = previous;
  else delete cropOverrides[key];
      saveCropState(key);
  return true;
}

function updateUndoButtons() {
  if (!activeLogo) return;
  undoCrop.disabled = !(cropHistory[logoStateKey(activeLogo)] || []).length;
}

function render() {
  renderFilters();
  const visible = visibleLogos();
  count.textContent = visible.length;
  const showUploadCard = activeFilter !== "deleted";
  gallery.innerHTML = `${visible
    .map(
      (logo) => {
        const review = logoReview(logo);
        const safeSource = escapeHtml(imageCopy(logo.source));
        const safeName = escapeHtml(logo.name || `Image ${logo.id}`);
        const croppable = isImageLogo(logo);
        return `
        <article class="logo-card ${review.deleted ? "is-deleted" : ""}">
          <button class="image-button ${croppable ? "" : "file-preview"}" type="button" data-id="${logo.id}">
            ${croppable
              ? `<img src="${imageSource(logo)}" data-fallback="${imageFallbackSource(logo)}" alt="${safeName}, ${logo.group}" loading="lazy" />`
              : `<span class="file-kind">${escapeHtml(logo.type || "bestand")}</span><strong>${safeName}</strong>`}
          </button>
          <div class="meta">
            <div class="meta-row">
              <span class="number">${logo.added ? "⊕" : `#${String(logo.id).padStart(2, "0")}`}</span>
              ${renderTags(logo, review)}
            </div>
            <div class="source">${logo.added ? `Toegevoegd: ${safeSource}` : `Bron ${logo.sourceIndex}.${logo.dotIndex}: ${safeSource}`}</div>
            <div class="rating" role="group" aria-label="Rating voor image ${logo.id}">
              ${ratingOptions.map((rating) => {
                const ratings = ratingsFor(review);
                return `
                <button
                  class="rating-button ${ratings.admin === rating ? "admin-rated" : ""} ${ratings.client === rating ? "client-rated" : ""}"
                  type="button"
                  data-action="rating"
                  data-id="${logo.id}"
                  data-rating="${rating}"
                  aria-label="Rating ${rating}"
                >${rating}</button>
              `;
              }).join("")}
            </div>
            <div class="comment-row">
              <button class="comment-toggle" type="button" data-action="comment-toggle" data-id="${logo.id}">💬</button>
              <label class="comment ${review.commentOpen || review.comment ? "is-open" : ""}">
                <textarea data-action="comment" data-id="${logo.id}" rows="1" placeholder="${currentCommentPrefix()} schrijf hier je opmerking">${escapeHtml(commentValue(review))}</textarea>
              </label>
            </div>
            <div class="card-actions">
              ${croppable ? `<button class="edit-logo" type="button" data-id="${logo.id}">Bijsnijden</button>` : ""}
              <button class="undo-card" type="button" data-action="undo" data-id="${logo.id}" ${cropHistory[logoStateKey(logo)]?.length ? "" : "disabled"}>↩️</button>
              <button class="delete-logo ${review.deleted ? "is-restore" : ""}" type="button" data-action="delete" data-id="${logo.id}">${review.deleted ? "Herstel" : "☠️"}</button>
            </div>
          </div>
        </article>
      `;
      },
    )
    .join("")}${showUploadCard ? uploadCardTemplate() : ""}`;
  fitCommentTextareas();
}

function uploadCardTemplate() {
  return `
    <article class="logo-card upload-card">
      <button class="upload-drop" id="addFileButton" type="button">
        <span>⊕</span>
        <strong>Nieuwe image of sheet</strong>
        <small>Voeg bestand toe aan dit grid</small>
      </button>
      <div class="meta">
        <div class="comment-row upload-comment-row">
          <button class="comment-toggle" id="uploadCommentToggle" type="button">💬</button>
          <label class="comment" id="uploadComment">
            <span>Uitleg bij nieuwe upload</span>
            <textarea id="newUploadComment" rows="1" placeholder="${currentCommentPrefix()} typ eerst uitleg, kies daarna bestand(en)"></textarea>
          </label>
        </div>
      </div>
    </article>
  `;
}

function normalizeSavedText(key, value) {
  if (key === "title" && value === "Logo review") return "Images review";
  return value;
}

function applySavedText() {
  const saved = readJson(textStoreKey, {});
  editableTextNodes.forEach((node) => {
    const key = node.dataset.editKey;
    node.textContent = normalizeSavedText(key, saved[key]) || defaults[key];
  });
}

function setTextEditMode(enabled) {
  editableTextNodes.forEach((node) => {
    node.contentEditable = String(enabled);
    node.spellcheck = false;
  });
  toggleTextEdit.hidden = enabled;
  saveTextEdit.hidden = !enabled;
  resetTextEdit.hidden = !enabled;
  if (enabled) editableTextNodes[0]?.focus();
}

function currentTextValues() {
  return Object.fromEntries(editableTextNodes.map((node) => [node.dataset.editKey, node.textContent.trim()]));
}

function findLogo(id) {
  return allLogos().find((item) => String(item.id) === String(id));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function fileToStoredDataUrl(file) {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return raw;
  const image = await loadImageFromUrl(raw);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1 && file.size < 1200000) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function addFiles(files) {
  let comment = document.querySelector("#newUploadComment")?.value.trim() || "";
  if (comment && !/^[RA]:\s/.test(comment)) comment = `${currentCommentPrefix()} ${comment}`;
  const addedPatch = {};
  const reviewPatch = {};
  for (const file of Array.from(files)) {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id,
      file: id,
      name: file.name,
      source: file.name,
      sourceIndex: "⊕",
      dotIndex: "",
      group: "TOEGEVOEGD",
      added: true,
      type: file.type || "application/octet-stream",
      dataUrl: await fileToStoredDataUrl(file),
    };
    addedItems[id] = item;
    addedPatch[id] = item;
    if (comment) {
      reviewState[id] = { ...(reviewState[id] || {}), comment, commentOpen: true };
      reviewPatch[id] = reviewState[id];
    }
  }
  saveAddedItems();
  saveReview();
  schedulePersist({ addedItems: addedPatch, review: reviewPatch });
  render();
}

function openCropper(logo) {
  if (!isImageLogo(logo)) return;
  activeLogo = logo;
  activeImage = new Image();
  activeImage.onload = () => {
    cropTitle.textContent = `#${String(logo.id).padStart(2, "0")}`;
    cropGroup.textContent = logo.group;
    cropMeta.textContent = `Bron ${logo.sourceIndex}.${logo.dotIndex}: ${imageCopy(logo.source)}`;
    updateUndoButtons();
    crop = defaultCrop(activeImage.naturalWidth, activeImage.naturalHeight);
    resizeCanvas();
    cropDialog.showModal();
    drawCropper();
  };
  activeImage.src = imageSource(logo);
}

function defaultCrop(width, height) {
  const marginX = Math.round(width * 0.06);
  const marginY = Math.round(height * 0.06);
  return {
    x: marginX,
    y: marginY,
    width: Math.max(20, width - marginX * 2),
    height: Math.max(20, height - marginY * 2),
  };
}

function resizeCanvas() {
  const bounds = cropCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  cropCanvas.width = Math.max(600, Math.round(bounds.width * dpr));
  cropCanvas.height = Math.max(380, Math.round(bounds.height * dpr));
}

function calculateImageRect() {
  const canvasRatio = cropCanvas.width / cropCanvas.height;
  const imageRatio = activeImage.naturalWidth / activeImage.naturalHeight;
  let width;
  let height;
  if (imageRatio > canvasRatio) {
    width = cropCanvas.width;
    height = width / imageRatio;
  } else {
    height = cropCanvas.height;
    width = height * imageRatio;
  }
  return {
    x: (cropCanvas.width - width) / 2,
    y: (cropCanvas.height - height) / 2,
    width,
    height,
    scale: width / activeImage.naturalWidth,
  };
}

function toCanvasRect(sourceCrop = crop) {
  return {
    x: imageRect.x + sourceCrop.x * imageRect.scale,
    y: imageRect.y + sourceCrop.y * imageRect.scale,
    width: sourceCrop.width * imageRect.scale,
    height: sourceCrop.height * imageRect.scale,
  };
}

function fromCanvasDelta(dx, dy) {
  return { dx: dx / imageRect.scale, dy: dy / imageRect.scale };
}

function drawCropper() {
  if (!activeImage) return;
  imageRect = calculateImageRect();
  cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.fillStyle = "#eee9df";
  cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.drawImage(activeImage, imageRect.x, imageRect.y, imageRect.width, imageRect.height);

  const rect = toCanvasRect();
  cropContext.save();
  cropContext.fillStyle = "rgba(0, 0, 0, 0.54)";
  cropContext.beginPath();
  cropContext.rect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.rect(rect.x, rect.y, rect.width, rect.height);
  cropContext.fill("evenodd");
  cropContext.strokeStyle = "#ff30d6";
  cropContext.lineWidth = 4;
  cropContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
  cropContext.strokeStyle = "rgba(255, 255, 255, 0.82)";
  cropContext.lineWidth = 1;
  for (let i = 1; i < 3; i += 1) {
    const x = rect.x + (rect.width / 3) * i;
    const y = rect.y + (rect.height / 3) * i;
    cropContext.beginPath();
    cropContext.moveTo(x, rect.y);
    cropContext.lineTo(x, rect.y + rect.height);
    cropContext.moveTo(rect.x, y);
    cropContext.lineTo(rect.x + rect.width, y);
    cropContext.stroke();
  }
  drawHandles(rect);
  cropContext.restore();
}

function drawHandles(rect) {
  const handles = handlePoints(rect);
  cropContext.fillStyle = "#ff30d6";
  cropContext.strokeStyle = "#111111";
  cropContext.lineWidth = 2;
  handles.forEach(({ x, y }) => {
    cropContext.beginPath();
    cropContext.arc(x, y, 9, 0, Math.PI * 2);
    cropContext.fill();
    cropContext.stroke();
  });
}

function handlePoints(rect) {
  return [
    { name: "nw", x: rect.x, y: rect.y },
    { name: "ne", x: rect.x + rect.width, y: rect.y },
    { name: "sw", x: rect.x, y: rect.y + rect.height },
    { name: "se", x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function getCanvasPoint(event) {
  const bounds = cropCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * cropCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * cropCanvas.height,
  };
}

function hitTest(point) {
  const rect = toCanvasRect();
  const handle = handlePoints(rect).find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 22);
  if (handle) return { mode: "resize", handle: handle.name };
  if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
    return { mode: "move" };
  }
  return { mode: "new" };
}

function clampCrop(next) {
  const width = activeImage.naturalWidth;
  const height = activeImage.naturalHeight;
  next.width = Math.max(24, Math.min(width, next.width));
  next.height = Math.max(24, Math.min(height, next.height));
  next.x = Math.max(0, Math.min(width - next.width, next.x));
  next.y = Math.max(0, Math.min(height - next.height, next.y));
  return next;
}

function applyAspect(next) {
  const ratios = { grid: 4 / 3, square: 1 };
  const ratio = ratios[activeAspect];
  if (!ratio) return next;
  const centerX = next.x + next.width / 2;
  const centerY = next.y + next.height / 2;
  if (next.width / next.height > ratio) next.width = next.height * ratio;
  else next.height = next.width / ratio;
  next.x = centerX - next.width / 2;
  next.y = centerY - next.height / 2;
  return clampCrop(next);
}

function updateCropFromPointer(event) {
  if (!pointer) return;
  const point = getCanvasPoint(event);
  const delta = fromCanvasDelta(point.x - pointer.startPoint.x, point.y - pointer.startPoint.y);
  let next = { ...pointer.startCrop };
  if (pointer.mode === "move") {
    next.x += delta.dx;
    next.y += delta.dy;
  } else if (pointer.mode === "resize") {
    if (pointer.handle.includes("w")) {
      next.x += delta.dx;
      next.width -= delta.dx;
    }
    if (pointer.handle.includes("e")) next.width += delta.dx;
    if (pointer.handle.includes("n")) {
      next.y += delta.dy;
      next.height -= delta.dy;
    }
    if (pointer.handle.includes("s")) next.height += delta.dy;
  } else {
    const start = fromCanvasPoint(pointer.startPoint);
    const current = fromCanvasPoint(point);
    next = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
  }
  crop = applyAspect(clampCrop(next));
  drawCropper();
}

function fromCanvasPoint(point) {
  return {
    x: Math.max(0, Math.min(activeImage.naturalWidth, (point.x - imageRect.x) / imageRect.scale)),
    y: Math.max(0, Math.min(activeImage.naturalHeight, (point.y - imageRect.y) / imageRect.scale)),
  };
}

function makeCroppedDataUrl() {
  const output = document.createElement("canvas");
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / crop.width);
  output.width = Math.round(crop.width * scale);
  output.height = Math.round(crop.height * scale);
  const context = output.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    activeImage,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    output.width,
    output.height,
  );
  return output.toDataURL("image/jpeg", 0.92);
}

function setActiveFilter(filter) {
  activeFilter = filter;
  render();
}

controls.addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) return;
  setActiveFilter(button.dataset.filter);
});

[addedFilter, deletedFilter, clientVoteFilter, adminVoteFilter].forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(activeFilter === button.dataset.filter ? "all" : button.dataset.filter);
  });
});

gallery.addEventListener("click", (event) => {
  if (event.target.closest("#addFileButton")) {
    addFileInput.click();
    return;
  }
  if (event.target.closest("#uploadCommentToggle")) {
    document.querySelector("#uploadComment")?.classList.toggle("is-open");
    const uploadComment = document.querySelector("#newUploadComment");
    if (uploadComment && !uploadComment.value) uploadComment.value = `${currentCommentPrefix()} `;
    uploadComment?.focus();
    return;
  }
  const tagFilter = event.target.closest("[data-tag-filter]");
  if (tagFilter) {
    setActiveFilter(tagFilter.dataset.tagFilter);
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    const logo = findLogo(action.dataset.id);
    if (!logo) return;
    const review = logoReview(logo);
    const key = logoStateKey(logo);
    if (action.dataset.action === "rating") {
      const role = currentRatingRole();
      review.ratings = ratingsFor(review);
      if (review.ratings[role] === action.dataset.rating) delete review.ratings[role];
      else review.ratings[role] = action.dataset.rating;
      delete review.rating;
      reviewState[key] = review;
      saveReviewItem(key);
      render();
    }
    if (action.dataset.action === "delete") {
      review.deleted = !review.deleted;
      reviewState[key] = review;
      saveReviewItem(key);
      render();
    }
    if (action.dataset.action === "tag-edit") {
      const current = tagsFor(logo, review).map(tagLabel).join(", ");
      const next = window.prompt("Tags aanpassen. Gebruik komma's, bijvoorbeeld #3D, #GRAFISCH.", current);
      if (next === null) return;
      const tags = uniqueTags(next.split(","));
      if (tags.length) review.customTags = tags;
      else delete review.customTags;
      reviewState[key] = review;
      saveReviewItem(key);
      render();
    }
    if (action.dataset.action === "comment-toggle") {
      review.commentOpen = !review.commentOpen;
      if (review.commentOpen && !review.comment) review.comment = `${currentCommentPrefix()} `;
      reviewState[key] = review;
      saveReviewItem(key);
      render();
      if (review.commentOpen) {
        setTimeout(() => {
          const textarea = gallery.querySelector(`textarea[data-id="${CSS.escape(String(logo.id))}"]`);
          if (!textarea) return;
          fitTextarea(textarea);
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 0);
      }
    }
    if (action.dataset.action === "undo" && undoLogoCrop(logo)) {
      render();
    }
    return;
  }
  const control = event.target.closest("[data-id]");
  if (!control) return;
  const logo = findLogo(control.dataset.id);
  if (logo) openCropper(logo);
});

gallery.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const fallback = image.dataset.fallback;
  if (!fallback || image.src.endsWith(fallback)) return;
  image.src = fallback;
}, true);

gallery.addEventListener("input", (event) => {
  const control = event.target.closest('[data-action="comment"]');
  if (!control) return;
  const logo = findLogo(control.dataset.id);
  if (!logo) return;
  const review = logoReview(logo);
  if (!review.comment && control.value.trim()) {
    const prefix = currentCommentPrefix();
    if (!/^[RA]:\s/.test(control.value)) control.value = `${prefix} ${control.value}`;
  }
  review.comment = control.value;
  const key = logoStateKey(logo);
  reviewState[key] = review;
  fitTextarea(control);
  saveReviewItem(key);
});

gallery.addEventListener("click", (event) => {
  if (event.target.closest("textarea")) event.stopPropagation();
}, true);

gallery.addEventListener("pointerdown", (event) => {
  if (event.target.closest("textarea")) event.stopPropagation();
}, true);

gallery.addEventListener("dragover", (event) => {
  if (!event.target.closest(".upload-card")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

gallery.addEventListener("drop", (event) => {
  if (!event.target.closest(".upload-card")) return;
  event.preventDefault();
  addFiles(event.dataTransfer.files);
});

addFileInput.addEventListener("change", async () => {
  if (addFileInput.files?.length) await addFiles(addFileInput.files);
  addFileInput.value = "";
});

cropCanvas.addEventListener("pointerdown", (event) => {
  if (!activeImage) return;
  cropCanvas.setPointerCapture(event.pointerId);
  const startPoint = getCanvasPoint(event);
  pointer = { ...hitTest(startPoint), startPoint, startCrop: { ...crop } };
  updateCropFromPointer(event);
});

cropCanvas.addEventListener("pointermove", updateCropFromPointer);
cropCanvas.addEventListener("pointerup", () => {
  pointer = null;
});
cropCanvas.addEventListener("pointercancel", () => {
  pointer = null;
});

Object.entries(aspectButtons).forEach(([aspect, button]) => {
  button.addEventListener("click", () => {
    activeAspect = aspect;
    Object.entries(aspectButtons).forEach(([key, item]) => item.classList.toggle("active", key === aspect));
    crop = applyAspect(crop);
    drawCropper();
  });
});

resetCrop.addEventListener("click", () => {
  if (!activeLogo) return;
  const key = logoStateKey(activeLogo);
  pushCropHistory(key);
  delete cropOverrides[key];
  saveCropState(key);
  activeImage = null;
  openCropper(activeLogo);
  render();
});

saveCrop.addEventListener("click", () => {
  if (!activeLogo) return;
  const key = logoStateKey(activeLogo);
  pushCropHistory(key);
  cropOverrides[key] = makeCroppedDataUrl();
  saveCropState(key);
  cropDialog.close();
  render();
});

undoCrop.addEventListener("click", () => {
  if (!activeLogo || !undoLogoCrop(activeLogo)) return;
  activeImage = null;
  openCropper(activeLogo);
  render();
});

downloadCrop.addEventListener("click", () => {
  if (!activeLogo) return;
  const link = document.createElement("a");
  link.href = makeCroppedDataUrl();
  link.download = `beton-logo-${String(activeLogo.id).padStart(2, "0")}-crop.jpg`;
  link.click();
});

window.addEventListener("resize", () => {
  if (!cropDialog.open || !activeImage) return;
  resizeCanvas();
  drawCropper();
});

toggleTextEdit.addEventListener("click", () => setTextEditMode(true));
saveTextEdit.addEventListener("click", () => {
  const text = currentTextValues();
  writeJson(textStoreKey, text);
  schedulePersist({ text });
  setTextEditMode(false);
});
resetTextEdit.addEventListener("click", () => {
  localStorage.removeItem(textStoreKey);
  applySavedText();
  schedulePersist({ text: Object.fromEntries(Object.keys(defaults).map((key) => [key, null])) });
  setTextEditMode(false);
});

async function startApp() {
  showApp();
  applySavedText();
  const response = await fetch("/logos.json");
  logos = await response.json();
  await loadSharedState();
  render();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: loginName.value.trim(), password: loginPassword.value }),
  });
  if (!response.ok) {
    showLogin("Naam of wachtwoord klopt niet.");
    return;
  }
  currentSession = await response.json();
  loginPassword.value = "";
  await startApp();
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  currentSession = null;
  showLogin("");
});

(async () => {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) {
    showLogin("");
    return;
  }
  currentSession = await response.json();
  await startApp();
})();
