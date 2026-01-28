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
    // On-page preview (not the exported square)
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

    // Exported square JPG
    export: {
      sizePx: 3000,
      title: "MY EMPLOYEE ID CARD",

      // layout
      padding: 180,
      titleTopY: 240,
      titleFont: "700 120px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      idFont: "600 120px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",

      // barcode target box (we will scale barcode into this box)
      barcodeMaxWidth: 2400,
      barcodeMaxHeight: 900,

      // spacing
      gapTitleToBarcode: 140,
      gapBarcodeToId: 140,
    },

    // Barcode generation for export (we'll still scale into box)
    exportBarcode: {
      format: "upc",
      displayValue: false,
      flat: true,
      height: 160, // intrinsic height inside the SVG before scaling
      width: 3,    // intrinsic module width
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
  function digitsOnly(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function upcACheckDigit(first11) {
    let sumOdd = 0;
    let sumEven = 0;

    for (let i = 0; i < 11; i += 1) {
      const d = first11.charCodeAt(i) - 48;
      if (i % 2 === 0) sumOdd += d;
      else sumEven += d;
    }

    const total = sumOdd * 3 + sumEven;
    const mod = total % 10;
    return String((10 - mod) % 10);
  }

  function buildUpcAFromRaw(rawDigits) {
    const d = digitsOnly(rawDigits);
    if (!d) return "";

    if (d.length === 12) return d;

    const base11 = d.padStart(11, "0").slice(-11);
    return base11 + upcACheckDigit(base11);
  }

  function clearSvg(svgEl) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  }

  function setReady(ready) {
    dom.btnDownload.disabled = !ready;
    dom.btnDownload.setAttribute("aria-disabled", String(!ready));
  }

  // ---------- preview ----------
  function renderPreviewBarcode(upc12) {
    dom.box.style.display = "block";
    clearSvg(dom.svg);

    JsBarcode(dom.svg, upc12, config.previewBarcode);

    // make responsive
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

  // ---------- export (square JPG 3000x3000) ----------
  function makeBarcodeSvgDataUrl(upc12) {
    // Offscreen SVG for export
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(tmp, upc12, config.exportBarcode);

    const serialized = new XMLSerializer().serializeToString(tmp);

    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }

  function fitRect(srcW, srcH, maxW, maxH) {
    const scale = Math.min(maxW / srcW, maxH / srcH);
    return {
      w: Math.round(srcW * scale),
      h: Math.round(srcH * scale),
      scale,
    };
  }

  function drawCenteredText(ctx, text, xCenter, y, font, color = "#000") {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, xCenter, y);
  }

  function downloadLabelJpg() {
    if (!state.upc12 || !state.rawId) return;

    const S = config.export.sizePx;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d");

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, S, S);

    const centerX = S / 2;

    // Title (top)
    drawCenteredText(ctx, config.export.title, centerX, config.export.titleTopY, config.export.titleFont, "#000000");

    // Barcode image (centered block)
    const barcodeUrl = makeBarcodeSvgDataUrl(state.upc12);
    const img = new Image();

    img.onload = () => {
      try {
        // Measure intrinsic SVG size from image
        const srcW = img.width || 1;
        const srcH = img.height || 1;

        const fitted = fitRect(srcW, srcH, config.export.barcodeMaxWidth, config.export.barcodeMaxHeight);

        // Layout: we want barcode centered overall (visually centered in square),
        // but also respecting the title above.
        // We'll place barcode so that the combined block (barcode + rawId text) is centered around mid.
        const idTextY = (S / 2) + (fitted.h / 2) + config.export.gapBarcodeToId + 120; // baseline
        const barcodeY = idTextY - config.export.gapBarcodeToId - fitted.h;

        const drawX = Math.round(centerX - fitted.w / 2);
        const drawY = Math.round(barcodeY);

        ctx.drawImage(img, drawX, drawY, fitted.w, fitted.h);

        // Raw ID under barcode (ONLY user input)
        drawCenteredText(ctx, state.rawId, centerX, idTextY, config.export.idFont, "#000000");

        // Export JPG
        const a = document.createElement("a");
        a.href = c.toDataURL("image/jpeg", 1.0);
        a.download = `EMPLOYEE_ID_${state.rawId}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(barcodeUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(barcodeUrl);
      console.error("Failed to render barcode image for export.");
    };

    img.src = barcodeUrl;
  }

  // ---------- main ----------
  function render() {
    const raw = digitsOnly(dom.idInput.value).trim();
    if (dom.idInput.value !== raw) dom.idInput.value = raw;

    if (!raw) {
      resetUI();
      return;
    }

    state.rawId = raw;
    state.upc12 = buildUpcAFromRaw(raw);

    dom.out.textContent = state.upc12;
    renderPreviewBarcode(state.upc12);

    setReady(true);
  }

  function init() {
    resetUI();

    dom.idInput.addEventListener("input", () => {
      const d = digitsOnly(dom.idInput.value);
      if (dom.idInput.value !== d) dom.idInput.value = d;
    });

    dom.idInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") render();
    });

    dom.btnGen.addEventListener("click", render);
    dom.btnDownload.addEventListener("click", downloadLabelJpg);
  }

  init();
})();
