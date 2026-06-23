const loginView = document.querySelector("#loginView");
const projectView = document.querySelector("#projectView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginName = document.querySelector("#loginName");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const logoutButton = document.querySelector("#logoutButton");
const projectLogoutButton = document.querySelector("#projectLogoutButton");
const projectOverviewButton = document.querySelector("#projectOverviewButton");
const projectList = document.querySelector("#projectList");
const newProjectToggle = document.querySelector("#newProjectToggle");
const newProjectForm = document.querySelector("#newProjectForm");
const newProjectTitle = document.querySelector("#newProjectTitle");
const newProjectPassword = document.querySelector("#newProjectPassword");
const newVoterRows = Array.from(document.querySelectorAll(".new-voter-row"));
const copyNewProjectLink = document.querySelector("#copyNewProjectLink");
const newProjectError = document.querySelector("#newProjectError");
const voteButtons = document.querySelector("#voteButtons");
const sheetDialog = document.querySelector("#sheetDialog");
const sheetTitle = document.querySelector("#sheetTitle");
const sheetStage = document.querySelector("#sheetStage");
const sheetCanvas = document.querySelector("#sheetCanvas");
const sheetContext = sheetCanvas.getContext("2d");
const sheetResetButton = document.querySelector("#sheetResetButton");
const sheetCutButton = document.querySelector("#sheetCutButton");
const sheetStatus = document.querySelector("#sheetStatus");
const captureDialog = document.querySelector("#captureDialog");
const captureTitle = document.querySelector("#captureTitle");
const captureCanvas = document.querySelector("#captureCanvas");
const captureContext = captureCanvas.getContext("2d");
const captureResetButton = document.querySelector("#captureResetButton");
const captureSaveButton = document.querySelector("#captureSaveButton");
const captureStatus = document.querySelector("#captureStatus");
const gallery = document.querySelector("#gallery");
const count = document.querySelector("#count");
const controls = document.querySelector(".controls");
const addedFilter = document.querySelector("#addedFilter");
const deletedFilter = document.querySelector("#deletedFilter");
const sortSelect = document.querySelector("#sortSelect");
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
const lightboxDialog = document.querySelector("#lightboxDialog");
const lightboxMediaStage = document.querySelector("#lightboxMediaStage");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxClose = document.querySelector("#lightboxClose");
const lightboxStop = document.querySelector("#lightboxStop");

const cropStoreKey = "beton-logo-crops-v2";
const cropHistoryStoreKey = "beton-logo-crop-history-v1";
const reviewStoreKey = "beton-logo-review-state-v1";
const addedItemsStoreKey = "beton-logo-added-items-v1";
const textStoreKey = "beton-logo-page-text-v1";
const sortStoreKey = "beton-logo-sort-order-v1";
const sortOptions = new Set(["popular-desc", "popular-asc", "newest-desc", "upload-asc", "upload-desc", "size-asc", "size-desc"]);
const ratingOptions = ["🤩", "🙂", "🆗", "🤔", "🤮"];
const ratingScore = { "🤩": 5, "🙂": 4, "🆗": 3, "🤔": 2, "🤮": 1 };
const voterPalette = [
  { id: "green", color: "#60d46f" },
  { id: "blue", color: "#9adfff" },
  { id: "yellow", color: "#ffd85a" },
  { id: "purple", color: "#b89cff" },
];
const rodgerVoterColor = { id: "pink", color: "#ff30d6" };
const sheetBoxPalette = ["#ff1d1d", "#60d46f", "#ff30d6", "#2d9cff"];
const defaults = Object.fromEntries(editableTextNodes.map((node) => [node.dataset.editKey, node.textContent]));
const initialParams = new URLSearchParams(window.location.search);
let activeProjectId = initialParams.get("project") || "Alien";

let logos = [];
let cropOverrides = readJson(cropStoreKey, {});
let cropHistory = readJson(cropHistoryStoreKey, {});
let reviewState = readJson(reviewStoreKey, {});
let addedItems = readJson(addedItemsStoreKey, {});
let activeFilter = "all";
let activeSort = localStorage.getItem(sortStoreKey) || "upload-asc";
if (!sortOptions.has(activeSort)) activeSort = "upload-asc";
let activeLogo = null;
let activeImage = null;
let activeAspect = "free";
let imageRect = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let crop = { x: 0, y: 0, width: 1, height: 1 };
let pointer = null;
let pendingPatch = {};
let persistTimer = null;
let persistQueue = Promise.resolve();
let stateVersion = 0;
let currentSession = null;
let currentProjects = [];
let activeProject = null;
let voterColorState = {};
let sheetImage = null;
let sheetImageName = "";
let sheetBoxes = [];
let sheetImageRect = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let sheetPointer = null;
let activeSheetLogo = null;
let captureImage = null;
let captureImageName = "";
let captureBox = { x: 0, y: 0, width: 1, height: 1 };
let captureImageRect = { x: 0, y: 0, width: 1, height: 1, scale: 1 };
let capturePointer = null;
let activeCaptureLogo = null;
let lastCreatedProject = null;
let ratingRequestSerial = 0;
const latestRatingRequest = new Map();
let realtimeVoteTimer = null;
let realtimeVoteInFlight = false;
let realtimeVoteHoldUntil = 0;

function showLogin(message = "") {
  loginView.hidden = false;
  projectView.hidden = true;
  appView.hidden = true;
  loginError.textContent = message;
  const invitedName = new URLSearchParams(window.location.search).get("name");
  if (invitedName && !loginName.value) loginName.value = invitedName;
  loginName.focus();
}

function showProjects() {
  loginView.hidden = true;
  projectView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  projectView.hidden = true;
  appView.hidden = false;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function setProjectTitleFallback() {
  if (!activeProject) return;
  const saved = readJson(currentTextStoreKey(), {});
  const savedTitle = normalizeSavedText("title", saved.title);
  if (savedTitle && savedTitle !== defaults.title) return;
  editableTextNodes.forEach((node) => {
    if (node.dataset.editKey === "title") node.textContent = activeProject.title;
  });
}

function currentTextStoreKey() {
  return activeProjectId ? `${textStoreKey}:${activeProjectId}` : textStoreKey;
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
    text: readJson(currentTextStoreKey(), currentTextValues()),
    voters: voterColorState,
  };
}

function hasState(state) {
  return ["crops", "cropHistory", "review", "addedItems", "text", "voters"].some((key) => (
    Object.keys(state[key] || {}).length
  ));
}

function applyState(state) {
  cropOverrides = state.crops || {};
  cropHistory = state.cropHistory || {};
  reviewState = state.review || {};
  addedItems = state.addedItems || {};
  voterColorState = state.voters || {};
  writeJson(cropStoreKey, cropOverrides);
  writeJson(cropHistoryStoreKey, cropHistory);
  writeJson(reviewStoreKey, reviewState);
  writeJson(addedItemsStoreKey, addedItems);
  writeJson(currentTextStoreKey(), state.text || {});
  applySavedText();
}

async function persistNow(patch) {
  mergePatch(pendingPatch, patch);
  const toSend = pendingPatch;
  pendingPatch = {};
  try {
    const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSend),
    });
    if (!response.ok) throw new Error(await response.text());
    await response.json();
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

function queuePersist(patch) {
  persistQueue = persistQueue.catch(() => {}).then(() => persistNow(patch));
  return persistQueue;
}

async function loadSharedState() {
  const version = stateVersion + 1;
  stateVersion = version;
  try {
    const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const remote = await response.json();
    if (version !== stateVersion) return;
    const local = localSnapshot();
    if (hasState(remote)) {
      applyState(remote);
    } else if (activeProjectId === "Alien" && hasState(local)) {
      applyState(local);
      await persistNow(local);
    } else {
      applyState(remote);
    }
    normalizeAddedItemNumbers({ persist: true });
  } catch (error) {
    if (String(error.message || "").includes("401")) {
      showLogin("Log in om deze images te bekijken.");
      return;
    }
    console.error("State load failed, local backup active", error);
  }
}

async function refreshReviewItem(file) {
  try {
    const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const remote = await response.json();
    if (remote.review?.[file]) {
      reviewState[file] = remote.review[file];
      writeJson(reviewStoreKey, reviewState);
    }
    if (remote.voters) voterColorState = remote.voters;
  } catch (error) {
    console.error("Review refresh failed", error);
  }
}

function holdRealtimeVoteSync(duration = 2600) {
  realtimeVoteHoldUntil = Math.max(realtimeVoteHoldUntil, Date.now() + duration);
}

function voteSignature(votes) {
  return JSON.stringify(Object.fromEntries(Object.entries(votes || {}).sort(([a], [b]) => a.localeCompare(b))));
}

function mergeRealtimeVotes(remoteReview = {}, remoteVoters = {}) {
  let changed = false;
  const keys = new Set([...Object.keys(reviewState), ...Object.keys(remoteReview)]);
  keys.forEach((key) => {
    const remoteVotes = votesFor(remoteReview[key] || {});
    const localReview = reviewState[key] || {};
    const localVotes = votesFor(localReview);
    if (voteSignature(remoteVotes) === voteSignature(localVotes)) return;
    reviewState[key] = { ...localReview, votes: remoteVotes };
    delete reviewState[key].rating;
    delete reviewState[key].ratings;
    changed = true;
  });
  if (voteSignature(remoteVoters) !== voteSignature(voterColorState)) {
    voterColorState = remoteVoters || {};
    changed = true;
  }
  if (!changed) return false;
  writeJson(reviewStoreKey, reviewState);
  return true;
}

function canRealtimeVoteSync() {
  return !appView.hidden
    && Boolean(activeProjectId)
    && Boolean(currentSession)
    && document.visibilityState !== "hidden"
    && Date.now() >= realtimeVoteHoldUntil
    && !Object.keys(pendingPatch).length;
}

async function syncRealtimeVotes() {
  if (realtimeVoteInFlight || !canRealtimeVoteSync()) return;
  realtimeVoteInFlight = true;
  try {
    const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}&realtime=votes`, { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const remote = await response.json();
    if (mergeRealtimeVotes(remote.review, remote.voters)) render();
  } catch (error) {
    console.error("Realtime vote sync failed", error);
  } finally {
    realtimeVoteInFlight = false;
  }
}

function startRealtimeVoteSync() {
  stopRealtimeVoteSync();
  realtimeVoteTimer = window.setInterval(syncRealtimeVotes, 1600);
  window.setTimeout(syncRealtimeVotes, 600);
}

function stopRealtimeVoteSync() {
  if (realtimeVoteTimer) window.clearInterval(realtimeVoteTimer);
  realtimeVoteTimer = null;
  realtimeVoteInFlight = false;
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
  if (logo.blobPathname || logo.url) return cropOverrides[key] || mediaSource(logo);
  return cropOverrides[key] || logoPath(logo.file);
}

function imageFallbackSource(logo) {
  return logo.dataUrl ? "" : logoPath(logo.file);
}

function allLogos() {
  return [...logos, ...Object.values(addedItems)];
}

function isNumberedUpload(logo) {
  return logo?.added && !(logo.captureRootKey || logo.captureParentKey);
}

function uploadNumberLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `#${String(Math.max(0, number)).padStart(3, "0")}`;
}

