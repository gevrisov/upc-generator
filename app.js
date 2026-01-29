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

      // TEXT (2 lines, above barcode)
      titleText: "Digital Employee ID Card",
      titleFontPx: 120,
      idFontPx: 72,
      lineGapPx: 26,

      // QUIET ZONES (safe margins for scanning)
      // With maxBW=2400 in a 3000px canvas => 300px each side minimum.
      barcodeMaxWidthPx: 2400,
      barcodeMaxHeightPx: 1050,
    },

    // Barcode used for export SVG (we then scale into barcodeMaxWidth/Height)
    exportBarcode: {
      format: "upc",
      displayValue: false,
      flat: true,
      height: 180, // intrinsic height (scaled later)
      width: 4,    // module width (thicker bars)
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

  // ---------- export helpers ----------
  function fitRect(srcW, srcH, maxW, maxH) {
    const scale = Math.min(maxW / srcW, maxH / srcH);
    return {
      w: Math.round(srcW * scale),
      h: Math.round(srcH * scale),
      scale,
    };
  }

  function makeBarcodeSvgUrl(upc12) {
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(tmp, upc12, config.exportBarcode);

    const serialized = new XMLSerializer().serializeToString(tmp);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }

  function drawCenteredTextTop(ctx, text, yTop, font, color = "#000") {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(text, ctx.canvas.width / 2, yTop);
  }

  // ---------- export main ----------
  function downloadLabelJpg() {
    if (!state.upc12 || !state.rawId) return;

    const S = config.export.sizePx;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, S, S);

    // Barcode SVG URL -> Image
    const barcodeUrl = makeBarcodeSvgUrl(state.upc12);
    const img = new Image();

    img.onload = () => {
      try {
        // Source image intrinsic size (may be 0 in some engines; fallback)
        const srcW = img.width || 2000;
        const srcH = img.height || 600;

        // Fit barcode into SAFE box (quiet zones preserved)
        const fitted = fitRect(
          srcW,
          srcH,
          config.export.barcodeMaxWidthPx,
          config.export.barcodeMaxHeightPx
        );

        const bw = fitted.w;
        const bh = fitted.h;

        // 1) BARCODE STRICTLY CENTERED IN THE WHOLE SQUARE
        const bx = Math.round((S - bw) / 2);
        const by = Math.round((S - bh) / 2);
        ctx.drawImage(img, bx, by, bw, bh);

        // 2) TEXT BLOCK: centered between TOP EDGE and BARCODE TOP
        const topSpace = by; // pixels from top edge to barcode top

        const titlePx = config.export.titleFontPx;
        const idPx = config.export.idFontPx;
        const gap = config.export.lineGapPx;

        const blockH = titlePx + gap + idPx;
        const blockTop = Math.round((topSpace - blockH) / 2);

        // Title line
        drawCenteredTextTop(
          ctx,
          config.export.titleText,
          blockTop,
          `700 ${titlePx}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`
        );

        // Employee ID (exactly what user entered)
        drawCenteredTextTop(
          ctx,
          state.rawId,
          blockTop + titlePx + gap,
          `600 ${idPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
        );

        // Export JPG
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/jpeg", 1.0);
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
