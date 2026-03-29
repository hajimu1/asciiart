import React from 'react';

/* ==================================================
   ASCII HEADER (TERMINAL FEEL)
================================================== */

const ASCII_HEADER_ART = `
             __.............__
     .--""\`\`\`                 \`\`\`""--.
      ':--..___             ___..--:'
        \\      \`\`\`"""""""\`\`\`      /
      .-\`  ___.....-----.....___  '-.
    .:-""\`\`     ~          ~    \`\`""-:.
   /\`-..___ ~        ~         ~___..-'\`
  /  ~    '\`""---.........---""\`        \\
 ;                                       ;
; '::.   '          _,           _,       ;
|   ':::    '     .' (    ~   .-'./    ~  |
|~  .:'   .     _/..._'.    .'.-'/        |
| .:'       .-'\\\`      \\\` '-./.'_.'       |
|  ':.     ( o)   ))      ;= <_           |
; '::.      '-.,\\\\__ __.-;\\\`'. '.  .      ;
 ;    ':         \\) |\\\`\\ \\)  '.'-.\\      ;
  \\.:'.:':.         \\_/       '-._\\     /
   \\ ':.     ~                    \`    /
    '. '::..  _ . - - -- .~ _      ~ .'
      '-._':'                 \`'-_.-'
        (\`\`''--..._____...--''\`\`)
          \`"--...__     __...--"\`
                   \`\`\`\`\`
`;

/* ==================================================
   TYPES
================================================== */

type Props = {
  asciiArt: string;
  coloredHtml: string;
  colorMode: boolean;

  outputMode: 'paper' | 'console';
  transparentBg: boolean;

  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;

  outputPadding: { top: number; right: number; bottom: number; left: number };
  outputPx?: { w: number; h: number } | null;
  sourceImageSrc?: string | null;
  cropEnabled?: boolean;
  cropRect?: { x: number; y: number; w: number; h: number } | null;
  onCropRectChange?: (
    rect: { x: number; y: number; w: number; h: number } | null
  ) => void;
};

/* ==================================================
   PREVIEW CONFIG
================================================== */

// 🔥 프리뷰 전용 스케일 (출력 / 저장에는 영향 없음)
const PREVIEW_SCALE = 1.7;

/* ==================================================
   MAIN
================================================== */