function usedUploadNumbers() {
  const used = new Set();
  Object.values(addedItems).forEach((item) => {
    const number = Number(item.uploadNumber);
    if (isNumberedUpload(item) && Number.isInteger(number) && number >= 0) used.add(number);
  });
  return used;
}

function firstFreeUploadNumber(used) {
  let number = 0;
  while (used.has(number)) number += 1;
  used.add(number);
  return number;
}

function normalizeAddedItemNumbers(options = {}) {
  const { persist = false } = options;
  const used = usedUploadNumbers();
  const patch = {};
  Object.entries(addedItems)
    .filter(([, item]) => isNumberedUpload(item) && !Number.isInteger(Number(item.uploadNumber)))
    .sort(([, a], [, b]) => logoCreatedOrder(a, 0) - logoCreatedOrder(b, 0) || String(a.id || "").localeCompare(String(b.id || "")))
    .forEach(([key, item]) => {
      const uploadNumber = firstFreeUploadNumber(used);
      addedItems[key] = { ...item, uploadNumber };
      patch[key] = addedItems[key];
    });
  if (!Object.keys(patch).length) return;
  writeJson(addedItemsStoreKey, addedItems);
  if (persist) queuePersist({ addedItems: patch });
}

function findLogoByStateKey(key) {
  return allLogos().find((logo) => logoStateKey(logo) === key);
}

function baseSheetNumberLabel(logo) {
  if (!logo) return "#??";
  if (logo.captureNumberBase) return logo.captureNumberBase;
  if (isNumberedUpload(logo)) return uploadNumberLabel(logo.uploadNumber);
  if (!logo.added && logo.id !== undefined) return `#${String(logo.id).padStart(2, "0")}`;
  return "";
}

function captureRootKey(logo) {
  return logo.captureRootKey || logo.captureParentKey || logoStateKey(logo);
}

function relatedCaptureLogos(rootKey) {
  return allLogos()
    .filter((logo) => (logo.captureRootKey || logo.captureParentKey) === rootKey)
    .sort((a, b) => logoUploadOrder(a, 0) - logoUploadOrder(b, 0) || String(logoStateKey(a)).localeCompare(String(logoStateKey(b))));
}

function firstFreeCaptureLetter(used) {
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index);
    if (!used.has(letter)) return letter;
  }
  return "Z";
}

function nextCaptureLetter(rootKey) {
  const used = new Set();
  relatedCaptureLogos(rootKey).forEach((logo) => {
    if (/^[A-Z]$/.test(logo.captureSuffix || "")) used.add(logo.captureSuffix);
    else used.add(firstFreeCaptureLetter(used));
  });
  return firstFreeCaptureLetter(used);
}

function captureLetterForLogo(logo) {
  if (/^[A-Z]$/.test(logo.captureSuffix || "")) return logo.captureSuffix;
  const rootKey = logo.captureRootKey || logo.captureParentKey;
  if (!rootKey) return "";
  const used = new Set();
  let fallback = "";
  relatedCaptureLogos(rootKey).forEach((item) => {
    const letter = /^[A-Z]$/.test(item.captureSuffix || "") ? item.captureSuffix : firstFreeCaptureLetter(used);
    used.add(letter);
    if (logoStateKey(item) === logoStateKey(logo)) fallback = letter;
  });
  return fallback;
}

function logoNumberLabel(logo) {
  const rootKey = logo.captureRootKey || logo.captureParentKey;
  if (rootKey) {
    const rootLogo = findLogoByStateKey(rootKey);
    return `${logo.captureNumberBase || baseSheetNumberLabel(rootLogo)}${captureLetterForLogo(logo)}`;
  }
  return baseSheetNumberLabel(logo);
}

function captureColorValue(color) {
  if (!color) return "";
  if (typeof color === "string") return color;
  return color.color || "";
}

function latestCaptureForLogo(logo) {
  const key = logoStateKey(logo);
  return relatedCaptureLogos(captureRootKey(logo))
    .filter((capture) => capture.captureParentKey === key || capture.captureRootKey === key)
    .sort((a, b) => logoCreatedOrder(b, 0) - logoCreatedOrder(a, 0))[0] || null;
}

function captureButtonColor(logo) {
  if (logo.captureCreatorColor) return captureColorValue(logo.captureCreatorColor);
  return "";
}

function captureButtonStyle(logo) {
  const color = captureButtonColor(logo) || "var(--voter-yellow)";
  return `style="--capture-button-bg: ${escapeHtml(color)}"`;
}

function isImageLogo(logo) {
  return !logo.type || logo.type.startsWith("image/");
}

function fileExtension(logo) {
  return String(logo.name || logo.file || "").split(".").pop().toLowerCase();
}

function isVideoLogo(logo) {
  return String(logo.type || "").startsWith("video/") || ["mov", "mp4", "m4v"].includes(fileExtension(logo));
}

function isAudioLogo(logo) {
  return String(logo.type || "").startsWith("audio/") || ["aac", "mp3", "m4a"].includes(fileExtension(logo));
}

function isPlayableMedia(logo) {
  return isVideoLogo(logo) || isAudioLogo(logo);
}

function mediaSource(logo) {
  if (logo.blobPathname) {
    return `/api/media?project=${encodeURIComponent(activeProjectId)}&path=${encodeURIComponent(logo.blobPathname)}`;
  }
  return logo.url || logo.dataUrl || logoPath(logo.file);
}

function renderMediaStage(logo, safeName) {
  if (logo.uploading) {
    const progress = Math.max(0, Math.min(99, Math.round(logo.uploadProgress || 0)));
    return `
      <div class="media-frame upload-progress-frame">
        <div class="upload-logo-loader" aria-hidden="true"></div>
        <strong>${safeName}</strong>
        <div class="upload-progress-track" aria-label="Upload ${progress}%">
          <span style="width: ${progress}%"></span>
        </div>
        <small>${progress ? `${progress}%` : "Upload starten"}</small>
      </div>
    `;
  }
  if (logo.uploadError) {
    return `
      <div class="media-frame upload-error-frame">
        <strong>${safeName}</strong>
        <span>Upload mislukt</span>
      </div>
    `;
  }
  const src = escapeHtml(mediaSource(logo));
  if (isVideoLogo(logo)) {
    return `
      <div class="media-frame video-frame">
        <video controls preload="metadata" src="${src}" aria-label="${safeName}"></video>
        <div class="media-actions">
          <button class="media-open" type="button" data-action="open-media" data-id="${logo.id}">Groot</button>
          <button class="media-stop" type="button" data-action="stop-media" data-id="${logo.id}">Stop</button>
        </div>
      </div>
    `;
  }
  if (isAudioLogo(logo)) {
    return `
      <div class="media-frame audio-frame">
        <strong>${safeName}</strong>
        <audio controls preload="metadata" src="${src}" aria-label="${safeName}"></audio>
        <div class="media-actions">
          <button class="media-open" type="button" data-action="open-media" data-id="${logo.id}">Groot</button>
          <button class="media-stop" type="button" data-action="stop-media" data-id="${logo.id}">Stop</button>
        </div>
      </div>
    `;
  }
  return `
    <button class="image-button file-preview" type="button" data-id="${logo.id}">
      <span class="file-kind">${escapeHtml(logo.type || "bestand")}</span><strong>${safeName}</strong>
    </button>
  `;
}

function visibleLogos() {
  const list = allLogos();
  if (activeFilter === "deleted") return list.filter((logo) => reviewState[logoStateKey(logo)]?.deleted);
  const active = list.filter((logo) => !reviewState[logoStateKey(logo)]?.deleted);
  if (activeFilter === "TOEGEVOEGD") return active.filter((logo) => logo.group === "TOEGEVOEGD" || logo.group === "ADDED");
  if (activeFilter.startsWith("vote-color-")) return active.filter((logo) => hasVoteColor(logo, activeFilter.replace("vote-color-", "")));
  if (activeFilter === "all") return active;
  return active.filter((logo) => tagsFor(logo, logoReview(logo)).includes(activeFilter));
}

