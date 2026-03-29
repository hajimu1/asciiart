import React, { useState, useEffect } from 'react';
import Slider from './Slider';

/* ===============================
   HELPERS
=============================== */

function Section({ title }: { title: string }) {
  return <div style={{ margin: '10px 0 6px 0', opacity: 0.9 }}>[{title}]</div>;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ui-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <span className={checked ? 'ui-on' : ''}>
        {checked ? '[+] ' : '[ ] '}
      </span>
      {label}
    </label>
  );
}

/* ===============================
   MAIN
=============================== */

type BottomTab = 'colorfx' | 'output';

export default function ControlsPanel(props: any) {
  const {
    settings,
    setSettings,
    FONT_PRESETS,
    charSets,
    activeCharsetPreview,
    loadFile,
    copyToClipboard,
    downloadPng,
    downloadTxt,
    downloadFramesAsZip,
    resetAll,
    fileInputRef,
    isGif,
    gifAsciiFrames,
  } = props;

  const [tab, setTab] = useState<BottomTab>('colorfx');

  /* ===============================
     PAPER MODE → AUTO INVERT
  =============================== */
  useEffect(() => {
    if (settings.outputMode === 'paper') {
      setSettings((s: any) => ({
        ...s,
        invertMode: 'full',
        invertAmount: 100,
      }));
    }
  }, [settings.outputMode]);

  return (
    <div
      className="ui"
      style={{
        width: 320,
        minWidth: 320,
        maxWidth: 320,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#000',
        color: '#e6e6e6',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/*,.gif"
        onChange={(e) => e.target.files && loadFile(e.target.files[0])}
      />

      {/* ================= UPLOAD + BASIC ================= */}
      <div style={{ padding: 10, borderBottom: '1px solid #333' }}>
        <Section title="UPLOAD" />
        <div
          className="ui-clickable"
          onClick={() => fileInputRef.current?.click()}
        >
          &gt; Upload Image / GIF
        </div>

        <Section title="BASIC" />
        <div>Columns : {settings.columns}</div>
        <Slider
          label="Columns"
          min={40}
          max={300}
          value={settings.columns}
          onChange={(v) => setSettings((s: any) => ({ ...s, columns: v }))}
        />

        <div>
          Font :
          <select
            value={settings.fontPreset}
            onChange={(e) =>
              setSettings((s: any) => ({ ...s, fontPreset: e.target.value }))
            }
          >
            {Object.entries(FONT_PRESETS).map(([k, v]: any) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <ToggleRow
          label="Auto Font Fit"
          checked={settings.autoFontFit}
          onChange={(v) => setSettings((s: any) => ({ ...s, autoFontFit: v }))}
        />
        <Slider
          label="Font Size"
          min={6}
          max={32}
          value={settings.fontSize}
          onChange={(v) => setSettings((s: any) => ({ ...s, fontSize: v }))}
        />

        {!settings.autoFontFit && (
          <>
            <Slider
              label="Line Height"
              min={0.8}
              max={2}
              step={0.05}
              value={settings.lineHeight}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, lineHeight: v }))
              }
            />
            <Slider
              label="Letter Spacing"
              min={-2}
              max={4}
              step={0.1}
              value={settings.letterSpacing}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, letterSpacing: v }))
              }
            />
          </>
        )}
      </div>

      {/* ================= OUTPUT MODE ================= */}
      <div style={{ padding: 10, borderBottom: '1px solid #333' }}>
        <Section title="OUTPUT MODE" />
        <ToggleRow
          label="Console (Black)"
          checked={settings.outputMode === 'console'}
          onChange={() =>
            setSettings((s: any) => ({ ...s, outputMode: 'console' }))
          }
        />
        <ToggleRow
          label="Paper (White)"
          checked={settings.outputMode === 'paper'}
          onChange={() =>
            setSettings((s: any) => ({ ...s, outputMode: 'paper' }))
          }
        />
      </div>

      {/* ================= TABS ================= */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '8px 10px',
          borderBottom: '1px solid #333',
        }}
      >
        <span
          className={`ui-cmd ${tab === 'colorfx' ? 'ui-on' : ''}`}
          onClick={() => setTab('colorfx')}
        >
          [ COLOR & FX ]
        </span>
        <span
          className={`ui-cmd ${tab === 'output' ? 'ui-on' : ''}`}
          onClick={() => setTab('output')}
        >
          [ OUTPUT ]
        </span>
      </div>

      {/* ================= TAB BODY ================= */}
      <div style={{ flex: 1, padding: 10, overflowY: 'auto' }}>
        {tab === 'colorfx' && (
          <>
            <Section title="CHARSET" />
            <select
              value={settings.charSet}
              onChange={(e) =>
                setSettings((s: any) => ({ ...s, charSet: e.target.value }))
              }
            >
              {Object.keys(charSets).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>

            {settings.charSet === 'custom' && (
              <input
                type="text"
                value={settings.customChars}
                onChange={(e) =>
                  setSettings((s: any) => ({
                    ...s,
                    customChars: e.target.value,
                  }))
                }
                style={{ width: '100%', marginTop: 4 }}
              />
            )}

            <div style={{ opacity: 0.7 }}>{activeCharsetPreview}</div>

            <Section title="COLOR MODE" />
            {[
              ['none', 'Monochrome'],
              ['source', 'Source Color'],
              ['single', 'Single Color'],
              ['gradient', 'Gradient'],
            ].map(([m, label]) => (
              <ToggleRow
                key={m}
                label={label}
                checked={settings.colorMode === m}
                onChange={() =>
                  setSettings((s: any) => ({ ...s, colorMode: m }))
                }
              />
            ))}

            {settings.colorMode === 'single' && (
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) =>
                  setSettings((s: any) => ({
                    ...s,
                    textColor: e.target.value,
                  }))
                }
              />
            )}

            {settings.colorMode === 'gradient' && (
              <>
                <input
                  type="color"
                  value={settings.gradientFrom}
                  onChange={(e) =>
                    setSettings((s: any) => ({
                      ...s,
                      gradientFrom: e.target.value,
                    }))
                  }
                />
                <input
                  type="color"
                  value={settings.gradientTo}
                  onChange={(e) =>
                    setSettings((s: any) => ({
                      ...s,
                      gradientTo: e.target.value,
                    }))
                  }
                />
              </>
            )}

            <Section title="COLOR ADJUST" />
            <Slider
              label="Brightness"
              min={0}
              max={200}
              value={settings.brightness}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, brightness: v }))
              }
            />
            <Slider
              label="Contrast"
              min={0}
              max={200}
              value={settings.contrast}
              onChange={(v) => setSettings((s: any) => ({ ...s, contrast: v }))}
            />
            <Slider
              label="Saturation"
              min={0}
              max={200}
              value={settings.saturation}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, saturation: v }))
              }
            />
            <Slider
              label="Hue"
              min={0}
              max={360}
              value={settings.hue}
              onChange={(v) => setSettings((s: any) => ({ ...s, hue: v }))}
            />
            <Slider
              label="Black Point"
              min={0}
              max={255}
              value={settings.blackPoint}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, blackPoint: v }))
              }
            />
            <Slider
              label="White Point"
              min={0}
              max={255}
              value={settings.whitePoint}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, whitePoint: v }))
              }
            />
            <Slider
              label="Gamma"
              min={0.1}
              max={3}
              step={0.1}
              value={settings.gamma}
              onChange={(v) => setSettings((s: any) => ({ ...s, gamma: v }))}
            />

            <Section title="FX" />
            <select
              value={settings.invertMode}
              onChange={(e) =>
                setSettings((s: any) => ({ ...s, invertMode: e.target.value }))
              }
            >
              <option value="none">Invert: None</option>
              <option value="full">Invert: Full</option>
              <option value="dark">Invert: Dark</option>
              <option value="light">Invert: Light</option>
            </select>

            <Slider
              label="Invert Amount"
              min={0}
              max={100}
              value={settings.invertAmount}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, invertAmount: v }))
              }
            />

            <ToggleRow
              label="Posterize"
              checked={settings.posterize}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, posterize: v }))
              }
            />
            <Slider
              label="Posterize Levels"
              min={2}
              max={64}
              value={settings.posterizeLevels}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, posterizeLevels: v }))
              }
            />

            <ToggleRow
              label="Threshold"
              checked={settings.threshold}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, threshold: v }))
              }
            />
            <Slider
              label="Threshold Value"
              min={0}
              max={255}
              value={settings.thresholdValue}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, thresholdValue: v }))
              }
            />

            <ToggleRow
              label="Render Mask"
              checked={settings.renderMaskEnabled}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, renderMaskEnabled: v }))
              }
            />
            <Slider
              label="Mask Threshold"
              min={0}
              max={1}
              step={0.01}
              value={settings.renderThreshold}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, renderThreshold: v }))
              }
            />
          </>
        )}

        {tab === 'output' && (
          <>
            <ToggleRow
              label="Transparent Background"
              checked={settings.transparentBg}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, transparentBg: v }))
              }
            />

            <Section title="OUTPUT PADDING" />
            <Slider
              label="Padding"
              min={0}
              max={200}
              value={settings.outputPadding.top}
              onChange={(v) =>
                setSettings((s: any) => ({
                  ...s,
                  outputPadding: {
                    top: v,
                    bottom: v,
                    left: v,
                    right: v,
                  },
                }))
              }
            />

            <Section title="TXT OPTIONS" />
            <ToggleRow
              label="Trim Line Right (TXT only)"
              checked={settings.trimLineRight}
              onChange={(v) =>
                setSettings((s: any) => ({ ...s, trimLineRight: v }))
              }
            />
          </>
        )}
      </div>

      {/* ================= ACTIONS ================= */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #333' }}>
        <Section title="ACTIONS" />
        <div className="ui-actions">
          <span onClick={copyToClipboard} className="ui-cmd">
            &gt; COPY
          </span>
          <span onClick={downloadPng} className="ui-cmd">
            &gt; PNG
          </span>
          <span onClick={downloadTxt} className="ui-cmd">
            &gt; TXT
          </span>
          {isGif && gifAsciiFrames?.length > 0 && (
            <span onClick={downloadFramesAsZip} className="ui-cmd">
              &gt; ZIP
            </span>
          )}
          <span onClick={resetAll} className="ui-cmd ui-danger">
            &gt; RESET
          </span>
        </div>
      </div>
    </div>
  );
}
