const ratioMap = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16 };
const canvas = document.querySelector('#sourceCanvas');
const context = canvas.getContext('2d');
const workspace = document.querySelector('#workspace');
const emptyState = document.querySelector('#emptyState');
const editor = document.querySelector('#editor');
const canvasWrap = document.querySelector('#canvasWrap');
const cropBox = document.querySelector('#cropBox');
const cropLabel = document.querySelector('#cropLabel');
const sizeInfo = document.querySelector('#sizeInfo');
const ratioDialog = document.querySelector('#ratioDialog');
const customRatioForm = document.querySelector('#customRatioForm');
const ratioWidthInput = document.querySelector('#ratioWidth');
const ratioHeightInput = document.querySelector('#ratioHeight');
const formatSelect = document.querySelector('#formatSelect');
let selectedRatio = '16:9';
let customRatioValue = 16 / 9;
let stream;
let crop = { x: 0, y: 0, width: 0, height: 0 };
let pointerAction;

function getActiveRatio() {
  return selectedRatio === 'custom' ? customRatioValue : ratioMap[selectedRatio];
}

function applyCrop() {
  cropBox.style.left = `${crop.x}px`;
  cropBox.style.top = `${crop.y}px`;
  cropBox.style.width = `${crop.width}px`;
  cropBox.style.height = `${crop.height}px`;
  const scale = canvas.width / canvas.clientWidth;
  const sourceWidth = Math.round(crop.width * scale);
  const sourceHeight = Math.round(crop.height * scale);
  sizeInfo.textContent = `輸出尺寸：${sourceWidth} × ${sourceHeight} px`;
}

function resetCrop() {
  const ratio = getActiveRatio() || (canvas.clientWidth / canvas.clientHeight);
  const maxWidth = canvas.clientWidth * 0.74;
  const maxHeight = canvas.clientHeight * 0.74;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) { height = maxHeight; width = height * ratio; }
  crop = { x: (canvas.clientWidth - width) / 2, y: (canvas.clientHeight - height) / 2, width, height };
  cropLabel.textContent = selectedRatio === 'custom' ? `${ratioWidthInput.value}:${ratioHeightInput.value}` : selectedRatio;
  applyCrop();
}

function setRatio(ratio) {
  selectedRatio = ratio;
  document.querySelectorAll('.ratio-button').forEach((button) => button.classList.toggle('is-active', button.dataset.ratio === ratio));
  if (!editor.hidden) resetCrop();
}

function stopStream() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('此瀏覽器不支援螢幕擷取，請使用最新版 Chrome 或 Edge。');
    return;
  }
  stopStream();
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
    // 瀏覽器可能在選取分頁後將焦點留在該分頁；嘗試切回本工具。
    window.focus();
    setTimeout(() => window.focus(), 120);
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    stream.getVideoTracks()[0].addEventListener('ended', stopStream, { once: true });
    stopStream();
    workspace.classList.remove('is-empty');
    emptyState.hidden = true;
    editor.hidden = false;
    requestAnimationFrame(resetCrop);
  } catch (error) {
    if (error.name !== 'NotAllowedError') alert('無法取得螢幕畫面，請再試一次。');
  }
}

function pointInCanvas(event) {
  const rect = canvasWrap.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

cropBox.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const point = pointInCanvas(event);
  const handle = event.target.dataset.handle;
  pointerAction = { handle, origin: point, crop: { ...crop } };
  cropBox.setPointerCapture(event.pointerId);
});