function logoUploadOrder(logo, fallbackIndex) {
  if (logo.captureRootKey || logo.captureParentKey) {
    const rootLogo = findLogoByStateKey(logo.captureRootKey || logo.captureParentKey);
    const baseLabel = logo.captureNumberBase || baseSheetNumberLabel(rootLogo);
    const baseNumber = Number(String(baseLabel || "").replace(/^#/, ""));
    const suffix = captureLetterForLogo(logo);
    const suffixIndex = /^[A-Z]$/.test(suffix) ? suffix.charCodeAt(0) - 64 : 1;
    if (Number.isFinite(baseNumber)) return baseNumber + suffixIndex / 100;
  }
  if (isNumberedUpload(logo) && Number.isFinite(Number(logo.uploadNumber))) return Number(logo.uploadNumber);
  if (Number.isFinite(Number(logo.manualOrder))) return Number(logo.manualOrder);
  const id = String(logo.id || "");
  const timestamp = id.match(/^(?:added|sheet)-(\d+)/)?.[1];
  if (timestamp) return Number(timestamp);
  return Number(logo.sourceIndex || logo.id || fallbackIndex + 1);
}

function logoCreatedOrder(logo, fallbackIndex) {
  const id = String(logo.id || "");
  const timestamp = id.match(/^(?:added|sheet|capture)-(\d+)/)?.[1];
  if (timestamp) return Number(timestamp);
  return Number(logo.sourceIndex || logo.id || fallbackIndex + 1);
}

function logoSize(logo) {
  if (Number.isFinite(Number(logo.size)) && Number(logo.size) > 0) return Number(logo.size);
  if (Number.isFinite(Number(logo.fileSize)) && Number(logo.fileSize) > 0) return Number(logo.fileSize);
  if (logo.dataUrl) {
    const body = String(logo.dataUrl).split(",")[1] || "";
    return Math.round((body.length * 3) / 4);
  }
  return 0;
}

function popularity(logo) {
  const scores = Object.values(votesFor(logoReview(logo)))
    .map((rating) => ratingScore[rating])
    .filter(Boolean);
  const total = scores.reduce((sum, score) => sum + score, 0);
  return {
    count: scores.length,
    average: scores.length ? total / scores.length : 0,
  };
}

function compareByFallback(a, b) {
  return a.order - b.order;
}

function sortedVisibleLogos() {
  const decorated = visibleLogos().map((logo, order) => ({ logo, order }));
  decorated.sort((a, b) => {
    if (activeSort === "popular-desc" || activeSort === "popular-asc") {
      const left = popularity(a.logo);
      const right = popularity(b.logo);
      if (left.count !== right.count && (!left.count || !right.count)) return right.count - left.count;
      if (left.average !== right.average) {
        return activeSort === "popular-desc" ? right.average - left.average : left.average - right.average;
      }
      if (left.count !== right.count) return right.count - left.count;
      return compareByFallback(a, b);
    }
    if (activeSort === "newest-desc") return logoCreatedOrder(b.logo, b.order) - logoCreatedOrder(a.logo, a.order) || compareByFallback(a, b);
    if (activeSort === "upload-desc") return logoUploadOrder(b.logo, b.order) - logoUploadOrder(a.logo, a.order) || compareByFallback(a, b);
    if (activeSort === "size-asc") return logoSize(a.logo) - logoSize(b.logo) || compareByFallback(a, b);
    if (activeSort === "size-desc") return logoSize(b.logo) - logoSize(a.logo) || compareByFallback(a, b);
    return logoUploadOrder(a.logo, a.order) - logoUploadOrder(b.logo, b.order) || compareByFallback(a, b);
  });
  return decorated.map((item) => item.logo);
}

function logoReview(logo) {
  return reviewState[logoStateKey(logo)] || {};
}

function currentVoterKey() {
  return currentSession?.client || "unknown";
}

function legacyClientVoterKey() {
  return activeProject?.clientName || "Alien";
}

function votesFor(review) {
  const votes = {};
  if (review.rating) votes[legacyClientVoterKey()] = review.rating;
  if (review.ratings?.client) votes[legacyClientVoterKey()] = review.ratings.client;
  if (review.ratings?.admin) votes.Rodger = review.ratings.admin;
  if (review.ratings?.voter3) votes.__legacyBlue = review.ratings.voter3;
  return { ...votes, ...(review.votes || {}) };
}

function hasLegacyClientVotes() {
  return Object.values(reviewState).some((review) => review.rating || review.ratings?.client);
}

function hasLegacyBlueVotes() {
  return Object.values(reviewState).some((review) => review.ratings?.voter3);
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function projectInvitees(project = activeProject) {
  return Array.isArray(project?.invitees) ? project.invitees.filter((invitee) => invitee.name) : [];
}

function projectVoterEntries(project = activeProject) {
  const entries = [];
  entries.push({ name: "Rodger", firstName: "Rodger", color: rodgerVoterColor, isAdmin: true });
  projectInvitees(project).forEach((invitee, index) => {
    entries.push({
      name: invitee.name,
      firstName: firstName(invitee.name),
      password: invitee.password || "",
      color: invitee.color || voterPalette[index % voterPalette.length],
    });
  });
  if (!projectInvitees(project).length && project?.clientName && project.clientName !== "Rodger") {
    entries.push({ name: project.clientName, firstName: firstName(project.clientName), color: voterPalette[0] });
  }
  return entries;
}

function fallbackColorForVoter(voterKey) {
  if (voterKey === "Rodger") return rodgerVoterColor;
  if (voterColorState[voterKey]) return voterColorState[voterKey];
  const projectVoter = projectVoterEntries().find((entry) => entry.name === voterKey);
  if (projectVoter?.color) return projectVoter.color;
  if (voterKey === "__legacyBlue") return voterPalette[1];
  if (voterKey === "Alien" || voterKey === "client") return voterPalette[0];
  if (voterKey === legacyClientVoterKey() && hasLegacyClientVotes()) return voterPalette[0];
  return null;
}

function colorForVoter(voterKey) {
  return fallbackColorForVoter(voterKey) || voterPalette[0];
}

function usedVoterColorIds() {
  const used = new Set(Object.values(voterColorState).map((item) => item.id));
  if (hasLegacyClientVotes()) used.add(voterPalette[0].id);
  if (hasLegacyBlueVotes()) used.add(voterPalette[1].id);
  return used;
}

function colorForCurrentVoter() {
  const key = currentVoterKey();
  const existing = fallbackColorForVoter(key);
  if (existing || currentSession?.role === "admin") return existing || rodgerVoterColor;
  const used = usedVoterColorIds();
  const available = voterPalette.filter((item) => !used.has(item.id));
  return available[0] || voterPalette[0];
}

function ensureCurrentVoterRegistered(options = {}) {
  const { persist = true } = options;
  if (!currentSession || !activeProjectId) return { key: "", color: null, changed: false };
  const key = currentVoterKey();
  const color = colorForCurrentVoter();
  if (voterColorState[key]?.id === color.id) return { key, color, changed: false };
  voterColorState = { ...voterColorState, [key]: color };
  if (persist) schedulePersist({ voters: { [key]: color } });
  return { key, color, changed: true };
}

function votersForRating(votes, rating) {
  return Object.entries(votes)
    .filter(([, value]) => value === rating)
    .map(([voterKey]) => ({ voterKey, ...colorForVoter(voterKey) }));
}

function voteBackground(voters) {
  if (!voters.length) return "";
  if (voters.length === 1) return voters[0].color;
  const stop = 100 / voters.length;
  const segments = voters.flatMap((item, index) => {
    const start = (stop * index).toFixed(4);
    const end = (stop * (index + 1)).toFixed(4);
    return [`${item.color} ${start}%`, `${item.color} ${end}%`];
  });
  return `linear-gradient(90deg, ${segments.join(", ")})`;
}

function ratingButtonStyle(voters) {
  const background = voteBackground(voters);
  return background ? ` style="background: ${background}"` : "";
}

function colorFilterValue(colorId) {
  return `vote-color-${colorId}`;
}

function hasVoteColor(logo, colorId) {
  const votes = votesFor(logoReview(logo));
  return Object.keys(votes).some((voterKey) => colorForVoter(voterKey).id === colorId);
}

function allActiveVoteColors() {
  const colors = new Map(projectVoterEntries().map((entry) => [entry.color.id, { ...entry.color, name: entry.firstName }]));
  Object.values(voterColorState).forEach((color) => colors.set(color.id, color));
  allLogos().forEach((logo) => {
    Object.keys(votesFor(logoReview(logo))).forEach((voterKey) => {
      const color = colorForVoter(voterKey);
      if (!colors.has(color.id)) colors.set(color.id, { ...color, name: firstName(voterKey) });
    });
  });
  return [...colors.values()].sort((a, b) => {
    const order = { pink: 1, green: 2, blue: 3, yellow: 4, purple: 5 };
    return (order[a.id] || 9) - (order[b.id] || 9);
  });
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

function tagsFromFileName(name) {
  const tags = [];
  const source = String(name || "");
  const hashtagPattern = /#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
  let match;
  while ((match = hashtagPattern.exec(source))) tags.push(match[1]);
  return uniqueTags(tags);
}

function inferredTags(logo) {
  const text = `${logo.group || ""} ${logo.source || ""} ${logo.name || ""} ${logo.file || ""}`;
  const tags = [logo.group || "TOEGEVOEGD"];
  if (logo.duplicateUpload) tags.push("AL UPLOADED!");
  if (isAudioLogo(logo)) tags.push("AUDIO");
  else if (isVideoLogo(logo)) tags.push("VIDEO");
  else if (/\b3d\b/i.test(text)) tags.push("3D");
  else tags.push("GRAFISCH");
  return uniqueTags(tags);
}

function tagsFor(logo, review) {
  return review.customTags ? uniqueTags(review.customTags) : inferredTags(logo);
}

function visibleTagsFor(logo, review) {
  return tagsFor(logo, review).filter((tag) => normalizeTag(tag) !== "TOEGEVOEGD");
}

function isTagFiltered() {
  return !["all", "TOEGEVOEGD", "deleted"].includes(activeFilter) && !activeFilter.startsWith("vote-color-");
}

function renderTags(logo, review) {
  const tags = visibleTagsFor(logo, review);
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
    visibleTagsFor(logo, logoReview(logo)).forEach((tag) => tags.add(tag));
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
  const activeColors = allActiveVoteColors();
  voteButtons.innerHTML = activeColors.map((color) => `
    <div class="vote-chip">
      <button
        class="vote-filter ${activeFilter === colorFilterValue(color.id) ? "active" : ""}"
        type="button"
        data-filter="${colorFilterValue(color.id)}"
        aria-label="Stemmen van ${escapeHtml(color.name || color.id)} tonen"
        style="background: ${color.color}"
      ></button>
      <span>${escapeHtml(color.name || color.id)}</span>
    </div>
  `).join("");
}

function currentCommentPrefix() {
  if (currentSession?.role === "admin") return "R:";
  if (currentSession?.role === "voter3") return "B:";
  return "A:";
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
  const durableItems = Object.fromEntries(Object.entries(addedItems).filter(([, item]) => !item.uploading));
  writeJson(addedItemsStoreKey, durableItems);
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

function removeLocalAddedAsset(key) {
  delete addedItems[key];
  delete reviewState[key];
  delete cropOverrides[key];
  delete cropHistory[key];
  saveAddedItems();
  saveReview();
  writeJson(cropStoreKey, cropOverrides);
  writeJson(cropHistoryStoreKey, cropHistory);
}

async function deleteAddedAsset(logo, key) {
  if (logo.uploading) {
    removeLocalAddedAsset(key);
    render();
    return;
  }
  await persistQueue.catch(() => {});
  const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}&asset=${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await response.text());
  removeLocalAddedAsset(key);
  render();
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
  if (sortSelect && sortSelect.value !== activeSort) sortSelect.value = activeSort;
  const visible = sortedVisibleLogos();
  count.textContent = visible.length;
  const showUploadCard = activeFilter !== "deleted";
  gallery.innerHTML = `${visible
    .map(
      (logo) => {
        const review = logoReview(logo);
        const safeSource = escapeHtml(imageCopy(logo.source));
        const safeName = escapeHtml(logo.name || `Image ${logo.id}`);
        const croppable = isImageLogo(logo) && !logo.uploading && !logo.uploadError;
        return `
        <article class="logo-card ${review.deleted ? "is-deleted" : ""}">
          ${croppable
            ? `<button class="image-button" type="button" data-id="${logo.id}">
                <img src="${imageSource(logo)}" data-fallback="${imageFallbackSource(logo)}" alt="${safeName}, ${logo.group}" loading="lazy" />
              </button>`
            : renderMediaStage(logo, safeName)}
          <div class="meta">
            <div class="meta-row">
              <span class="number">${escapeHtml(logoNumberLabel(logo))}</span>
              ${renderTags(logo, review)}
            </div>
            <div class="source">${logo.added ? `Toegevoegd: ${safeSource}` : `Bron ${logo.sourceIndex}.${logo.dotIndex}: ${safeSource}`}</div>
            <div class="rating" role="group" aria-label="Rating voor image ${logo.id}">
              ${ratingOptions.map((rating) => {
                const votes = votesFor(review);
                const voteVoters = votersForRating(votes, rating);
                const currentVoted = votes[currentVoterKey()] === rating;
                return `
                <button
                  class="rating-button"
                  type="button"
                  data-action="rating"
                  data-id="${logo.id}"
                  data-rating="${rating}"
                  data-vote-count="${voteVoters.length}"
                  data-current-voted="${currentVoted ? "true" : "false"}"
                  aria-label="Rating ${rating}"
                  ${ratingButtonStyle(voteVoters)}
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
              ${croppable ? `<button class="edit-logo" type="button" data-id="${logo.id}" aria-label="Bijsnijden">🪚</button>` : ""}
              ${croppable ? `<button class="capture-logo" type="button" data-action="capture" data-id="${logo.id}" aria-label="Single capture" ${captureButtonStyle(logo)}>📸</button>` : ""}
              ${croppable && logo.added ? `<button class="sheet-logo" type="button" data-action="sheet-cut" data-id="${logo.id}" aria-label="Sheet cut-up">✂️</button>` : ""}
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
        <strong>Nieuwe image, video, audio of sheet</strong>
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
  if (key === "title" && value === "Logo review") return activeProject?.title || defaults.title;
  if (key === "title" && value === "Images review") return activeProject?.title || defaults.title;
  if (key === "title" && value === "ANÓTHER DIMENSION VOTING BOOTH") return activeProject?.title || defaults.title;
  if (key === "title" && value === defaults.title && activeProject?.title && activeProject.title !== defaults.title) return activeProject.title;
  return value;
}

function applySavedText() {
  const saved = readJson(currentTextStoreKey(), {});
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

function inviteUrl(project, name = "") {
  const params = new URLSearchParams({ project: project.id });
  if (name) params.set("name", name);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

async function copyProjectLink(project, name = "") {
  await navigator.clipboard.writeText(inviteUrl(project, name));
}

function currentUserAccentColor() {
  return ensureCurrentVoterRegistered({ persist: false }).color?.color || rodgerVoterColor.color;
}

function flashCopySuccess(button) {
  if (!button) return;
  const color = currentUserAccentColor();
  button.style.setProperty("--copy-success-color", color);
  button.classList.add("copy-success");
  window.setTimeout(() => {
    button.classList.remove("copy-success");
  }, 1400);
}

function renderProjectList() {
  if (!currentProjects.length) {
    projectList.innerHTML = '<p class="project-empty">Geen projecten voor deze login.</p>';
    return;
  }
  projectList.innerHTML = currentProjects.map((project) => `
    <article class="project-card">
      <button class="project-open" type="button" data-project-id="${escapeHtml(project.id)}">
        <span>${escapeHtml(project.title)}</span>
        <small>${escapeHtml(project.id)}</small>
      </button>
      ${project.canManage ? `
        <div class="project-actions">
          <button class="project-copy" type="button" data-project-copy="${escapeHtml(project.id)}">COPY PROJECT LINK</button>
          ${project.baseAssets ? "" : `<button class="project-delete" type="button" data-project-delete="${escapeHtml(project.id)}" aria-label="Project verwijderen">☠️</button>`}
        </div>
        ${projectInvitees(project).length ? `
          <div class="project-voters">
            ${projectInvitees(project).map((invitee) => `
              <div class="project-voter">
                <span class="project-voter-color" style="background: ${escapeHtml((invitee.color || voterPalette[0]).color)}"></span>
                <strong>${escapeHtml(firstName(invitee.name))}</strong>
                <small>${invitee.password ? `pass: ${escapeHtml(invitee.password)}` : escapeHtml(invitee.name)}</small>
                <button class="project-copy voter-link-copy" type="button" data-project-copy="${escapeHtml(project.id)}" data-invite-name="${escapeHtml(invitee.name)}">COPY LINK</button>
              </div>
            `).join("")}
          </div>
        ` : ""}
      ` : ""}
    </article>
  `).join("");
}

async function loadProjects() {
  const response = await fetch("/api/projects", { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  currentProjects = data.projects || [];
  currentSession = data.session || currentSession;
  renderProjectList();
}

async function showProjectOverview() {
  showProjects();
  try {
    await loadProjects();
  } catch (error) {
    console.error("Project load failed", error);
    showLogin("Log opnieuw in.");
  }
}

async function returnToProjectOverview() {
  stopRealtimeVoteSync();
  stopMedia(document);
  if (lightboxDialog.open) closeLightbox();
  if (cropDialog.open) cropDialog.close();
  if (Object.keys(pendingPatch).length) await persistNow({});
  activeProject = null;
  await showProjectOverview();
}

async function openProject(projectId) {
  const project = currentProjects.find((item) => item.id === projectId);
  if (!project) return;
  activeProject = project;
  activeProjectId = project.id;
  activeFilter = "all";
  pendingPatch = {};
  clearTimeout(persistTimer);
  editableTextNodes.forEach((node) => {
    if (node.dataset.editKey === "title") node.textContent = project.title;
  });
  await startApp();
}

function openLightbox(logo) {
  if (!logo || (!isImageLogo(logo) && !isPlayableMedia(logo))) return;
  stopMedia(lightboxDialog);
  lightboxMediaStage.innerHTML = "";
  lightboxMediaStage.hidden = true;
  lightboxImage.hidden = true;
  lightboxStop.hidden = true;
  if (isImageLogo(logo)) {
    lightboxImage.hidden = false;
    lightboxImage.src = imageSource(logo);
    lightboxImage.dataset.fallback = imageFallbackSource(logo);
    lightboxImage.alt = logo.name || `Image ${logo.id}`;
  } else if (isVideoLogo(logo)) {
    lightboxMediaStage.hidden = false;
    lightboxMediaStage.innerHTML = `<video controls autoplay src="${escapeHtml(mediaSource(logo))}" aria-label="${escapeHtml(logo.name || `Video ${logo.id}`)}"></video>`;
    lightboxStop.hidden = false;
  } else if (isAudioLogo(logo)) {
    lightboxMediaStage.hidden = false;
    lightboxMediaStage.innerHTML = `
      <div class="lightbox-audio">
        <strong>${escapeHtml(logo.name || `Audio ${logo.id}`)}</strong>
        <audio controls autoplay src="${escapeHtml(mediaSource(logo))}" aria-label="${escapeHtml(logo.name || `Audio ${logo.id}`)}"></audio>
      </div>
    `;
    lightboxStop.hidden = false;
  }
  lightboxDialog.showModal();
}

function closeLightbox() {
  stopMedia(lightboxDialog);
  lightboxMediaStage.innerHTML = "";
  lightboxMediaStage.hidden = true;
  lightboxImage.removeAttribute("src");
  if (lightboxDialog.open) lightboxDialog.close();
}

function stopMedia(root = document) {
  root.querySelectorAll("audio, video").forEach((media) => {
    media.pause();
    try {
      media.currentTime = 0;
    } catch {
      // Some browsers refuse currentTime changes before media metadata exists.
    }
  });
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

function safeUploadName(file) {
  return String(file.name || "upload")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "upload";
}

function putFileWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 92) + 6);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText || "{}"));
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(request.responseText || `Upload failed with ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error("Upload verbinding mislukt"));
    request.send(file);
  });
}

async function uploadMediaFile(file, id, onProgress) {
  onProgress?.(2);
  const ticketResponse = await fetch(`/api/upload-url?project=${encodeURIComponent(activeProjectId)}&name=${encodeURIComponent(`${id}-${safeUploadName(file)}`)}&type=${encodeURIComponent(file.type || "application/octet-stream")}`, {
    method: "POST",
  });
  if (!ticketResponse.ok) throw new Error(await ticketResponse.text());
  const ticket = await ticketResponse.json();
  onProgress?.(6);
  const result = await putFileWithProgress(ticket.presignedUrl, file, onProgress);
  onProgress?.(99);
  return {
    url: result.url,
    blobPathname: blobPathnameFromUrl(result.url) || result.pathname || ticket.pathname,
  };
}

function blobPathnameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

function uploadDuplicateKey(file) {
  return `${safeUploadName(file).toLowerCase()}|${file.size || 0}`;
}

function existingUploadKeys() {
  const keys = new Set();
  allLogos().forEach((logo) => {
    if (logo.uploading || logo.uploadError) return;
    if (logo.duplicateKey) keys.add(logo.duplicateKey);
    if (logo.name && logo.size) keys.add(`${safeUploadName({ name: logo.name }).toLowerCase()}|${logo.size}`);
    if (logo.name) keys.add(`name:${String(logo.name).toLowerCase()}`);
  });
  return keys;
}

function updateUploadPlaceholder(id, patch) {
  if (!addedItems[id]) return;
  addedItems[id] = { ...addedItems[id], ...patch };
  render();
}

async function fileToStoredSource(file, id, onProgress) {
  if (file.type.startsWith("image/") && file.size > 350000) return uploadMediaFile(file, id, onProgress);
  if (file.type.startsWith("image/")) {
    onProgress?.(18);
    const dataUrl = await fileToStoredDataUrl(file);
    onProgress?.(99);
    return { dataUrl };
  }
  if (file.type.startsWith("video/") || file.type.startsWith("audio/") || /\.(mov|mp4|m4v|mp3|aac|m4a)$/i.test(file.name)) {
    return uploadMediaFile(file, id, onProgress);
  }
  onProgress?.(18);
  const dataUrl = await fileToStoredDataUrl(file);
  onProgress?.(99);
  return { dataUrl };
}

async function addFiles(files) {
  let comment = document.querySelector("#newUploadComment")?.value.trim() || "";
  if (comment && !/^[RA]:\s/.test(comment)) comment = `${currentCommentPrefix()} ${comment}`;
  const incomingFiles = Array.from(files);
  const seen = existingUploadKeys();
  const uploadNumbers = usedUploadNumbers();
  const uploads = incomingFiles.map((file) => {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duplicateKey = uploadDuplicateKey(file);
    const nameKey = `name:${String(file.name || "").toLowerCase()}`;
    const duplicateUpload = seen.has(duplicateKey) || seen.has(nameKey);
    const fileNameTags = tagsFromFileName(file.name);
    seen.add(duplicateKey);
    seen.add(nameKey);
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
      size: file.size || 0,
      duplicateKey,
      duplicateUpload,
      uploadNumber: firstFreeUploadNumber(uploadNumbers),
      uploading: true,
      uploadProgress: 0,
    };
    addedItems[id] = item;
    const review = { ...(reviewState[id] || {}) };
    if (fileNameTags.length) review.customTags = uniqueTags([...inferredTags(item), ...fileNameTags]);
    if (comment) {
      review.comment = comment;
      review.commentOpen = true;
    }
    if (review.customTags || review.comment) reviewState[id] = review;
    return { file, id };
  });
  render();

  for (const { file, id } of uploads) {
    let storedSource;
    const persistPatch = {};
    const reviewPatch = {};
    try {
      storedSource = await fileToStoredSource(file, id, (progress) => {
        const current = addedItems[id]?.uploadProgress || 0;
        if (progress >= 99 || progress - current >= 3) updateUploadPlaceholder(id, { uploadProgress: progress });
      });
    } catch (error) {
      console.error("Upload failed", error);
      storedSource = { uploadError: true };
    }
    const item = {
      ...addedItems[id],
      uploading: false,
      uploadProgress: storedSource.uploadError ? 0 : 100,
      ...storedSource,
    };
    addedItems[id] = item;
    persistPatch[id] = item;
    if (reviewState[id]) {
      reviewPatch[id] = reviewState[id];
    }
    saveAddedItems();
    saveReview();
    queuePersist({ addedItems: persistPatch, review: reviewPatch });
    render();
  }
}

function resetSheetCutter(closeDialog = false) {
  sheetImage = null;
  sheetImageName = "";
  sheetBoxes = [];
  sheetPointer = null;
  activeSheetLogo = null;
  sheetStatus.textContent = "";
  sheetContext.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  if (closeDialog && sheetDialog.open) sheetDialog.close();
}

function resetSheetBoxes() {
  if (!sheetImage) return;
  sheetPointer = null;
  sheetBoxes = detectSheetBoxes(sheetImage);
  drawSheetCutter();
  sheetStatus.textContent = `${sheetBoxes.length} vakken gevonden.`;
}

function averageCornerColor(data, width, height) {
  const points = [
    [4, 4],
    [width - 5, 4],
    [4, height - 5],
    [width - 5, height - 5],
  ];
  const color = [0, 0, 0];
  points.forEach(([x, y]) => {
    const index = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4;
    color[0] += data[index];
    color[1] += data[index + 1];
    color[2] += data[index + 2];
  });
  return color.map((value) => value / points.length);
}

function dilateMask(mask, width, height, rounds = 2) {
  let current = mask;
  for (let round = 0; round < rounds; round += 1) {
    const next = new Uint8Array(current);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (current[index]) continue;
        if (current[index - 1] || current[index + 1] || current[index - width] || current[index + width]) next[index] = 1;
      }
    }
    current = next;
  }
  return current;
}

function boxesNear(a, b, gap) {
  return !(
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  );
}

function mergeBoxes(boxes, gap) {
  const merged = [...boxes];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!boxesNear(merged[i], merged[j], gap)) continue;
        const x = Math.min(merged[i].x, merged[j].x);
        const y = Math.min(merged[i].y, merged[j].y);
        const right = Math.max(merged[i].x + merged[i].width, merged[j].x + merged[j].width);
        const bottom = Math.max(merged[i].y + merged[i].height, merged[j].y + merged[j].height);
        merged[i] = { x, y, width: right - x, height: bottom - y };
        merged.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return merged;
}

