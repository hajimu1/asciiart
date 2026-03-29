// src/engine/asciiEngine.ts
// ===============================================================
// ASCII ENGINE — 순수 계산 로직 (React / state / presets 모름)
// ===============================================================

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* ===============================================================
   GRID
=============================================================== */
export function computeGrid(params: {
  srcWidth: number;
  srcHeight: number;
  baseBy: 'width' | 'height';
  columns: number;
  rows: number;
  spaceDensity: number;
  aspect: number;
}) {
  const { srcWidth, srcHeight, baseBy, columns, rows, spaceDensity, aspect } =
    params;

  const density = Math.max(1, Math.floor(spaceDensity));
  const srcRatio = srcHeight / srcWidth;

  let cols = clamp(Math.floor(columns), 10, 800);
  let rws = clamp(Math.floor(rows), 10, 800);

  if (baseBy === 'width') {
    rws = Math.max(1, Math.floor(cols * srcRatio * aspect));
  } else {
    cols = Math.max(1, Math.floor(rws / (srcRatio * aspect)));
  }

  return { cols, rows: rws, density };
}

/* ===============================================================
   FILTERS (원본과 동일)
=============================================================== */
export function applyFilters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: any
) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const hueRad = (settings.hue * Math.PI) / 180;
  const cosA = Math.cos(hueRad);
  const sinA = Math.sin(hueRad);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    const tr = r * cosA + g * sinA;
    const tg = r * -sinA + g * cosA;
    r = tr;
    g = tg;

    r *= settings.brightness / 100;
    g *= settings.brightness / 100;
    b *= settings.brightness / 100;

    const c = settings.contrast / 100;
    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    b = (b - 128) * c + 128;

    const bp = clamp(settings.blackPoint ?? 0, 0, 255) / 255;
    const wp = clamp(settings.whitePoint ?? 255, 0, 255) / 255;
    const gamma = Math.max(0.01, settings.gamma ?? 1);
    const toneRange = Math.max(0.0001, wp - bp);

    const applyTone = (v: number) => {
      let n = v / 255;
      n = (n - bp) / toneRange;
      n = clamp(n, 0, 1);
      n = Math.pow(n, gamma);
      return n * 255;
    };

    r = applyTone(r);
    g = applyTone(g);
    b = applyTone(b);

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const s = settings.saturation / 100;
    r = gray + (r - gray) * s;
    g = gray + (g - gray) * s;
    b = gray + (b - gray) * s;

    if (settings.grayscale) {
      r = g = b = gray;
    }

    if (settings.invertMode !== 'none' || settings.invertAmount > 0) {
      const threshold = 128;
      let inv = false;
      if (settings.invertMode === 'full') inv = true;
      else if (settings.invertMode === 'dark') inv = gray < threshold;
      else if (settings.invertMode === 'light') inv = gray >= threshold;

      if (inv || settings.invertAmount > 0) {
        const amt = clamp(settings.invertAmount, 0, 100) / 100;
        r += ((inv ? 255 - r : r) - r) * amt;
        g += ((inv ? 255 - g : g) - g) * amt;
        b += ((inv ? 255 - b : b) - b) * amt;
      }
    }

    if (settings.posterize) {
      const lv = clamp(settings.posterizeLevels, 2, 64);
      const step = 255 / (lv - 1);
      r = Math.round(r / step) * step;
      g = Math.round(g / step) * step;
      b = Math.round(b / step) * step;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
    data[i + 3] = a;
  }

  if (settings.threshold) {
    const t = clamp(settings.thresholdValue, 0, 255);
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const v = avg > t ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return imgData;
}

