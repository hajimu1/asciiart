import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';

import {
  clamp,
  computeGrid,
  applyFilters,
  convertToASCII as engineConvertToASCII,
  convertToColorHTML as engineConvertToColorHTML,
} from './engine';

import ControlsPanel from './ui/ControlsPanel';
import PreviewPanel from './ui/PreviewPanel';

/* ===============================
   FONT PRESETS
================================ */
const FONT_PRESETS = {
  modern: {
    label: 'Modern (Consolas)',
    family: 'Consolas, "Courier New", monospace',
    aspect: 0.55,
    baseLineHeight: 1.0,
    baseLetterSpacing: 0.0,
  },

  neutral: {
    label: 'Neutral (IBM Plex Mono)',
    family: '"IBM Plex Mono", Consolas, monospace',
    aspect: 0.55,
    baseLineHeight: 1.0,
    baseLetterSpacing: -0.6,
  },

  classic: {
    label: 'Classic (Courier)',
    family: '"Courier New", Courier, monospace',
    aspect: 0.6,
    baseLineHeight: 0.93,
    baseLetterSpacing: -0.6,
  },

  RoundedFixedsys: {
    label: 'RoundedFixedsys',
    family: '"RoundedFixedsys", monospace',
    aspect: 1,
    baseLineHeight: 0.75,
    baseLetterSpacing: 2,
  },

  Spleen: {
    label: 'Spleen',
    family: '"Spleen", monospace',
    aspect: 1,
    baseLineHeight: 0.75,
    baseLetterSpacing: 2,
  },
} as const;

type FontKey = keyof typeof FONT_PRESETS;
type ThemeMode = 'dark' | 'light';
type BaseBy = 'width' | 'height';
type InvertMode = 'none' | 'full' | 'dark' | 'light';
type DensityCurve = 'linear' | 'darkBoost' | 'highlightCut' | 'sCurve';
type ColorMode = 'none' | 'source' | 'single' | 'gradient';
type OutputMode = 'paper' | 'console';

type Settings = {
  baseBy: BaseBy;
  columns: number;
  rows: number;
  spaceDensity: number;

  fontPreset: FontKey;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;

  outputPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  // render mask + edge
  renderMaskEnabled: boolean;
  renderThreshold: number;
  edgeWeight: number;

  // Auto Font Fit (기본 ON)
  autoFontFit: boolean;

  // charset
  charSet: string;
  customChars: string;

  // color adjust
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  grayscale: boolean;

  // threshold / posterize
  threshold: boolean;
  thresholdValue: number;
  posterize: boolean;
  posterizeLevels: number;

  // invert
  invertMode: InvertMode;
  invertAmount: number;

  // edge enhance (engine hook)
  densityCurve: DensityCurve;
  edgeEnhance: boolean;
  edgeThreshold: number;
  edgeBias: number;

  // color mode
  colorMode: ColorMode;
  textColor: string;
  gradientFrom: string;
  gradientTo: string;

  theme: ThemeMode;
  transparentBg: boolean;
  outputMode: OutputMode;

  gifPreviewSpeed: number;

  // TXT only
  trimLineRight: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  baseBy: 'width',
  columns: 150,
  rows: 80,
  spaceDensity: 1,

  fontPreset: 'modern',
  fontSize: 12,
  lineHeight: 1,
  letterSpacing: 0,

  autoFontFit: true,

  outputMode: 'console',
  transparentBg: false,

  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blackPoint: 0,
  whitePoint: 255,
  gamma: 1,
  grayscale: false,

  outputPadding: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  },

  trimLineRight: false,

  threshold: false,
  thresholdValue: 128,
  posterize: false,
  posterizeLevels: 8,

  invertMode: 'full',
  invertAmount: 100,

  renderMaskEnabled: false,
  renderThreshold: 0.35,
  edgeWeight: 0.5,

  densityCurve: 'sCurve',
  edgeEnhance: false,
  edgeThreshold: 80,
  edgeBias: 1,

  colorMode: 'none',
  textColor: '#ffffff',
  gradientFrom: '#ffffff',
  gradientTo: '#000000',

  theme: 'light',

  gifPreviewSpeed: 100,

  charSet: 'normal',
  customChars: ' .:-=+*#%@',
};