function clampDetectedSheetBox(box, image) {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const right = Math.min(image.naturalWidth, Math.round(box.x + box.width));
  const bottom = Math.min(image.naturalHeight, Math.round(box.y + box.height));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function sheetDetectionPad(width, height) {
  return Math.max(6, Math.round(Math.min(width, height) * 0.012));
}

function projectionRuns(projection, threshold, minRun, maxInnerGap) {
  const raw = [];
  let start = null;
  projection.forEach((value, index) => {
    if (value > threshold && start === null) start = index;
    if ((value <= threshold || index === projection.length - 1) && start !== null) {
      const end = value <= threshold ? index - 1 : index;
      raw.push({ start, end });
      start = null;
    }
  });
  const merged = [];
  raw.forEach((run) => {
    const previous = merged[merged.length - 1];
    if (previous && run.start - previous.end <= maxInnerGap) previous.end = run.end;
    else merged.push({ ...run });
  });
  return merged.filter((run) => run.end - run.start + 1 >= minRun);
}

function projectionSheetBoxes(mask, width, height, image, scale) {
  const rowProjection = Array.from({ length: height }, (_, y) => {
    let total = 0;
    for (let x = 0; x < width; x += 1) total += mask[y * width + x];
    return total;
  });
  const rowRuns = projectionRuns(
    rowProjection,
    Math.max(5, width * 0.008),
    Math.max(18, height * 0.055),
    Math.max(10, height * 0.035),
  );
  const boxes = [];
  rowRuns.forEach((row) => {
    const columnProjection = Array.from({ length: width }, (_, x) => {
      let total = 0;
      for (let y = row.start; y <= row.end; y += 1) total += mask[y * width + x];
      return total;
    });
    const columnRuns = projectionRuns(
      columnProjection,
      Math.max(3, (row.end - row.start + 1) * 0.012),
      Math.max(14, width * 0.025),
      Math.max(10, width * 0.018),
    );
    columnRuns.forEach((column) => {
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let area = 0;
      for (let y = row.start; y <= row.end; y += 1) {
        for (let x = column.start; x <= column.end; x += 1) {
          if (!mask[y * width + x]) continue;
          area += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (area < Math.max(120, width * height * 0.00018)) return;
      const pad = sheetDetectionPad(width, height);
      boxes.push(clampDetectedSheetBox({
        x: (minX - pad) / scale,
        y: (minY - pad) / scale,
        width: (maxX - minX + 1 + pad * 2) / scale,
        height: (maxY - minY + 1 + pad * 2) / scale,
      }, image));
    });
  });
  return sortBoxesReadingOrder(boxes.filter((box) => box.width > 32 && box.height > 32)).slice(0, 80);
}

function gridSheetBoxes(mask, width, height, image, scale) {
  const columns = Math.max(2, Math.min(8, Math.round(image.naturalWidth / 275)));
  const rows = Math.max(2, Math.min(6, Math.round(image.naturalHeight / 260)));
  const boxes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = Math.floor((column / columns) * width);
      const right = Math.ceil(((column + 1) / columns) * width);
      const top = Math.floor((row / rows) * height);
      const bottom = Math.ceil(((row + 1) / rows) * height);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let area = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          if (!mask[y * width + x]) continue;
          area += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (area < Math.max(120, width * height * 0.00018)) continue;
      const pad = sheetDetectionPad(width, height);
      boxes.push(clampDetectedSheetBox({
        x: (minX - pad) / scale,
        y: (minY - pad) / scale,
        width: (maxX - minX + 1 + pad * 2) / scale,
        height: (maxY - minY + 1 + pad * 2) / scale,
      }, image));
    }
  }
  return sortBoxesReadingOrder(boxes.filter((box) => box.width > 32 && box.height > 32)).slice(0, 80);
}

function sortBoxesReadingOrder(boxes) {
  const sorted = [...boxes].sort((a, b) => ((a.y + a.height / 2) - (b.y + b.height / 2)));
  const rows = [];
  sorted.forEach((box) => {
    const centerY = box.y + box.height / 2;
    const row = rows.find((item) => Math.abs(centerY - item.centerY) < Math.max(40, box.height * 0.55));
    if (row) {
      row.boxes.push(box);
      row.centerY = row.boxes.reduce((sum, item) => sum + item.y + item.height / 2, 0) / row.boxes.length;
    } else {
      rows.push({ centerY, boxes: [box] });
    }
  });
  return rows
    .sort((a, b) => a.centerY - b.centerY)
    .flatMap((row) => row.boxes.sort((a, b) => a.x - b.x));
}

function detectSheetBoxes(image) {
  const maxSide = 920;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const background = averageCornerColor(pixels.data, width, height);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const pixel = index * 4;
    const diff = Math.abs(pixels.data[pixel] - background[0])
      + Math.abs(pixels.data[pixel + 1] - background[1])
      + Math.abs(pixels.data[pixel + 2] - background[2]);
    if (pixels.data[pixel + 3] > 24 && diff > 78) mask[index] = 1;
  }
  const projected = projectionSheetBoxes(mask, width, height, image, scale);
  const grid = gridSheetBoxes(mask, width, height, image, scale);
  if (projected.length > 3 && projected.length >= grid.length * 0.7) return projected;
  if (grid.length > projected.length) return grid;
  const dilated = dilateMask(mask, width, height, 1);
  const visited = new Uint8Array(width * height);
  const components = [];
  const minArea = Math.max(220, Math.round(width * height * 0.00045));
  for (let start = 0; start < dilated.length; start += 1) {
    if (!dilated[start] || visited[start]) continue;
    const stack = [start];
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    while (stack.length) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const neighbors = [current - 1, current + 1, current - width, current + width];
      neighbors.forEach((next) => {
        if (next < 0 || next >= dilated.length || visited[next] || !dilated[next]) return;
        if ((current % width === 0 && next === current - 1) || (current % width === width - 1 && next === current + 1)) return;
        visited[next] = 1;
        stack.push(next);
      });
    }
    if (area < minArea || maxX - minX < 12 || maxY - minY < 12) continue;
    const pad = sheetDetectionPad(width, height);
    components.push(clampDetectedSheetBox({
      x: (minX - pad) / scale,
      y: (minY - pad) / scale,
      width: (maxX - minX + 1 + pad * 2) / scale,
      height: (maxY - minY + 1 + pad * 2) / scale,
    }, image));
  }
  const gap = Math.max(image.naturalWidth, image.naturalHeight) * 0.006;
  const merged = mergeBoxes(components, gap)
    .map((box) => clampDetectedSheetBox(box, image))
    .filter((box) => box.width > 28 && box.height > 28);
  if (!merged.length) return [{ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }];
  return sortBoxesReadingOrder(merged).slice(0, 80);
}