cropBox.addEventListener('pointermove', (event) => {
  if (!pointerAction) return;
  const point = pointInCanvas(event);
  const dx = point.x - pointerAction.origin.x;
  const dy = point.y - pointerAction.origin.y;
  const original = pointerAction.crop;
  if (!pointerAction.handle) {
    crop.x = Math.max(0, Math.min(canvas.clientWidth - crop.width, original.x + dx));
    crop.y = Math.max(0, Math.min(canvas.clientHeight - crop.height, original.y + dy));
  } else {
    const isLeft = pointerAction.handle.includes('w');
    const isTop = pointerAction.handle.includes('n');
    const ratio = getActiveRatio();
    const anchorX = isLeft ? original.x + original.width : original.x;
    const anchorY = isTop ? original.y + original.height : original.y;
    const desiredWidth = Math.max(80, Math.abs(isLeft ? anchorX - point.x : point.x - anchorX));
    const desiredHeight = Math.max(80, Math.abs(isTop ? anchorY - point.y : point.y - anchorY));
    const width = ratio ? Math.min(desiredWidth, canvas.clientWidth, canvas.clientHeight * ratio) : Math.min(desiredWidth, canvas.clientWidth);
    const height = ratio ? width / ratio : Math.min(desiredHeight, canvas.clientHeight);
    crop.width = width; crop.height = height;
    crop.x = isLeft ? anchorX - width : anchorX;
    crop.y = isTop ? anchorY - height : anchorY;
    crop.x = Math.max(0, Math.min(canvas.clientWidth - width, crop.x));
    crop.y = Math.max(0, Math.min(canvas.clientHeight - height, crop.y));
  }
  applyCrop();
});

function endPointer(event) { if (pointerAction) cropBox.releasePointerCapture?.(event.pointerId); pointerAction = undefined; }
cropBox.addEventListener('pointerup', endPointer);
cropBox.addEventListener('pointercancel', endPointer);

document.querySelectorAll('.ratio-button:not(#customRatioButton)').forEach((button) => button.addEventListener('click', () => setRatio(button.dataset.ratio)));
document.querySelector('#customRatioButton').addEventListener('click', () => ratioDialog.showModal());
document.querySelector('#cancelRatioButton').addEventListener('click', () => ratioDialog.close());
customRatioForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const width = Number(ratioWidthInput.value);
  const height = Number(ratioHeightInput.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  customRatioValue = width / height;
  ratioDialog.close();
  setRatio('custom');
});
document.querySelector('#captureButton').addEventListener('click', captureScreen);
document.querySelector('#restartButton').addEventListener('click', captureScreen);
document.addEventListener('keydown', (event) => {
  if (editor.hidden || ratioDialog.open || ['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) return;
  const movement = event.shiftKey ? 10 : 1;
  let dx = 0;
  let dy = 0;
  if (event.key === 'ArrowLeft') dx = -movement;
  if (event.key === 'ArrowRight') dx = movement;
  if (event.key === 'ArrowUp') dy = -movement;
  if (event.key === 'ArrowDown') dy = movement;
  if (!dx && !dy) return;
  event.preventDefault();
  crop.x = Math.max(0, Math.min(canvas.clientWidth - crop.width, crop.x + dx));
  crop.y = Math.max(0, Math.min(canvas.clientHeight - crop.height, crop.y + dy));
  applyCrop();
});
function getCroppedCanvas() {
  const scale = canvas.width / canvas.clientWidth;
  const output = document.createElement('canvas');
  const sourceWidth = Math.round(crop.width * scale);
  const sourceHeight = Math.round(crop.height * scale);
  output.width = sourceWidth;
  output.height = sourceHeight;
  output.getContext('2d').drawImage(canvas, Math.round(crop.x * scale), Math.round(crop.y * scale), sourceWidth, sourceHeight, 0, 0, output.width, output.height);
  return output;
}

document.querySelector('#downloadButton').addEventListener('click', () => {
  const output = getCroppedCanvas();
  const link = document.createElement('a');
  const extension = formatSelect.value.split('/')[1].replace('jpeg', 'jpg');
  link.download = `screenshot-${cropLabel.textContent.replace(':', 'x')}.${extension}`;
  link.href = output.toDataURL(formatSelect.value);
  link.click();
});
document.querySelector('#copyButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  try {
    const blob = await new Promise((resolve) => getCroppedCanvas().toBlob(resolve, 'image/png'));
    if (!blob || !navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    button.textContent = '已複製';
    setTimeout(() => { button.textContent = '複製選取範圍'; }, 1600);
  } catch {
    alert('無法複製圖片。請改用 Chrome 或 Edge，並以 localhost 或 HTTPS 開啟本工具。');
  }
});
window.addEventListener('resize', () => { if (!editor.hidden) resetCrop(); });