export default function PreviewPanel(props: Props) {
  const {
    asciiArt,
    coloredHtml,
    colorMode,
    outputMode,
    fontFamily,
    fontSize,
    lineHeight,
    letterSpacing,
    outputPadding,
    sourceImageSrc,
    cropEnabled,
    cropRect,
    onCropRectChange,
  } = props;

  const hasContent = Boolean(asciiArt || coloredHtml);

  // OUTPUT 팔레트
  const bgColor = outputMode === 'paper' ? '#ffffff' : '#000000';
  const fgColor = outputMode === 'paper' ? '#000000' : '#e6e6e6';

  return (
    <div
      style={{
        height: '100%',
        background:
          colorMode && outputMode === 'console'
            ? '#000000' // ✅ 프리뷰 전용 강제 검정
            : bgColor,
        color: fgColor,
        fontFamily: 'DosStory, monospace',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ================= ASCII HEADER ================= */}
      <pre
        style={{
          margin: 0,
          padding: '6px 10px',
          whiteSpace: 'pre',
          fontFamily: 'Spleen, Galmuri11, monospace',
          lineHeight: 1.05,
          opacity: 0.85,
          borderBottom: '1px solid',
          borderColor: fgColor,
        }}
      >
        {ASCII_HEADER_ART}
      </pre>

      {/* ================= PREVIEW AREA ================= */}
      {sourceImageSrc && cropEnabled && cropRect && onCropRectChange && (
        <CropEditor
          sourceImageSrc={sourceImageSrc}
          cropRect={cropRect}
          onCropRectChange={onCropRectChange}
          fgColor={fgColor}
          bgColor={bgColor}
        />
      )}

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: bgColor,
        }}
      >
        {/* 🔥 여기서만 PREVIEW SCALE 적용 */}
        <div
          style={{
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: 'top left',
            width: `${100 / PREVIEW_SCALE}%`,
          }}
        >
          <div
            style={{
              padding: `${outputPadding.top}px ${outputPadding.right}px ${outputPadding.bottom}px ${outputPadding.left}px`,
              background: bgColor,
              color: fgColor,
              overflowX: 'hidden',
            }}
          >
            {!hasContent ? (
              <pre style={{ margin: 0, opacity: 0.6 }}>
                {`


/****************************************************************************/ 
/* Upload an image or GIF                                                   */ 
/* Adjust options on the left                                               */ 
/* ASCII output will appear here                                            */ 
/****************************************************************************/

`}
              </pre>
            ) : colorMode ? (
              <div
                className="asciiBox"
                style={{
                  fontFamily,
                  fontSize,
                  lineHeight,
                  letterSpacing,
                  whiteSpace: 'pre',
                  display: 'inline-block',
                  background: 'transparent',
                }}
                dangerouslySetInnerHTML={{ __html: coloredHtml }}
              />
            ) : (
              <pre
                className="asciiBox"
                style={{
                  margin: 0,
                  fontFamily,
                  fontSize,
                  lineHeight,
                  letterSpacing,
                  whiteSpace: 'pre',
                  display: 'inline-block',
                  background: 'transparent',
                  color: fgColor,
                }}
              >
                {asciiArt}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <pre
        style={{
          margin: 0,
          padding: '4px 10px',
          borderTop: '1px solid',
          borderColor: fgColor,
          fontSize: 11,
          opacity: 0.8,
          background: bgColor,
          color: fgColor,
        }}
      >
        {`MODE: ${outputMode.toUpperCase().padEnd(10)} | FONT: ${fontFamily}`}
      </pre>
    </div>
  );
}

function CropEditor({
  sourceImageSrc,
  cropRect,
  onCropRectChange,
  fgColor,
  bgColor,
}: {
  sourceImageSrc: string;
  cropRect: { x: number; y: number; w: number; h: number };
  onCropRectChange: (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }) => void;
  fgColor: string;
  bgColor: string;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const dragRef = React.useRef({
    active: false,
    grabOffsetX: 0,
    grabOffsetY: 0,
  });

  const [displaySize, setDisplaySize] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const update = () => {
      const img = imgRef.current;
      if (!img) return;
      setDisplaySize({
        w: img.clientWidth,
        h: img.clientHeight,
      });
    };

    update();

    const ro = new ResizeObserver(() => update());
    if (imgRef.current) ro.observe(imgRef.current);

    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [sourceImageSrc]);

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current.active || !displaySize.w || !displaySize.h) return;

      const wrap = wrapRef.current;
      if (!wrap) return;

      const bounds = wrap.getBoundingClientRect();
      let nextX =
        (e.clientX - bounds.left - dragRef.current.grabOffsetX) / displaySize.w;
      let nextY =
        (e.clientY - bounds.top - dragRef.current.grabOffsetY) / displaySize.h;

      nextX = Math.max(0, Math.min(nextX, 1 - cropRect.w));
      nextY = Math.max(0, Math.min(nextY, 1 - cropRect.h));

      onCropRectChange({
        ...cropRect,
        x: nextX,
        y: nextY,
      });
    };

    const handleUp = () => {
      dragRef.current.active = false;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [cropRect, displaySize.h, displaySize.w, onCropRectChange]);

  const boxStyle = {
    left: `${cropRect.x * 100}%`,
    top: `${cropRect.y * 100}%`,
    width: `${cropRect.w * 100}%`,
    height: `${cropRect.h * 100}%`,
  };

  return (
    <div
      style={{
        padding: '8px 10px',
        borderBottom: `1px solid ${fgColor}`,
        background: bgColor,
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          opacity: 0.8,
        }}
      >
        [ CROP EDITOR ] Drag box to move
      </div>

      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          border: `1px solid ${fgColor}`,
          overflow: 'hidden',
          background: '#111',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <img
          ref={imgRef}
          src={sourceImageSrc}
          alt="crop source"
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
        />

        <div
          onPointerDown={(e) => {
            e.preventDefault();
            const wrap = wrapRef.current;
            if (!wrap) return;

            const bounds = wrap.getBoundingClientRect();
            const boxLeft = cropRect.x * displaySize.w;
            const boxTop = cropRect.y * displaySize.h;

            dragRef.current.active = true;
            dragRef.current.grabOffsetX = e.clientX - bounds.left - boxLeft;
            dragRef.current.grabOffsetY = e.clientY - bounds.top - boxTop;
          }}
          style={{
            position: 'absolute',
            ...boxStyle,
            border: `2px solid ${fgColor}`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              padding: '2px 4px',
              fontSize: 10,
              background: '#000',
              color: fgColor,
            }}
          >
            DRAG
          </div>
        </div>
      </div>
    </div>
  );
}