function resizeSheetCanvas() {
  const bounds = sheetCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  sheetCanvas.width = Math.max(560, Math.round((bounds.width || 840) * dpr));
  sheetCanvas.height = Math.max(360, Math.round((bounds.height || 520) * dpr));
}

function calculateSheetImageRect() {
  const canvasRatio = sheetCanvas.width / sheetCanvas.height;
  const imageRatio = sheetImage.naturalWidth / sheetImage.naturalHeight;
  let width;
  let height;
  if (imageRatio > canvasRatio) {
    width = sheetCanvas.width;
    height = width / imageRatio;
  } else {
    height = sheetCanvas.height;
    width = height * imageRatio;
  }
  return {
    x: (sheetCanvas.width - width) / 2,
    y: (sheetCanvas.height - height) / 2,
    width,
    height,
    scale: width / sheetImage.naturalWidth,
  };
}

function sheetBoxToCanvasRect(box) {
  return {
    x: sheetImageRect.x + box.x * sheetImageRect.scale,
    y: sheetImageRect.y + box.y * sheetImageRect.scale,
    width: box.width * sheetImageRect.scale,
    height: box.height * sheetImageRect.scale,
  };
}

function boxOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function assignSheetBoxColors(boxes) {
  const assigned = [];
  sortBoxesReadingOrder(boxes).forEach((box) => {
    const preferred = assigned.length % sheetBoxPalette.length;
    const scores = sheetBoxPalette.map((_, colorIndex) => assigned
      .filter((item) => item.colorIndex === colorIndex)
      .reduce((score, item) => score + boxOverlapArea(box, item.box), 0));
    const best = scores.reduce((winner, score, index) => {
      if (score < scores[winner]) return index;
      if (score > scores[winner]) return winner;
      return Math.abs(index - preferred) < Math.abs(winner - preferred) ? index : winner;
    }, preferred);
    assigned.push({ box, colorIndex: best });
  });
  return new Map(assigned.map((item) => [item.box, item.colorIndex]));
}