/* ===============================
   utils
================================ */
function pad3(n: number) {
  return String(n).padStart(3, '0');
}

function hexToRGB(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function ASCIIArtConverter() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isGif, setIsGif] = useState(false);

  const [gifFrames, setGifFrames] = useState<HTMLImageElement[]>([]);
  const [gifDelays, setGifDelays] = useState<number[]>([]);
  const [gifAsciiFrames, setGifAsciiFrames] = useState<string[]>([]);
  const [gifColorFrames, setGifColorFrames] = useState<string[]>([]);
  const [showGifPreview, setShowGifPreview] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  const [asciiArt, setAsciiArt] = useState('');
  const [coloredHtml, setColoredHtml] = useState('');

  // output pixel size (WYSIWYG capture)
  const [outputPx, setOutputPx] = useState<{ w: number; h: number } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewTimeoutRef = useRef<number | null>(null);
  const gifOriginalTimeoutRef = useRef<number | null>(null);

  const preset =
    FONT_PRESETS[settings.fontPreset as keyof typeof FONT_PRESETS] ??
    FONT_PRESETS.modern;

  // Auto Font Fit
  const effectiveLineHeight = settings.autoFontFit
    ? preset.baseLineHeight
    : settings.lineHeight;

  const effectiveLetterSpacing = settings.autoFontFit
    ? preset.baseLetterSpacing
    : settings.letterSpacing;

  // ASCII OUTPUT PALETTE (UI와 분리)
  const palette = useMemo(() => {
    if (settings.outputMode === 'paper') {
      return { bg: '#ffffff', fg: '#000000' };
    }
    return { bg: '#0b0d0e', fg: '#d0d4cf' };
  }, [settings.outputMode]);

  /* ===============================
     CHARSETS — FULL RESTORE
  ================================ */
  const charSets = useMemo(() => {
    const custom = settings.customChars?.trim() || ' .:-=+*#%@';
    return {
      normal: ' .:-=+*#%@',
      normal2: ' .:;+=xX$&#',
      asciiSoft: ' .:-=+*#',
      minimalist: ' .-:=+*#%@',

      dense:
        ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
      microDot: ' .\'"`^,:;!',
      highDensity: 'MNWQXKBDOZ0&%$@#',

      // ASCII/기호 계열
      puncLight: ' .,;:!?-',
      techAscii: ' .-+|/\\<>[]{}=*#@',
      waveAscii: ' ~-=≈≋',
      typewriter: " .,'-_:;=+!?|/\\()[]{}*#&%@",
      symbolFlow: ' `·.:,;~=+-|<>[](){}\\/*#&@',
      punctHeavy: ' .:,;!?-+=|*#$%&@',
      codeSymbol: ' .-_=+<>|/\\[]{}()*&#@',

      // 블록/도형 계열
      uiShade: ' ░▒▓',
      blocks: ' ░█',
      blocksFine: ' ░▒▓█',
      code437: '░▒▓█▄▌▐▀■',
      lineBox: ' ─│┌┐└┘├┤┬┴┼',
      circuitry: '|/\\-+',
      geoShapes: ' ▪▫◦○◌◍●◉',
      halfBlock: ' ▖▗▘▝▚▞▟█',

      // 유니코드 특수문자 계열
      katakana: ' ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
      braille: ' ⠁⠃⠇⠏⠟⠿',
      runic: ' ᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ',
      greek: ' ·∙ιαεοπσφψΩ',
      ogham: ' ᚁᚂᚃᚄᚅᚆᚇᚈᚉᚊᚋᚌᚍᚎᚏᚐᚑ',

      // 혼합형
      binary: ' 01',
      dots: ' .·•',
      circuitAlt: ' ·∙•○◎●',
      shadeBlock: ' ·:+%#█',
      mixedFine: ' .,·:;!|/\\()[]{}+=*#%@█',
      noiseGrain: ' .,:-~+*%#▒▓█',
      inkDrop: ' ·:•∙○◦●▪█',
      glitch: ' .,:;|/\\[]{}█▓▒░',
      acidBurn: ' `.,:-~=+*#%$▒▓█',

      custom,
    } as const;
  }, [settings.customChars]);

  const activeCharsetPreview = useMemo(() => {
    const cs =
      (charSets as any)[settings.charSet] || (charSets as any).normal || '';
    const flat = cs.replace(/\n/g, '');
    return flat.length > 32 ? flat.slice(0, 32) + '…' : flat;
  }, [charSets, settings.charSet]);

  const activeCharsetFull =
    (charSets as any)[settings.charSet] || (charSets as any).normal || '';

  const clearTimers = () => {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (gifOriginalTimeoutRef.current) {
      window.clearTimeout(gifOriginalTimeoutRef.current);
      gifOriginalTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const loadFile = async (file: File) => {
    clearTimers();

    setImage(null);
    setIsGif(false);
    setGifFrames([]);
    setGifDelays([]);
    setGifAsciiFrames([]);
    setGifColorFrames([]);
    setShowGifPreview(false);
    setCurrentFrame(0);
    setAsciiArt('');
    setColoredHtml('');

    if (file.type === 'image/gif') {
      setIsGif(true);
      await parseGif(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  /* ===============================
     GIF PARSER (accumulation + disposal)
  ================================ */
  const parseGif = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const parsed = parseGIF(buffer);
    const frames = decompressFrames(parsed, true);

    const w = frames[0]?.dims?.width || 1;
    const h = frames[0]?.dims?.height || 1;

    const acc = document.createElement('canvas');
    acc.width = w;
    acc.height = h;
    const accCtx = acc.getContext('2d')!;
    accCtx.clearRect(0, 0, w, h);

    const loaded: HTMLImageElement[] = [];
    const delays: number[] = [];

    let prevFrame: any = null;
    let prevRestore: ImageData | null = null;

    for (const f of frames) {
      // disposal for previous frame
      if (prevFrame) {
        if (prevFrame.disposalType === 2) {
          const d = prevFrame.dims;
          accCtx.clearRect(d.left, d.top, d.width, d.height);
        } else if (prevFrame.disposalType === 3 && prevRestore) {
          accCtx.putImageData(prevRestore, 0, 0);
        }
      }

      // if current wants restore-to-previous, snapshot BEFORE drawing it
      if (f.disposalType === 3) {
        prevRestore = accCtx.getImageData(0, 0, w, h);
      } else {
        prevRestore = null;
      }

      // draw patch to temp then onto accumulator
      const patch = new ImageData(
        new Uint8ClampedArray(f.patch),
        f.dims.width,
        f.dims.height
      );
      const tmp = document.createElement('canvas');
      tmp.width = f.dims.width;
      tmp.height = f.dims.height;
      tmp.getContext('2d')!.putImageData(patch, 0, 0);

      accCtx.drawImage(tmp, f.dims.left, f.dims.top);

      const img = new Image();
      img.src = acc.toDataURL('image/png');
      await new Promise<void>((r) => (img.onload = () => r()));
      loaded.push(img);

      const raw = typeof f.delay === 'number' ? f.delay : 10;
      const ms = Math.max(20, raw * 10);
      delays.push(ms);

      prevFrame = f;
    }

    setGifFrames(loaded);
    setGifDelays(delays);
    setImage(loaded[0] || null);
    setCurrentFrame(0);

    const tickOriginal = (idx: number) => {
      if (!loaded.length) return;
      setCurrentFrame(idx);
      setImage(loaded[idx]);

      const speed = clamp(settings.gifPreviewSpeed, 10, 400) / 100;
      const d = delays[idx] || 100;
      const nextDelay = Math.max(20, Math.round(d / speed));

      gifOriginalTimeoutRef.current = window.setTimeout(() => {
        tickOriginal((idx + 1) % loaded.length);
      }, nextDelay);
    };

    tickOriginal(0);
  };

  /* ===============================
     RESOLUTION (via engine)
  ================================ */
  const gridFor = (src: HTMLImageElement) =>
    computeGrid({
      srcWidth: src.width,
      srcHeight: src.height,
      baseBy: settings.baseBy,
      columns: settings.columns,
      rows: settings.rows,
      spaceDensity: settings.spaceDensity,
      aspect: preset.aspect,
    });

  /* ===============================
     ASCII CONVERT (mono)
  ================================ */
  const convertToASCII = (sourceImg: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const grid = gridFor(sourceImg);

    return engineConvertToASCII({
      sourceImg,
      canvas,
      grid,
      charSet: (charSets as any)[settings.charSet] || (charSets as any).normal,
      apply: (ctx: CanvasRenderingContext2D, w: number, h: number) =>
        applyFilters(ctx, w, h, settings),
      settings,
    });
  };

  /* ===============================
     ASCII CONVERT (color HTML)
  ================================ */
  const convertToColorHTML = (sourceImg: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const grid = gridFor(sourceImg);

    return engineConvertToColorHTML({
      sourceImg,
      canvas,
      grid,
      charSet: (charSets as any)[settings.charSet] || (charSets as any).normal,
      apply: (ctx: CanvasRenderingContext2D, w: number, h: number) =>
        applyFilters(ctx, w, h, settings),
      settings: {
        ...settings,
        gradFrom: hexToRGB(settings.gradientFrom),
        gradTo: hexToRGB(settings.gradientTo),
      },
      preset,
      palette,
    });
  };

  /* ===============================
     RECALC OUTPUT
  ================================ */
  useEffect(() => {
    if (!image) return;

    clearTimers();

    // stop original gif playback if leaving gif mode
    if (!isGif && gifOriginalTimeoutRef.current) {
      window.clearTimeout(gifOriginalTimeoutRef.current);
      gifOriginalTimeoutRef.current = null;
    }

    if (!isGif) {
      const mono = convertToASCII(image);
      setAsciiArt(mono);

      if (settings.colorMode !== 'none') {
        const html = convertToColorHTML(image);
        setColoredHtml(html);
      } else {
        setColoredHtml('');
      }
      return;
    }

    if (gifFrames.length) {
      const monos = gifFrames.map((f) => convertToASCII(f));
      setGifAsciiFrames(monos);
      setAsciiArt(monos[0] || '');

      if (settings.colorMode !== 'none') {
        const colors = gifFrames.map((f) => convertToColorHTML(f));
        setGifColorFrames(colors);
        setColoredHtml(colors[0] || '');
      } else {
        setGifColorFrames([]);
        setColoredHtml('');
      }
    }
  }, [
    image,
    isGif,
    gifFrames,
    settings,
    charSets,
    preset.aspect,
    preset.family,
    preset.baseLineHeight,
    preset.baseLetterSpacing,
    palette.bg,
    palette.fg,
  ]);

  /* ===============================
     GIF ASCII PREVIEW (uses delays)
  ================================ */
  const startAsciiPreview = () => {
    if (!gifFrames.length) return;
    if (!gifAsciiFrames.length) return;

    clearTimers();
    setShowGifPreview(true);

    const speed = clamp(settings.gifPreviewSpeed, 10, 400) / 100;

    const tick = (idx: number) => {
      const nextIdx = idx % gifFrames.length;

      if (settings.colorMode !== 'none') {
        const html = gifColorFrames[nextIdx] || '';
        setColoredHtml(html);
        setAsciiArt(gifAsciiFrames[nextIdx] || '');
      } else {
        setAsciiArt(gifAsciiFrames[nextIdx] || '');
      }

      const d = gifDelays[nextIdx] || 100;
      const delay = Math.max(20, Math.round(d / speed));

      previewTimeoutRef.current = window.setTimeout(() => {
        tick(nextIdx + 1);
      }, delay);
    };

    tick(0);
  };

  const stopAsciiPreview = () => {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setShowGifPreview(false);

    if (gifAsciiFrames.length) setAsciiArt(gifAsciiFrames[0]);
    if (settings.colorMode !== 'none' && gifColorFrames.length)
      setColoredHtml(gifColorFrames[0]);
  };

  const toggleAsciiPreview = () => {
    if (!isGif) return;
    if (showGifPreview) stopAsciiPreview();
    else startAsciiPreview();
  };

  /* ===============================
     WYSIWYG CAPTURE (no clipping)
  ================================ */
  const captureOutputFull = async () => {
    const node = document.querySelector('.asciiBox') as HTMLElement | null;
    if (!node) return null;

    const clone = node.cloneNode(true) as HTMLElement;

    // export-only overrides
    const bg = settings.transparentBg
      ? 'transparent'
      : settings.outputMode === 'paper'
      ? '#ffffff'
      : palette.bg;

    clone.style.background = bg;
    clone.style.border = 'none';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';

    clone.style.position = 'fixed';
    clone.style.left = '-99999px';
    clone.style.top = '0';

    document.body.appendChild(clone);

    const rect = clone.getBoundingClientRect();
    const SCALE = 2;

    setOutputPx({
      w: Math.round(rect.width * SCALE),
      h: Math.round(rect.height * SCALE),
    });

    const canvas = await html2canvas(clone, {
      backgroundColor: settings.transparentBg ? null : bg,
      scale: SCALE,
      width: rect.width,
      height: rect.height,
      windowWidth: rect.width,
      windowHeight: rect.height,
    });

    document.body.removeChild(clone);
    return canvas;
  };

  /* ===============================
     ACTIONS
  ================================ */
  const copyToClipboard = async () => {
    if (!asciiArt && !coloredHtml) return;
    try {
      if (settings.colorMode !== 'none' && coloredHtml) {
        await navigator.clipboard.writeText(coloredHtml);
      } else {
        await navigator.clipboard.writeText(asciiArt);
      }
      alert('클립보드에 복사됨!');
    } catch {
      alert('복사 실패: 브라우저 권한을 확인해 주세요.');
    }
  };

  const downloadTxt = () => {
    if (!asciiArt) return;

    let text = asciiArt;

    // Trim Line Right (TXT only)
    if (settings.trimLineRight) {
      text = text
        .split('\n')
        .map((line) => line.replace(/\s+$/g, ''))
        .join('\n');
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii-art.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!asciiArt && !coloredHtml) return;
    const canvas = await captureOutputFull();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ascii-art.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const downloadFramesAsZip = async () => {
    if (!isGif || !gifFrames.length) {
      alert('ZIP으로 저장할 GIF 프레임이 없습니다.');
      return;
    }
    if (!gifAsciiFrames.length) {
      alert('아직 변환 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    const zip = new JSZip();

    if (showGifPreview) stopAsciiPreview();

    for (let i = 0; i < gifFrames.length; i++) {
      const mono = gifAsciiFrames[i] || '';
      setAsciiArt(mono);

      if (settings.colorMode !== 'none') {
        const html = gifColorFrames[i] || '';
        setColoredHtml(html);
      }

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => setTimeout(() => r(), 20));

      const canvas = await captureOutputFull();
      if (!canvas) continue;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) continue;

      zip.file(`ascii-frame-${pad3(i + 1)}.png`, blob);
    }

    const out = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii-frames.zip';
    a.click();
    URL.revokeObjectURL(url);

    setAsciiArt(gifAsciiFrames[0] || '');
    if (settings.colorMode !== 'none') setColoredHtml(gifColorFrames[0] || '');
  };

  const resetAll = () => {
    clearTimers();
    setSettings(DEFAULT_SETTINGS);
  };

  /* ===============================
     UI styles (원본 그대로)
  ================================ */

  const shell: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '420px 1fr',
    gap: 14,
    alignItems: 'stretch',
    height: '100%',
    fontSize: 15,
  };

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const advancedBody = (
    <div
      style={{
        padding: 8,
        marginBottom: 6,
        fontSize: 12,
        background: 'transparent',
        color: '#e6e6e6',
        fontFamily: 'Galmuri11, monospace',
        maxWidth: 280,
      }}
    >
      {/* ================= Color Adjust ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Color Adjust
      </div>

      <SliderRow
        label="Brightness"
        valueLabel={`${settings.brightness}%`}
        min={0}
        max={200}
        value={settings.brightness}
        onChange={(v) => setSettings((s) => ({ ...s, brightness: v }))}
      />

      <SliderRow
        label="Contrast"
        valueLabel={`${settings.contrast}%`}
        min={0}
        max={200}
        value={settings.contrast}
        onChange={(v) => setSettings((s) => ({ ...s, contrast: v }))}
      />

      <SliderRow
        label="Saturation"
        valueLabel={`${settings.saturation}%`}
        min={0}
        max={200}
        value={settings.saturation}
        onChange={(v) => setSettings((s) => ({ ...s, saturation: v }))}
      />

      <SliderRow
        label="Hue"
        valueLabel={`${settings.hue}°`}
        min={0}
        max={360}
        value={settings.hue}
        onChange={(v) => setSettings((s) => ({ ...s, hue: v }))}
      />

      <CheckboxRow
        label="Grayscale"
        checked={settings.grayscale}
        onChange={(v) => setSettings((s) => ({ ...s, grayscale: v }))}
      />

      <div style={{ height: 12 }} />

      {/* ================= Invert ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Invert
      </div>

      <select
        value={settings.invertMode}
        onChange={(e) =>
          setSettings((s) => ({ ...s, invertMode: e.target.value as any }))
        }
        style={{
          width: '100%',
          marginBottom: 6,
          background: '#000',
          color: '#e6e6e6',
          border: '1px solid #666',
          fontSize: 12,
        }}
      >
        <option value="none">None</option>
        <option value="full">Full</option>
        <option value="dark">Dark only</option>
        <option value="light">Light only</option>
      </select>

      <SliderRow
        label="Amount"
        valueLabel={`${settings.invertAmount}%`}
        min={0}
        max={100}
        value={settings.invertAmount}
        onChange={(v) => setSettings((s) => ({ ...s, invertAmount: v }))}
      />

      <div style={{ height: 12 }} />

      {/* ================= Posterize ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Posterize
      </div>

      <CheckboxRow
        label="Enable"
        checked={settings.posterize}
        onChange={(v) => setSettings((s) => ({ ...s, posterize: v }))}
      />

      <SliderRow
        label="Levels"
        valueLabel={`${settings.posterizeLevels}`}
        min={2}
        max={64}
        value={settings.posterizeLevels}
        onChange={(v) => setSettings((s) => ({ ...s, posterizeLevels: v }))}
      />

      <div style={{ height: 12 }} />

      {/* ================= Threshold ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Threshold
      </div>

      <CheckboxRow
        label="Enable"
        checked={settings.threshold}
        onChange={(v) => setSettings((s) => ({ ...s, threshold: v }))}
      />

      <SliderRow
        label="Value"
        valueLabel={`${settings.thresholdValue}`}
        min={0}
        max={255}
        value={settings.thresholdValue}
        onChange={(v) => setSettings((s) => ({ ...s, thresholdValue: v }))}
      />

      <div style={{ height: 12 }} />

      {/* ================= Render Mask ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Render Mask
      </div>

      <CheckboxRow
        label="Enable"
        checked={settings.renderMaskEnabled}
        onChange={(v) => setSettings((s) => ({ ...s, renderMaskEnabled: v }))}
      />

      <SliderRow
        label="Mask Threshold"
        valueLabel={settings.renderThreshold.toFixed(2)}
        min={0}
        max={1}
        step={0.01}
        value={settings.renderThreshold}
        onChange={(v) => setSettings((s) => ({ ...s, renderThreshold: v }))}
      />

      <div style={{ height: 12 }} />

      {/* ================= Output Padding ================= */}
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
        Output Padding
      </div>

      <SliderRow
        label="Vertical"
        valueLabel={`${settings.outputPadding.top}`}
        min={0}
        max={200}
        value={settings.outputPadding.top}
        onChange={(v) =>
          setSettings((s) => ({
            ...s,
            outputPadding: {
              ...s.outputPadding,
              top: v,
              bottom: v,
            },
          }))
        }
      />

      <SliderRow
        label="Horizontal"
        valueLabel={`${settings.outputPadding.left}`}
        min={0}
        max={200}
        value={settings.outputPadding.left}
        onChange={(v) =>
          setSettings((s) => ({
            ...s,
            outputPadding: {
              ...s.outputPadding,
              left: v,
              right: v,
            },
          }))
        }
      />

      <div style={{ height: 8 }} />

      {/* ================= TXT ONLY ================= */}
      <CheckboxRow
        label="Trim Line Right (TXT only)"
        checked={settings.trimLineRight}
        onChange={(v) => setSettings((s) => ({ ...s, trimLineRight: v }))}
      />
    </div>
  );

  return (
    <div
      style={{
        padding: 14,
        height: '100vh',
        overflow: 'auto',
        boxSizing: 'border-box',
        background: '#000',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ================= ASCII TITLE ================= */}
      <pre
        style={{
          margin: 0,
          padding: '8px 12px',
          background: '#000',
          color: '#e6e6e6',
          fontFamily: 'Courier New, monospace',
          fontSize: 12,
          lineHeight: 1.1,
          borderBottom: '1px solid #fff',
          userSelect: 'none',
        }}
      >
        {`
:::'###:::::'######:::'######::'####:'####:::::::'###::::'########::'########:::::'######:::'#######::'##::: ##:'##::::'##:'########:'########::'########:'########:'########::
::'## ##:::'##... ##:'##... ##:. ##::. ##:::::::'## ##::: ##.... ##:... ##..:::::'##... ##:'##.... ##: ###:: ##: ##:::: ##: ##.....:: ##.... ##:... ##..:: ##.....:: ##.... ##:
:'##:. ##:: ##:::..:: ##:::..::: ##::: ##::::::'##:. ##:: ##:::: ##:::: ##::::::: ##:::..:: ##:::: ##: ####: ##: ##:::: ##: ##::::::: ##:::: ##:::: ##:::: ##::::::: ##:::: ##:
'##:::. ##:. ######:: ##:::::::: ##::: ##:::::'##:::. ##: ########::::: ##::::::: ##::::::: ##:::: ##: ## ## ##: ##:::: ##: ######::: ########::::: ##:::: ######::: ########::
 #########::..... ##: ##:::::::: ##::: ##::::: #########: ##.. ##:::::: ##::::::: ##::::::: ##:::: ##: ##. ####:. ##:: ##:: ##...:::: ##.. ##:::::: ##:::: ##...:::: ##.. ##:::
 ##.... ##:'##::: ##: ##::: ##:: ##::: ##::::: ##.... ##: ##::. ##::::: ##::::::: ##::: ##: ##:::: ##: ##:. ###::. ## ##::: ##::::::: ##::. ##::::: ##:::: ##::::::: ##::. ##::
 ##:::: ##:. ######::. ######::'####:'####:::: ##:::: ##: ##:::. ##:::: ##:::::::. ######::. #######:: ##::. ##:::. ###:::: ########: ##:::. ##:::: ##:::: ########: ##:::. ##:
..:::::..:::......::::......:::....::....:::::..:::::..::..:::::..:::::..:::::::::......::::.......:::..::::..:::::...:::::........::..:::::..:::::..:::::........::..:::::..::                                                                                                                                                                                                                                                                                                    
`}
      </pre>

      {outputPx && (
        <pre
          style={{
            margin: 0,
            padding: '4px 12px',
            background: '#000',
            color: '#cfcfcf',
            fontSize: 11,
            borderBottom: '1px solid #333',
          }}
        >
          {` OUTPUT SIZE : ${outputPx.w} x ${outputPx.h} px`}
        </pre>
      )}

      <div style={shell}>
        <ControlsPanel
          settings={settings}
          setSettings={setSettings}
          isGif={isGif}
          gifFrames={gifFrames}
          gifAsciiFrames={gifAsciiFrames}
          showGifPreview={showGifPreview}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          FONT_PRESETS={FONT_PRESETS}
          charSets={charSets}
          activeCharsetPreview={activeCharsetPreview}
          activeCharsetFull={activeCharsetFull}
          loadFile={loadFile}
          toggleAsciiPreview={toggleAsciiPreview}
          copyToClipboard={copyToClipboard}
          downloadPng={downloadPng}
          downloadTxt={downloadTxt}
          downloadFramesAsZip={downloadFramesAsZip}
          resetAll={resetAll}
          fileInputRef={fileInputRef}
          asciiArt={asciiArt}
          coloredHtml={coloredHtml}
          advancedBody={advancedBody}
        />

        <PreviewPanel
          asciiArt={asciiArt}
          coloredHtml={coloredHtml}
          colorMode={settings.colorMode !== 'none'}
          outputMode={settings.outputMode}
          transparentBg={settings.transparentBg}
          fontFamily={preset.family}
          fontSize={settings.fontSize}
          lineHeight={effectiveLineHeight}
          letterSpacing={effectiveLetterSpacing}
          outputPadding={settings.outputPadding}
          outputPx={outputPx}
        />
      </div>
    </div>
  );
}

/* ==================================================
   LOCAL UI HELPERS (ADVANCED ONLY)
   - App.tsx 전용
   - ControlsPanel의 Slider와 별개
================================================== */

function SliderRow(props: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#e6e6e6',
          marginBottom: 4,
        }}
      >
        <span>{props.label}</span>
        <span>{props.valueLabel}</span>
      </div>

      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#e6e6e6',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

function CheckboxRow(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: '#e6e6e6',
        marginBottom: 8,
      }}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}
