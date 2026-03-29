import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (v: number) => void;
};

export default function Slider({
  label,
  min,
  max,
  value,
  step = 1,
  onChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ 첫 클릭 때 “다른 슬라이더 바 길이 갑자기 커짐” 방지:
  // offsetWidth 측정을 state로 고정 + ResizeObserver로만 갱신
  const [bars, setBars] = useState(22);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    const computeBars = () => {
      const BAR_CHAR_WIDTH = 9; // 한 글자 폭 경험값 (Galmuri11)
      const raw = Math.floor(el.offsetWidth / BAR_CHAR_WIDTH);
      // ✅ 너무 길어지는 문제 캡
      setBars(clamp(raw, 16, 26));
    };

    computeBars();

    const ro = new ResizeObserver(() => computeBars());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const ratio = useMemo(() => {
    const denom = max - min;
    if (denom <= 0) return 0;
    return (value - min) / denom;
  }, [value, min, max]);

  const filled = Math.max(0, Math.min(bars, Math.round(ratio * bars)));
  const empty = Math.max(0, bars - filled);

  return (
    <div style={{ margin: "6px 0 12px 0" }}>
      {/* LABEL + VALUE */}
      <div
        style={{
          fontSize: 11,
          marginBottom: 4,
          opacity: 0.85,
          fontFamily: "Galmuri11, monospace",
        }}
      >
        {label} : {value}
      </div>

      {/* SLIDER WRAP */}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          fontFamily: "Galmuri11, monospace",
          fontSize: 12,
          lineHeight: 1.1,
          whiteSpace: "pre",
        }}
      >
        {/* ASCII BAR (DISPLAY) */}
        <div
          style={{
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          [{"#".repeat(filled)}
          {"-".repeat(empty)}]
        </div>

        {/* REAL RANGE (INPUT) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
}