function drawSheetCutter() {
  sheetContext.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  sheetContext.fillStyle = "#f4f1ea";
  sheetContext.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  if (!sheetImage) return;
  sheetImageRect = calculateSheetImageRect();
  sheetContext.drawImage(sheetImage, sheetImageRect.x, sheetImageRect.y, sheetImageRect.width, sheetImageRect.height);
  const colorMap = assignSheetBoxColors(sheetBoxes);
  sheetBoxes.forEach((box, index) => {
    const rect = sheetBoxToCanvasRect(box);
    const color = sheetBoxPalette[colorMap.get(box) ?? (index % sheetBoxPalette.length)];
    sheetContext.strokeStyle = color;
    sheetContext.lineWidth = 3;
    sheetContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
    sheetContext.fillStyle = color;
    sheetHandlePoints(rect).forEach(({ x, y }) => {
      sheetContext.beginPath();
      sheetContext.arc(x, y, 8, 0, Math.PI * 2);
      sheetContext.fill();
    });
    sheetContext.fillStyle = color;
    sheetContext.globalAlpha = 0.88;
    sheetContext.fillRect(rect.x, rect.y, 26, 20);
    sheetContext.globalAlpha = 1;
    sheetContext.fillStyle = "#ffffff";
    sheetContext.font = "700 13px system-ui";
    sheetContext.fillText(String(index + 1), rect.x + 8, rect.y + 14);
    sheetBoxControlRects(rect).forEach((control) => {
      sheetContext.fillStyle = "#ffffff";
      sheetContext.strokeStyle = color;
      sheetContext.lineWidth = 2;
      sheetContext.beginPath();
      sheetContext.roundRect(control.x, control.y, control.width, control.height, 5);
      sheetContext.fill();
      sheetContext.stroke();
      sheetContext.fillStyle = color;
      sheetContext.font = "900 16px system-ui";
      sheetContext.textAlign = "center";
      sheetContext.textBaseline = "middle";
      sheetContext.fillText(control.action === "add" ? "+" : "-", control.x + control.width / 2, control.y + control.height / 2 - 1);
      sheetContext.textAlign = "start";
      sheetContext.textBaseline = "alphabetic";
    });
  });
}

function sheetBoxControlRects(rect) {
  const size = 22;
  const gap = 5;
  const y = rect.y + 5;
  const right = Math.min(rect.x + rect.width - 5, sheetCanvas.width - 5);
  let minusX = right - size;
  let addX = minusX - gap - size;
  const left = Math.max(rect.x + 5, 5);
  if (addX < left) {
    addX = left;
    minusX = Math.min(addX + size + gap, sheetCanvas.width - size - 5);
  }
  return [
    { action: "add", x: addX, y, width: size, height: size },
    { action: "remove", x: minusX, y, width: size, height: size },
  ];
}

function sheetHandlePoints(rect) {
  return [
    { name: "nw", x: rect.x, y: rect.y },
    { name: "ne", x: rect.x + rect.width, y: rect.y },
    { name: "sw", x: rect.x, y: rect.y + rect.height },
    { name: "se", x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function getSheetPoint(event) {
  const bounds = sheetCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * sheetCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * sheetCanvas.height,
  };
}

function hitTestSheet(point) {
  for (let index = sheetBoxes.length - 1; index >= 0; index -= 1) {
    const rect = sheetBoxToCanvasRect(sheetBoxes[index]);
    const control = sheetBoxControlRects(rect).find((item) => (
      point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height
    ));
    if (control) return { index, mode: control.action };
    const handle = sheetHandlePoints(rect).find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 18);
    if (handle) return { index, mode: "resize", handle: handle.name };
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
      return { index, mode: "move" };
    }
  }
  return null;
}

function clampSheetBox(box) {
  const next = { ...box };
  next.width = Math.max(24, Math.min(sheetImage.naturalWidth, next.width));
  next.height = Math.max(24, Math.min(sheetImage.naturalHeight, next.height));
  next.x = Math.max(0, Math.min(sheetImage.naturalWidth - next.width, next.x));
  next.y = Math.max(0, Math.min(sheetImage.naturalHeight - next.height, next.y));
  return next;
}

function addSheetBoxFrom(index) {
  if (!sheetImage || !sheetBoxes[index]) return;
  const source = sheetBoxes[index];
  const offset = Math.max(18, Math.round(Math.min(source.width, source.height) * 0.12));
  const rightSpace = sheetImage.naturalWidth - (source.x + source.width);
  const bottomSpace = sheetImage.naturalHeight - (source.y + source.height);
  const next = {
    ...source,
    x: source.x + (rightSpace >= offset ? offset : 0),
    y: source.y + (rightSpace >= offset ? 0 : Math.min(offset, Math.max(0, bottomSpace))),
  };
  sheetBoxes.splice(index + 1, 0, clampSheetBox(next));
  sheetStatus.textContent = `${sheetBoxes.length} vakken.`;
  drawSheetCutter();
}

function removeSheetBox(index) {
  sheetBoxes.splice(index, 1);
  sheetPointer = null;
  sheetStatus.textContent = `${sheetBoxes.length} vakken.`;
  drawSheetCutter();
}

function updateSheetBoxFromPointer(event) {
  if (!sheetPointer || !sheetImage) return;
  const point = getSheetPoint(event);
  const dx = (point.x - sheetPointer.startPoint.x) / sheetImageRect.scale;
  const dy = (point.y - sheetPointer.startPoint.y) / sheetImageRect.scale;
  let next = { ...sheetPointer.startBox };
  if (sheetPointer.mode === "move") {
    next.x += dx;
    next.y += dy;
  } else {
    if (sheetPointer.handle.includes("w")) {
      next.x += dx;
      next.width -= dx;
    }
    if (sheetPointer.handle.includes("e")) next.width += dx;
    if (sheetPointer.handle.includes("n")) {
      next.y += dy;
      next.height -= dy;
    }
    if (sheetPointer.handle.includes("s")) next.height += dy;
  }
  sheetBoxes[sheetPointer.index] = clampSheetBox(next);
  drawSheetCutter();
}

async function openSheetCutter(logo) {
  sheetStatus.textContent = "";
  sheetCutButton.disabled = false;
  activeSheetLogo = logo;
  sheetTitle.textContent = logo.name || `Image ${logo.id}`;
  const image = await loadImageFromUrl(imageSource(logo));
  sheetImage = image;
  sheetImageName = logo.name || logo.source || `sheet-${logo.id}`;
  sheetBoxes = detectSheetBoxes(image);
  if (!sheetDialog.open) sheetDialog.showModal();
  setTimeout(() => {
    resizeSheetCanvas();
    drawSheetCutter();
    sheetStatus.textContent = `${sheetBoxes.length} vakken gevonden.`;
  }, 0);
}

function makeSheetCutDataUrl(box) {
  const output = document.createElement("canvas");
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(box.width, box.height));
  output.width = Math.max(1, Math.round(box.width * scale));
  output.height = Math.max(1, Math.round(box.height * scale));
  const context = output.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(sheetImage, box.x, box.y, box.width, box.height, 0, 0, output.width, output.height);
  return output.toDataURL("image/jpeg", 0.92);
}

