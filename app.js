(() => {
  "use strict";

  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: #${id}`);
    return el;
  };

  const dom = {
    idInput: $("idInput"),
    svg: $("svgBarcode"),
    box: $("barcodeBox"),
    out: $("textOut"),
    btnGen: $("btnGen"),
    btnDownload: $("btnDownload"),
  };

  const config = {
    // On-page preview barcode (does NOT affect exported image)
    previewBarcode: {
      format: "upc",
      displayValue: false,
      flat: true,
      height: 70,
      width: 2,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    },

    // Export square JPG
    export: {
      sizePx: 3000,

      // TOP TEXT (title)
      titleText: "Digital Employee ID Card",
      titleFontPx: 120,

      // BOTTOM TEXT (employee ID)
      idFontPx: 72,

      // QUIET ZONES (safe margins for scanning)
      // With maxWidth=2400 in a 3000px canvas => 300px each side minimum.
      barcodeMaxWidthPx: 2400,
      barcodeMaxHeightPx: 1050,
    },

    // Barcode used for export SVG (we then scale into barcodeMaxWidth/Height)
    exportBarcode: {
      format: "upc",
      displayValue: false,
      flat: true,
      height: 180,
      width: 4,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    },
  };

  const state = {
    upc12: "",
    rawId: "",
  };

  // ---------- utils ----------
  function digitsOnly(v) {
    return String(v ?? "").replace(/\D/g, "");
  }

  function upcACheckDigit(first11) {
    let odd = 0, even = 0;
    for (let i = 0; i < 11; i++) {
      const d = first11.charCodeAt(i) - 48;
      i % 2 === 0 ? (odd += d) : (even += d);
    }
    return String((10 - ((odd * 3 + even) % 10)) % 10);
  }

  function buildUpcA(raw) {
    const d = digitsOnly(raw);
    if (!d) return "";
    if (d.length === 12) return d;
    const base = d.padStart(11, "0").slice(-11);
    return base + upcACheckDigit(base);
  }

  function clearSvg(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function setReady(ok) {
    dom.btnDownload.disabled = !ok;
    dom.btnDownload.setAttribute("aria-disabled", String(!ok));
  }

  // ---------- preview ----------
  function renderPreview(upc) {
    dom.box.style.display = "block";
    clearSvg(dom.svg);

    JsBarcode(dom.svg, upc, config.previewBarcode);

    dom.svg.removeAttribute("width");
    dom.svg.removeAttribute("height");
    const bb = dom.svg.getBBox();
    dom.svg.setAttribute("viewBox", `0 0 ${bb.width} ${bb.height}`);
    dom.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  function resetUI() {
    dom.box.style.display = "none";
    dom.out.textContent = "—";
    clearSvg(dom.svg);
    state.upc12 = "";
    state.rawId = "";
    setReady(false);
  }

  // ---------- export helpers ----------
  function makeBarcodeSvgUrl(upc) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, upc, config.exportBarcode);
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }

  function drawText(ctx, text, y, font) {
    ctx.font = font;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(text, ctx.canvas.width / 2, y);
  }

  // ---------- export main ----------
  function downloadLabelJpg() {
    if (!state.upc12 || !state.rawId) return;

    const S = config.export.sizePx;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, S, S);

    const url = makeBarcodeSvgUrl(state.upc12);
    const img = new Image();

    img.onload = () => {
      try {
        const sw = img.width || 2000;
        const sh = img.height || 600;

        const scale = Math.min(
          config.export.barcodeMaxWidthPx / sw,
          config.export.barcodeMaxHeightPx / sh
        );

        const bw = Math.round(sw * scale);
        const bh = Math.round(sh * scale);

        // BARCODE — strictly centered
        const bx = Math.round((S - bw) / 2);
        const by = Math.round((S - bh) / 2);
        ctx.drawImage(img, bx, by, bw, bh);

        // TITLE — centered between top edge and barcode top
        const titleY = Math.round((by - config.export.titleFontPx) / 2);
        drawText(
          ctx,
          config.export.titleText,
          titleY,
          `700 ${config.export.titleFontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`
        );

        // EMPLOYEE ID — centered between barcode bottom and bottom edge
        const bottomStart = by + bh;
        const bottomHeight = S - bottomStart;
        const idY = Math.round(bottomStart + (bottomHeight - config.export.idFontPx) / 2);
        drawText(
          ctx,
          state.rawId,
          idY,
          `600 ${config.export.idFontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
        );

        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/jpeg", 1.0);
        a.download = `EMPLOYEE_ID_${state.rawId}.jpg`;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error("Failed to render barcode image for export.");
    };

    img.src = url;
  }

  // ---------- generate ----------
  function render() {
    const raw = digitsOnly(dom.idInput.value);
    dom.idInput.value = raw;

    if (!raw) {
      resetUI();
      return;
    }

    state.rawId = raw;
    state.upc12 = buildUpcA(raw);

    dom.out.textContent = state.upc12;
    renderPreview(state.upc12);
    setReady(true);
  }

  // ---------- init ----------
  function init() {
    resetUI();

    // do NOT auto-generate on input; only sanitize digits
    dom.idInput.addEventListener("input", () => {
      dom.idInput.value = digitsOnly(dom.idInput.value);
    });

    // Enter triggers Generate
    dom.idInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") render();
    });

    dom.btnGen.addEventListener("click", render);
    dom.btnDownload.addEventListener("click", downloadLabelJpg);
  }

  init();
})();

// --- Live US time (YYYY-MM-DD HH:MM:SS AM/PM) ---
function updateUSTime() {
  const now = new Date();

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const parts = fmt.formatToParts(now);
  const v = (t) => parts.find(p => p.type === t)?.value;

  const text =
    `${v("year")}-${v("month")}-${v("day")} ` +
    `${v("hour")}:${v("minute")}:${v("second")} ${v("dayPeriod")}`;

  const el = document.getElementById("usTime");
  if (el) el.textContent = text;
}

updateUSTime();
setInterval(updateUSTime, 1000);


// =======================
// Info modal (only UI)
// =======================
(() => {
  const infoBtn = document.getElementById("infoBtn");
  const infoModal = document.getElementById("infoModal");
  const infoClose = document.getElementById("infoClose");

  if (!infoBtn || !infoModal || !infoClose) return;

  const open = () => {
    infoModal.classList.add("isOpen");
    infoModal.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    infoModal.classList.remove("isOpen");
    infoModal.setAttribute("aria-hidden", "true");
  };

  infoBtn.addEventListener("click", open);
  infoClose.addEventListener("click", close);

  infoModal.addEventListener("click", (e) => {
    if (e.target && e.target.getAttribute("data-close") === "1") close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && infoModal.classList.contains("isOpen")) close();
  });
})();
