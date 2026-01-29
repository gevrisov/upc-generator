/* app.js — full file
   - UPC-A generated ONLY on Generate click
   - Download enabled only after successful generation
   - Share QR button shows QR ONLY on click (fixed URL)
*/

const FIXED_QR_URL = "https://needbadge.com/";

const idInput = document.getElementById("idInput");
const btnGen = document.getElementById("btnGen");
const btnDownload = document.getElementById("btnDownload");
const barcodeBox = document.getElementById("barcodeBox");
const svgBarcode = document.getElementById("svgBarcode");
const textOut = document.getElementById("textOut");

/* Share QR elements */
const qrFab = document.getElementById("qrFab");
const qrSheet = document.getElementById("qrSheet");
const qrClose = document.getElementById("qrClose");
const qrCodeEl = document.getElementById("qrCode");

let lastEmployeeId = "";
let lastUpc = "";
let qrBuilt = false;

function onlyDigits(s) {
  return (s || "").replace(/\D+/g, "");
}

/* GS1 Mod-10 check digit for UPC-A on 11 digits */
function upcCheckDigit(upc11) {
  let sumOdd = 0;
  let sumEven = 0;

  for (let i = 0; i < upc11.length; i++) {
    const d = upc11.charCodeAt(i) - 48;
    const pos = i + 1;
    if (pos % 2 === 1) sumOdd += d;
    else sumEven += d;
  }

  const total = sumOdd * 3 + sumEven;
  const mod = total % 10;
  return (10 - mod) % 10;
}

function makeUpcFromEmployeeId(empDigits) {
  const padded11 = empDigits.padStart(11, "0").slice(-11);
  const cd = upcCheckDigit(padded11);
  return padded11 + String(cd);
}

function setDownloadEnabled(enabled) {
  btnDownload.disabled = !enabled;
  btnDownload.setAttribute("aria-disabled", String(!enabled));
}

function clearBarcode() {
  textOut.textContent = "—";
  barcodeBox.style.display = "none";
  setDownloadEnabled(false);
  while (svgBarcode.firstChild) svgBarcode.removeChild(svgBarcode.firstChild);
}

function renderBarcode(upc12) {
  if (!window.JsBarcode) throw new Error("JsBarcode not loaded");

  while (svgBarcode.firstChild) svgBarcode.removeChild(svgBarcode.firstChild);

  JsBarcode(svgBarcode, upc12, {
    format: "UPC",
    displayValue: false,
    margin: 16,         // quiet zone
    background: "#ffffff",
    lineColor: "#000000",
    height: 110
  });

  barcodeBox.style.display = "block";
}

/* Generate ONLY on button click */
btnGen.addEventListener("click", () => {
  const emp = onlyDigits(idInput.value);
  lastEmployeeId = emp;

  if (!emp) {
    clearBarcode();
    return;
  }

  const upc12 = makeUpcFromEmployeeId(emp);
  lastUpc = upc12;

  try {
    renderBarcode(upc12);
    textOut.textContent = upc12;
    setDownloadEnabled(true);
  } catch (e) {
    console.error(e);
    clearBarcode();
  }
});

/* Download (kept simple + safe)
   - downloads the SVG barcode as PNG image (white background)
   If you want the big 3000x3000 “card layout” again — скажи, и я добавлю
   ТОЛЬКО это, не трогая остальное.
*/
btnDownload.addEventListener("click", async () => {
  if (!lastUpc) return;

  try {
    const svgText = new XMLSerializer().serializeToString(svgBarcode);

    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.decoding = "async";
    img.src = url;

    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Failed to load barcode SVG"));
    });

    // High quality export
    const W = 1800;
    const H = 800;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // draw barcode centered with safe margins
    const pad = 80;
    const targetW = W - pad * 2;
    const scale = targetW / img.width;
    const drawW = targetW;
    const drawH = Math.round(img.height * scale);

    const x = pad;
    const y = Math.round((H - drawH) / 2);

    ctx.drawImage(img, x, y, drawW, drawH);

    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const filename = `upc_${lastEmployeeId || lastUpc}.png`;
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, "image/png", 1.0);
  } catch (e) {
    console.error(e);
  }
});

/* ===== Share QR bottom sheet (ONLY on click) ===== */

function buildQrOnce() {
  if (qrBuilt) return;

  qrCodeEl.innerHTML = "";

  if (!window.QRCode) {
    qrCodeEl.textContent = "QR library not loaded (qrcodejs)";
    qrBuilt = true;
    return;
  }

  new QRCode(qrCodeEl, {
    text: FIXED_QR_URL,
    width: 260,
    height: 260,
    correctLevel: QRCode.CorrectLevel.M
  });

  qrBuilt = true;
}

function openQrSheet() {
  qrSheet.classList.add("show");
  qrSheet.setAttribute("aria-hidden", "false");
  buildQrOnce();
}

function closeQrSheet() {
  qrSheet.classList.remove("show");
  qrSheet.setAttribute("aria-hidden", "true");
}

qrFab.addEventListener("click", openQrSheet);
qrClose.addEventListener("click", closeQrSheet);

qrSheet.addEventListener("click", (e) => {
  if (e.target === qrSheet) closeQrSheet();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && qrSheet.classList.contains("show")) {
    closeQrSheet();
  }
});