async function cutSheetIntoProject() {
  if (!sheetImage || !sheetBoxes.length) return;
  const projectId = activeProjectId;
  sheetCutButton.disabled = true;
  await persistQueue.catch(() => {});
  const stamp = Date.now();
  const addedPatch = {};
  const reviewPatch = {};
  const sheetNameTags = tagsFromFileName(sheetImageName);
  sortBoxesReadingOrder(sheetBoxes)
    .forEach((box, index) => {
      const id = `sheet-${stamp}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
      const item = {
        id,
        file: id,
        name: `${sheetImageName} #${index + 1}`,
        source: sheetImageName,
        sourceIndex: "✂",
        dotIndex: String(index + 1),
        group: "TOEGEVOEGD",
        added: true,
        type: "image/jpeg",
        dataUrl: makeSheetCutDataUrl(clampSheetBox(box)),
      };
      addedPatch[id] = item;
      if (sheetNameTags.length) reviewPatch[id] = { customTags: uniqueTags([...inferredTags(item), ...sheetNameTags]) };
    });
  const response = await fetch(`/api/state?project=${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addedItems: addedPatch, review: reviewPatch }),
  });
  sheetCutButton.disabled = false;
  if (!response.ok) {
    sheetStatus.textContent = "Sheet snijden mislukte.";
    return;
  }
  applyState(await response.json());
  normalizeAddedItemNumbers({ persist: true });
  resetSheetCutter(true);
  activeFilter = "all";
  render();
}

function resetCaptureTool(closeDialog = false) {
  captureImage = null;
  captureImageName = "";
  captureBox = { x: 0, y: 0, width: 1, height: 1 };
  capturePointer = null;
  activeCaptureLogo = null;
  captureStatus.textContent = "";
  captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
  if (closeDialog && captureDialog.open) captureDialog.close();
}

function defaultCaptureBox(image) {
  const width = Math.max(48, image.naturalWidth * 0.36);
  const height = Math.max(48, image.naturalHeight * 0.36);
  return {
    x: (image.naturalWidth - width) / 2,
    y: (image.naturalHeight - height) / 2,
    width,
    height,
  };
}

function resetCaptureBox() {
  if (!captureImage) return;
  capturePointer = null;
  captureBox = defaultCaptureBox(captureImage);
  captureStatus.textContent = "Trek of sleep het zwarte vak om 1 beeld.";
  drawCaptureTool();
}

function resizeCaptureCanvas() {
  const bounds = captureCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  captureCanvas.width = Math.max(560, Math.round((bounds.width || 840) * dpr));
  captureCanvas.height = Math.max(360, Math.round((bounds.height || 520) * dpr));
}

function calculateCaptureImageRect() {
  const canvasRatio = captureCanvas.width / captureCanvas.height;
  const imageRatio = captureImage.naturalWidth / captureImage.naturalHeight;
  let width;
  let height;
  if (imageRatio > canvasRatio) {
    width = captureCanvas.width;
    height = width / imageRatio;
  } else {
    height = captureCanvas.height;
    width = height * imageRatio;
  }
  return {
    x: (captureCanvas.width - width) / 2,
    y: (captureCanvas.height - height) / 2,
    width,
    height,
    scale: width / captureImage.naturalWidth,
  };
}

function captureBoxToCanvasRect(box = captureBox) {
  return {
    x: captureImageRect.x + box.x * captureImageRect.scale,
    y: captureImageRect.y + box.y * captureImageRect.scale,
    width: box.width * captureImageRect.scale,
    height: box.height * captureImageRect.scale,
  };
}

function captureHandlePoints(rect) {
  return [
    { name: "nw", x: rect.x, y: rect.y },
    { name: "ne", x: rect.x + rect.width, y: rect.y },
    { name: "sw", x: rect.x, y: rect.y + rect.height },
    { name: "se", x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function drawCaptureTool() {
  captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
  captureContext.fillStyle = "#f4f1ea";
  captureContext.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
  if (!captureImage) return;
  captureImageRect = calculateCaptureImageRect();
  captureContext.drawImage(captureImage, captureImageRect.x, captureImageRect.y, captureImageRect.width, captureImageRect.height);
  const rect = captureBoxToCanvasRect();
  captureContext.save();
  captureContext.fillStyle = "rgba(0, 0, 0, 0.22)";
  captureContext.beginPath();
  captureContext.rect(0, 0, captureCanvas.width, captureCanvas.height);
  captureContext.rect(rect.x, rect.y, rect.width, rect.height);
  captureContext.fill("evenodd");
  captureContext.fillStyle = "rgba(96, 212, 111, 0.72)";
  captureContext.fillRect(rect.x, rect.y, rect.width, rect.height);
  captureContext.lineWidth = 4;
  captureContext.strokeStyle = "#000000";
  captureContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
  captureContext.fillStyle = "#000000";
  captureContext.font = `900 ${Math.max(30, Math.min(72, Math.min(rect.width, rect.height) * 0.32))}px system-ui`;
  captureContext.textAlign = "center";
  captureContext.textBaseline = "middle";
  captureContext.fillText("⊕", rect.x + rect.width / 2, rect.y + rect.height / 2);
  captureContext.fillStyle = "#000000";
  captureHandlePoints(rect).forEach(({ x, y }) => {
    captureContext.beginPath();
    captureContext.arc(x, y, 10, 0, Math.PI * 2);
    captureContext.fill();
  });
  captureContext.textAlign = "start";
  captureContext.textBaseline = "alphabetic";
  captureContext.restore();
}

function getCapturePoint(event) {
  const bounds = captureCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * captureCanvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * captureCanvas.height,
  };
}

function captureCanvasPointToImage(point) {
  return {
    x: Math.max(0, Math.min(captureImage.naturalWidth, (point.x - captureImageRect.x) / captureImageRect.scale)),
    y: Math.max(0, Math.min(captureImage.naturalHeight, (point.y - captureImageRect.y) / captureImageRect.scale)),
  };
}

function hitTestCapture(point) {
  const rect = captureBoxToCanvasRect();
  const handle = captureHandlePoints(rect).find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 20);
  if (handle) return { mode: "resize", handle: handle.name };
  if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
    return { mode: "move" };
  }
  return { mode: "draw" };
}

function clampCaptureBox(box) {
  const next = { ...box };
  next.width = Math.max(24, Math.min(captureImage.naturalWidth, next.width));
  next.height = Math.max(24, Math.min(captureImage.naturalHeight, next.height));
  next.x = Math.max(0, Math.min(captureImage.naturalWidth - next.width, next.x));
  next.y = Math.max(0, Math.min(captureImage.naturalHeight - next.height, next.y));
  return next;
}

function updateCaptureBoxFromPointer(event) {
  if (!capturePointer || !captureImage) return;
  const point = getCapturePoint(event);
  const imagePoint = captureCanvasPointToImage(point);
  let next = { ...capturePointer.startBox };
  if (capturePointer.mode === "move") {
    const dx = (point.x - capturePointer.startPoint.x) / captureImageRect.scale;
    const dy = (point.y - capturePointer.startPoint.y) / captureImageRect.scale;
    next.x += dx;
    next.y += dy;
  } else if (capturePointer.mode === "resize") {
    const dx = (point.x - capturePointer.startPoint.x) / captureImageRect.scale;
    const dy = (point.y - capturePointer.startPoint.y) / captureImageRect.scale;
    if (capturePointer.handle.includes("w")) {
      next.x += dx;
      next.width -= dx;
    }
    if (capturePointer.handle.includes("e")) next.width += dx;
    if (capturePointer.handle.includes("n")) {
      next.y += dy;
      next.height -= dy;
    }
    if (capturePointer.handle.includes("s")) next.height += dy;
  } else {
    const start = capturePointer.startImagePoint;
    next = {
      x: Math.min(start.x, imagePoint.x),
      y: Math.min(start.y, imagePoint.y),
      width: Math.abs(imagePoint.x - start.x),
      height: Math.abs(imagePoint.y - start.y),
    };
  }
  captureBox = clampCaptureBox(next);
  drawCaptureTool();
}

async function openCaptureTool(logo) {
  captureStatus.textContent = "";
  captureSaveButton.disabled = false;
  activeCaptureLogo = logo;
  captureTitle.textContent = logo.name || `Image ${logo.id}`;
  const image = await loadImageFromUrl(imageSource(logo));
  captureImage = image;
  captureImageName = logo.name || logo.source || `capture-${logo.id}`;
  captureBox = defaultCaptureBox(image);
  if (!captureDialog.open) captureDialog.showModal();
  setTimeout(() => {
    resizeCaptureCanvas();
    drawCaptureTool();
    captureStatus.textContent = "Trek of sleep het zwarte vak om 1 beeld.";
  }, 0);
}

function makeCaptureDataUrl(box) {
  const output = document.createElement("canvas");
  const clamped = clampCaptureBox(box);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(clamped.width, clamped.height));
  output.width = Math.max(1, Math.round(clamped.width * scale));
  output.height = Math.max(1, Math.round(clamped.height * scale));
  const context = output.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(captureImage, clamped.x, clamped.y, clamped.width, clamped.height, 0, 0, output.width, output.height);
  return output.toDataURL("image/jpeg", 0.92);
}

function dataUrlSize(dataUrl) {
  const body = String(dataUrl || "").split(",")[1] || "";
  return Math.round((body.length * 3) / 4);
}

async function saveCaptureAsset() {
  if (!captureImage || !activeCaptureLogo) return;
  captureSaveButton.disabled = true;
  await persistQueue.catch(() => {});
  const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dataUrl = makeCaptureDataUrl(captureBox);
  const creator = ensureCurrentVoterRegistered({ persist: false });
  const rootKey = captureRootKey(activeCaptureLogo);
  const rootLogo = findLogoByStateKey(rootKey) || activeCaptureLogo;
  const suffix = nextCaptureLetter(rootKey);
  const suffixIndex = Math.max(1, suffix.charCodeAt(0) - 64);
  const parentOrder = logoUploadOrder(rootLogo, allLogos().findIndex((logo) => logoStateKey(logo) === logoStateKey(rootLogo)));
  const captureNumberBase = activeCaptureLogo.captureNumberBase || baseSheetNumberLabel(rootLogo);
  const item = {
    id,
    file: id,
    name: `${captureImageName} 📸`,
    source: captureImageName,
    sourceIndex: "📸",
    dotIndex: "",
    group: "TOEGEVOEGD",
    added: true,
    type: "image/jpeg",
    size: dataUrlSize(dataUrl),
    dataUrl,
    manualOrder: parentOrder + suffixIndex / 100,
    captureRootKey: rootKey,
    captureParentKey: logoStateKey(activeCaptureLogo),
    captureNumberBase,
    captureSuffix: suffix,
    captureCreatorKey: creator.key || currentVoterKey(),
    captureCreatorColor: creator.color || colorForCurrentVoter(),
  };
  const fileNameTags = tagsFromFileName(captureImageName);
  const review = fileNameTags.length ? { customTags: uniqueTags([...inferredTags(item), ...fileNameTags]) } : {};
  const patch = { addedItems: { [id]: item }, review: { [id]: review } };
  if (creator.changed && creator.color) patch.voters = { [creator.key]: creator.color };
  const response = await fetch(`/api/state?project=${encodeURIComponent(activeProjectId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  captureSaveButton.disabled = false;
  if (!response.ok) {
    captureStatus.textContent = "Capture opslaan mislukte.";
    return;
  }
  applyState(await response.json());
  normalizeAddedItemNumbers({ persist: true });
  resetCaptureTool(true);
  activeFilter = "all";
  activeSort = "upload-asc";
  localStorage.setItem(sortStoreKey, activeSort);
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

[addedFilter, deletedFilter].forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(activeFilter === button.dataset.filter ? "all" : button.dataset.filter);
  });
});

voteButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  setActiveFilter(activeFilter === button.dataset.filter ? "all" : button.dataset.filter);
});

sortSelect.addEventListener("change", () => {
  activeSort = sortSelect.value;
  localStorage.setItem(sortStoreKey, activeSort);
  render();
});