/* ===============================================================
   Utils (원본과 동일)
=============================================================== */
function densityCurve(bright: number, mode: string) {
  const t = bright / 255;
  switch (mode) {
    case 'darkBoost':
      return Math.pow(t, 0.7);
    case 'highlightCut':
      return 1 - Math.pow(1 - t, 1.6);
    case 'sCurve':
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

function edgeStrength(data: Uint8ClampedArray, i: number, w: number) {
  const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
  const r =
    i + 4 < data.length ? (data[i + 4] + data[i + 5] + data[i + 6]) / 3 : b;
  const d =
    i + w * 4 < data.length
      ? (data[i + w * 4] + data[i + w * 4 + 1] + data[i + w * 4 + 2]) / 3
      : b;
  return Math.abs(b - r) + Math.abs(b - d);
}

export function escapeHtmlChar(ch: string) {
  if (ch === '&') return '&amp;';
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '"') return '&quot;';
  return ch;
}

/* ===============================================================
   ASCII (mono)
=============================================================== */
export function convertToASCII(params: any) {
  const { sourceImg, canvas, grid, charSet, apply } = params;

  const s = {
    densityCurve: 'linear',
    edgeEnhance: false,
    edgeThreshold: 0,
    edgeBias: 0,

    // === MODIFIED @ ~347 : Render Mask (ADD ONLY, DEFAULT OFF)
    renderMaskEnabled: false,
    renderThreshold: 0.35,
    edgeWeight: 0.5,

    ...(params.settings || {}),
  };

  const { cols, rows, density } = grid;

  const ctx = canvas.getContext('2d')!;
  canvas.width = cols;
  canvas.height = rows;

  ctx.drawImage(sourceImg, 0, 0, cols, rows);
  const imgData = apply(ctx, cols, rows);

  let out = '';
  const len = charSet.length;

  for (let y = 0; y < rows; y += density) {
    for (let x = 0; x < cols; x += density) {
      const i = (y * cols + x) * 4;
      const a = imgData.data[i + 3];
      if (a < 10) {
        out += ' ';
        continue;
      }

      const b =
        (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;

      const t = densityCurve(b, s.densityCurve);
      let idx = Math.floor(t * (len - 1));

      if (s.edgeEnhance) {
        const e = edgeStrength(imgData.data, i, cols);
        if (e > s.edgeThreshold) {
          idx = Math.min(idx + s.edgeBias, len - 1);
        }
      }

      let ch = charSet[idx] ?? ' ';

      // === MODIFIED @ ~347 : Render Mask
      if (s.renderMaskEnabled) {
        const e = edgeStrength(imgData.data, i, cols) / 255;
        const score = Math.max(t, e * s.edgeWeight);
        if (score < s.renderThreshold) {
          ch = ' ';
        }
      }

      out += ch;
    }
    out += '\n';
  }

  return out;
}

/* ===============================================================
   ASCII (color)
=============================================================== */
export function convertToColorHTML(params: any) {
    const { sourceImg, canvas, grid, charSet, apply, preset } = params;

  const s = {
    densityCurve: 'linear',
    edgeEnhance: false,
    edgeThreshold: 0,
    edgeBias: 0,

    // === MODIFIED @ ~347 : Render Mask (ADD ONLY)
    renderMaskEnabled: false,
    renderThreshold: 0.35,
    edgeWeight: 0.5,

    ...(params.settings || {}),
  };

  const { cols, rows, density } = grid;
  const ctx = canvas.getContext('2d')!;
  canvas.width = cols;
  canvas.height = rows;

  ctx.drawImage(sourceImg, 0, 0, cols, rows);
  const imgData = apply(ctx, cols, rows);

  const len = charSet.length;
  const bg = 'transparent';

  let html = `<div class="asciiBoxInner" style="
    background:${bg};
    font-family:${preset.family};
    font-size:${s.fontSize}px;
    line-height:${s.lineHeight};
    letter-spacing:${(preset.letterSpacing + s.letterSpacing).toFixed(2)}px;
    white-space:pre;
  ">`;

  for (let y = 0; y < rows; y += density) {
    for (let x = 0; x < cols; x += density) {
      const i = (y * cols + x) * 4;
      const a = imgData.data[i + 3];
      if (a < 10) {
        html += ' ';
        continue;
      }

      const r = imgData.data[i];
      const g = imgData.data[i + 1];
      const b = imgData.data[i + 2];
      const bright = (r + g + b) / 3;

      const t = densityCurve(bright, s.densityCurve);
      let idx = Math.floor(t * (len - 1));

      if (s.edgeEnhance) {
        const e = edgeStrength(imgData.data, i, cols);
        if (e > s.edgeThreshold) {
          idx = Math.min(idx + s.edgeBias, len - 1);
        }
      }

      let ch = charSet[idx] ?? ' ';

      // === MODIFIED @ ~347 : Render Mask
      if (s.renderMaskEnabled) {
        const e = edgeStrength(imgData.data, i, cols) / 255;
        const score = Math.max(t, e * s.edgeWeight);
        if (score < s.renderThreshold) {
          ch = ' ';
        }
      }

      let color = `rgb(${r},${g},${b})`;
      if (s.colorMode === 'single') {
        color = s.textColor;
      } else if (s.colorMode === 'gradient') {
        const k = t;
        color = `rgb(
          ${Math.round(s.gradFrom.r * (1 - k) + s.gradTo.r * k)},
          ${Math.round(s.gradFrom.g * (1 - k) + s.gradTo.g * k)},
          ${Math.round(s.gradFrom.b * (1 - k) + s.gradTo.b * k)}
        )`;
      }

      html += `<span style="color:${color}">${escapeHtmlChar(ch)}</span>`;
    }
    html += '\n';
  }

  html += `</div>`;
  return html;
}