gallery.addEventListener("click", async (event) => {
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
      holdRealtimeVoteSync();
      const voterKey = currentVoterKey();
      const voterRegistration = ensureCurrentVoterRegistered({ persist: false });
      const requestId = (ratingRequestSerial += 1);
      latestRatingRequest.set(key, requestId);
      const rating = action.dataset.rating;
      const localVotes = votesFor(review);
      const shouldRemoveVote = action.dataset.currentVoted === "true" || localVotes[voterKey] === rating;
      const optimisticReview = { ...review, votes: { ...localVotes } };
      if (shouldRemoveVote) delete optimisticReview.votes[voterKey];
      else optimisticReview.votes[voterKey] = rating;
      delete optimisticReview.ratings;
      delete optimisticReview.rating;
      reviewState[key] = optimisticReview;
      writeJson(reviewStoreKey, reviewState);
      render();
      refreshReviewItem(key)
        .then(() => {
          if (latestRatingRequest.get(key) !== requestId) return null;
          const refreshedReview = { ...logoReview(logo) };
          refreshedReview.votes = votesFor(refreshedReview);
          if (shouldRemoveVote) delete refreshedReview.votes[voterKey];
          else refreshedReview.votes[voterKey] = rating;
          delete refreshedReview.ratings;
          delete refreshedReview.rating;
          reviewState[key] = refreshedReview;
          writeJson(reviewStoreKey, reviewState);
          const patch = { voteUpdates: { [key]: { [voterKey]: shouldRemoveVote ? null : rating } } };
          if (voterRegistration.changed && voterRegistration.color) patch.voters = { [voterKey]: voterRegistration.color };
          return queuePersist(patch);
        })
        .then((result) => {
          if (result !== null && latestRatingRequest.get(key) === requestId) render();
        })
        .catch(() => {
          schedulePersist({ voteUpdates: { [key]: { [voterKey]: shouldRemoveVote ? null : rating } } });
        });
    }
    if (action.dataset.action === "delete") {
      if (logo.added) {
        if (!window.confirm(`Asset "${logo.name || logo.source || logo.id}" definitief verwijderen?`)) return;
        deleteAddedAsset(logo, key).catch((error) => {
          console.error("Asset delete failed", error);
          window.alert("Asset kon niet volledig worden verwijderd.");
        });
        return;
      }
      review.deleted = !review.deleted;
      reviewState[key] = review;
      saveReviewItem(key);
      render();
    }
    if (action.dataset.action === "tag-edit") {
      const current = visibleTagsFor(logo, review).map(tagLabel).join(", ");
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
    if (action.dataset.action === "stop-media") {
      const frame = action.closest(".media-frame");
      stopMedia(frame || document);
    }
    if (action.dataset.action === "open-media") {
      openLightbox(logo);
    }
    if (action.dataset.action === "sheet-cut") {
      openSheetCutter(logo);
    }
    if (action.dataset.action === "capture") {
      openCaptureTool(logo);
    }
    return;
  }
  const imageButton = event.target.closest(".image-button[data-id]");
  if (imageButton) {
    const logo = findLogo(imageButton.dataset.id);
    if (logo) openLightbox(logo);
    return;
  }
  const cropControl = event.target.closest(".edit-logo[data-id]");
  if (!cropControl) return;
  const logo = findLogo(cropControl.dataset.id);
  if (logo) openCropper(logo);
});

function imageFallbackHandler(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const fallback = image.dataset.fallback;
  if (!fallback || image.src.endsWith(fallback)) return;
  image.src = fallback;
}

gallery.addEventListener("error", imageFallbackHandler, true);
lightboxImage.addEventListener("error", imageFallbackHandler);

lightboxDialog.addEventListener("click", (event) => {
  if (event.target === lightboxDialog) closeLightbox();
});
lightboxImage.addEventListener("click", closeLightbox);
lightboxClose.addEventListener("click", closeLightbox);
lightboxStop.addEventListener("click", () => stopMedia(lightboxDialog));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

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

sheetResetButton.addEventListener("click", resetSheetBoxes);
sheetCutButton.addEventListener("click", cutSheetIntoProject);

sheetCanvas.addEventListener("pointerdown", (event) => {
  if (!sheetImage) return;
  const startPoint = getSheetPoint(event);
  const hit = hitTestSheet(startPoint);
  if (!hit) return;
  if (hit.mode === "add") {
    addSheetBoxFrom(hit.index);
    return;
  }
  if (hit.mode === "remove") {
    removeSheetBox(hit.index);
    return;
  }
  sheetCanvas.setPointerCapture(event.pointerId);
  sheetPointer = { ...hit, startPoint, startBox: { ...sheetBoxes[hit.index] } };
});

sheetCanvas.addEventListener("pointermove", updateSheetBoxFromPointer);
sheetCanvas.addEventListener("pointerup", () => {
  sheetPointer = null;
});
sheetCanvas.addEventListener("pointercancel", () => {
  sheetPointer = null;
});

captureResetButton.addEventListener("click", resetCaptureBox);
captureSaveButton.addEventListener("click", saveCaptureAsset);

captureCanvas.addEventListener("pointerdown", (event) => {
  if (!captureImage) return;
  const startPoint = getCapturePoint(event);
  const hit = hitTestCapture(startPoint);
  captureCanvas.setPointerCapture(event.pointerId);
  capturePointer = {
    ...hit,
    startPoint,
    startImagePoint: captureCanvasPointToImage(startPoint),
    startBox: { ...captureBox },
  };
  if (hit.mode === "draw") {
    const imagePoint = captureCanvasPointToImage(startPoint);
    captureBox = clampCaptureBox({ x: imagePoint.x, y: imagePoint.y, width: 24, height: 24 });
    drawCaptureTool();
  }
});

captureCanvas.addEventListener("pointermove", updateCaptureBoxFromPointer);
captureCanvas.addEventListener("pointerup", () => {
  capturePointer = null;
});
captureCanvas.addEventListener("pointercancel", () => {
  capturePointer = null;
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

window.addEventListener("resize", () => {
  if (!sheetImage || !sheetDialog.open) return;
  resizeSheetCanvas();
  drawSheetCutter();
});

window.addEventListener("resize", () => {
  if (!captureImage || !captureDialog.open) return;
  resizeCaptureCanvas();
  drawCaptureTool();
});

sheetDialog.addEventListener("close", () => {
  if (!sheetCutButton.disabled) resetSheetCutter(false);
});

captureDialog.addEventListener("close", () => {
  if (!captureSaveButton.disabled) resetCaptureTool(false);
});

toggleTextEdit.addEventListener("click", () => setTextEditMode(true));
saveTextEdit.addEventListener("click", () => {
  const text = currentTextValues();
  writeJson(currentTextStoreKey(), text);
  schedulePersist({ text });
  setTextEditMode(false);
});
resetTextEdit.addEventListener("click", () => {
  localStorage.removeItem(currentTextStoreKey());
  applySavedText();
  schedulePersist({ text: Object.fromEntries(Object.keys(defaults).map((key) => [key, null])) });
  setTextEditMode(false);
});

projectList.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-project-copy]");
  if (copyButton) {
    const project = currentProjects.find((item) => item.id === copyButton.dataset.projectCopy);
    if (!project) return;
    copyProjectLink(project, copyButton.dataset.inviteName || "")
      .then(() => {
        flashCopySuccess(copyButton);
        newProjectError.textContent = copyButton.dataset.inviteName ? "Persoonlijke link gekopieerd." : "Projectlink gekopieerd.";
      })
      .catch(() => {
        newProjectError.textContent = "Projectlink kopiëren mislukte.";
      });
    return;
  }
  const deleteButton = event.target.closest("[data-project-delete]");
  if (deleteButton) {
    const projectId = deleteButton.dataset.projectDelete;
    const project = currentProjects.find((item) => item.id === projectId);
    if (!project) return;
    if (!window.confirm(`Project "${project.title}" verwijderen?`)) return;
    deleteProject(projectId);
    return;
  }
  const button = event.target.closest("[data-project-id]");
  if (!button) return;
  openProject(button.dataset.projectId);
});

newProjectToggle.addEventListener("click", () => {
  const open = newProjectForm.hidden;
  newProjectForm.hidden = !open;
  newProjectToggle.setAttribute("aria-expanded", String(open));
  if (open) newProjectTitle.focus();
});

async function deleteProject(projectId) {
  newProjectError.textContent = "";
  const response = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, { method: "DELETE" });
  if (!response.ok) {
    newProjectError.textContent = "Project kon niet worden verwijderd.";
    return;
  }
  currentProjects = currentProjects.filter((project) => project.id !== projectId);
  renderProjectList();
  newProjectError.textContent = "Project verwijderd.";
}

newProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  newProjectError.textContent = "";
  lastCreatedProject = null;
  copyNewProjectLink.disabled = true;
  const invitees = newVoterRows
    .map((row) => ({
      name: row.querySelector(".newVoterName")?.value.trim() || "",
      password: row.querySelector(".newVoterPassword")?.value.trim() || "",
    }));
  if (invitees.some((invitee) => Boolean(invitee.name) !== Boolean(invitee.password))) {
    newProjectError.textContent = "Elke curator heeft naam én password nodig.";
    copyNewProjectLink.disabled = false;
    return;
  }
  const payload = {
    title: newProjectTitle.value.trim(),
    projectPassword: newProjectPassword.value,
    invitees: invitees.filter((invitee) => invitee.name && invitee.password),
  };
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    newProjectError.textContent = "Project kon niet worden aangemaakt.";
    return;
  }
  const data = await response.json();
  currentProjects = [...currentProjects, data.project];
  lastCreatedProject = data.project;
  renderProjectList();
  newProjectForm.reset();
  copyNewProjectLink.disabled = false;
  newProjectError.textContent = "Project gemaakt. Rodger staat erbij; de link staat klaar.";
});

copyNewProjectLink.addEventListener("click", () => {
  if (!lastCreatedProject) return;
  copyProjectLink(lastCreatedProject)
    .then(() => {
      flashCopySuccess(copyNewProjectLink);
      newProjectError.textContent = "Projectlink gekopieerd.";
    })
    .catch(() => {
      newProjectError.textContent = "Projectlink kopiëren mislukte.";
    });
});

async function startApp() {
  showApp();
  applySavedText();
  if (activeProject?.baseAssets) {
    const response = await fetch("/logos.json");
    logos = await response.json();
  } else {
    logos = [];
  }
  await loadSharedState();
  setProjectTitleFallback();
  render();
  startRealtimeVoteSync();
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
  await showProjectOverview();
});

async function logout() {
  stopRealtimeVoteSync();
  await fetch("/api/logout", { method: "POST" });
  currentSession = null;
  currentProjects = [];
  activeProject = null;
  showLogin("");
}

logoutButton.addEventListener("click", logout);
projectLogoutButton.addEventListener("click", logout);
projectOverviewButton.addEventListener("click", returnToProjectOverview);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncRealtimeVotes();
});

window.addEventListener("focus", syncRealtimeVotes);

(async () => {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) {
    showLogin("");
    return;
  }
  currentSession = await response.json();
  await showProjectOverview();
})();
