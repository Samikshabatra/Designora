import React, { useRef, useState, useEffect, useCallback } from 'react';

interface InpaintingCanvasProps {
  imageUrl: string;
  onSubmit: (img: string, mask: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

async function anyUrlToBase64(src: string): Promise<string> {
  if (!src) throw new Error('No image URL provided');
  if (src.startsWith('data:')) return src;
  const fetchUrl =
    src.startsWith('http://localhost') || src.startsWith('/api/')
      ? src
      : `${API_BASE}/api/proxy-image?url=${encodeURIComponent(src)}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('FileReader failed'));
    r.readAsDataURL(blob);
  });
}

type Stage = 'idle' | 'fetching' | 'ready-to-draw' | 'done' | 'error';

const InpaintingCanvas: React.FC<InpaintingCanvasProps> = ({
  imageUrl, onSubmit, onClose, isProcessing = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef   = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const b64Ref    = useRef<string>('');

  const [stage,      setStage]      = useState<Stage>('idle');
  const [loadError,  setLoadError]  = useState('');
  const [isDrawing,  setIsDrawing]  = useState(false);
  const [brushSize,  setBrushSize]  = useState(32);
  const [hasMask,    setHasMask]    = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 680, h: 460 });

  // ── Phase 1: fetch image + create HTMLImageElement ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStage('fetching');
    setLoadError('');
    setHasMask(false);

    (async () => {
      try {
        const b64 = await anyUrlToBase64(imageUrl);
        if (cancelled) return;
        b64Ref.current = b64;

        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          imgRef.current = img;
          const maxW  = Math.min(680, window.innerWidth - 120);
          const w     = maxW;
          const h     = Math.round(w * (img.naturalHeight / img.naturalWidth));
          setCanvasSize({ w, h });    // triggers Phase 2 useEffect
          setStage('ready-to-draw');  // canvas will now render with correct dimensions
        };
        img.onerror = () => {
          if (!cancelled) { setLoadError('Image decode failed.'); setStage('error'); }
        };
        img.src = b64;
      } catch (e: any) {
        if (!cancelled) { setLoadError(e.message || 'Failed to load image.'); setStage('error'); }
      }
    })();

    return () => { cancelled = true; };
  }, [imageUrl]);

  // ── Phase 2: draw image onto canvas after React has applied the new size ────
  // This runs whenever canvasSize changes AND stage is ready-to-draw.
  // We use a ref-polling loop to wait for the canvas DOM element to actually
  // reflect the new width/height (React sets attributes synchronously but the
  // browser paints asynchronously — we must verify before drawing).
  useEffect(() => {
    if (stage !== 'ready-to-draw') return;
    const img = imgRef.current;
    if (!img) return;

    let attempts = 0;
    const MAX = 30; // up to ~600 ms

    function tryDraw() {
      attempts++;
      const canvas = canvasRef.current;
      const mask   = maskRef.current;
      if (!canvas || !mask) {
        if (attempts < MAX) { setTimeout(tryDraw, 20); }
        else { setLoadError('Canvas not available.'); setStage('error'); }
        return;
      }

      // Make sure the DOM dimensions have updated to match our desired size
      if (canvas.width !== canvasSize.w || canvas.height !== canvasSize.h) {
        if (attempts < MAX) { setTimeout(tryDraw, 20); }
        else {
          // Force-set them and draw anyway
          canvas.width  = canvasSize.w;
          canvas.height = canvasSize.h;
          mask.width    = canvasSize.w;
          mask.height   = canvasSize.h;
          doDraw(canvas, mask, img);
        }
        return;
      }

      doDraw(canvas, mask, img);
    }

    function doDraw(canvas: HTMLCanvasElement, mask: HTMLCanvasElement, img: HTMLImageElement) {
      const { w, h } = canvasSize;
      const ctx  = canvas.getContext('2d')!;
      const mctx = mask.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, w, h);
      setStage('done');
    }

    // Start polling after one frame
    const raf = requestAnimationFrame(() => setTimeout(tryDraw, 16));
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, canvasSize]);

  // ── Drawing ─────────────────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src  = 'touches' in e ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const doPaint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const mask   = maskRef.current;
    if (!canvas || !mask || stage !== 'done') return;
    const { x, y } = getPos(e, canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 168, 53, 0.55)';
    ctx.fill();
    ctx.restore();

    const mctx = mask.getContext('2d')!;
    mctx.beginPath();
    mctx.arc(x, y, brushSize, 0, Math.PI * 2);
    mctx.fillStyle = 'white';
    mctx.fill();
    setHasMask(true);
  }, [stage, brushSize]);

  const clearMask = () => {
    const canvas = canvasRef.current;
    const mask   = maskRef.current;
    const img    = imgRef.current;
    if (!canvas || !mask || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const mctx = mask.getContext('2d')!;
    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, mask.width, mask.height);
    setHasMask(false);
  };

  const handleSubmit = () => {
    const mask = maskRef.current;
    const img  = imgRef.current;
    if (!mask || !img) return;

    // The mask canvas is at display size (e.g. 680x453) but the original image
    // is at full resolution (e.g. 1248x832). The inpainting model requires both
    // to be the same size. Resize the mask UP to match the original image.
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;

    // Create a full-resolution mask canvas
    const fullMask = document.createElement('canvas');
    fullMask.width  = fullW;
    fullMask.height = fullH;
    const fmCtx = fullMask.getContext('2d')!;
    // Scale up the painted mask to match original image dimensions
    fmCtx.drawImage(mask, 0, 0, fullW, fullH);

    // Create a clean full-resolution image canvas (in case b64Ref is missing)
    const clean = document.createElement('canvas');
    clean.width  = fullW;
    clean.height = fullH;
    clean.getContext('2d')!.drawImage(img, 0, 0, fullW, fullH);

    onSubmit(
      b64Ref.current || clean.toDataURL('image/png'),
      fullMask.toDataURL('image/png')
    );
  };

  const loaded = stage === 'done';
  const loadStatus =
    stage === 'fetching'      ? 'Downloading image…' :
    stage === 'ready-to-draw' ? 'Preparing canvas…'  : '';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-700 w-full max-w-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: '94vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#1c1917 0%,#292524 100%)' }}
        >
          <div>
            <h3 className="font-black text-white text-base tracking-tight">🖌 Edit Generated Design</h3>
            <p className="text-xs text-stone-400 mt-0.5">Paint over any area · AI will redesign only that region</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-700 text-stone-300 hover:bg-red-600 hover:text-white flex items-center justify-center font-bold text-sm transition-colors"
          >✕</button>
        </div>

        {/* Tip / status bar */}
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 flex items-center gap-2 flex-shrink-0">
          <span className="text-amber-500 text-sm">💡</span>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            {loaded
              ? 'Click & drag to paint · Then click Redesign Area'
              : loadStatus || 'Loading…'}
          </p>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-stone-950 p-3" style={{ minHeight: 0 }}>
          {stage === 'error' ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="text-red-400 font-bold text-sm mb-1">{loadError}</p>
              <p className="text-stone-500 text-xs mb-4">Make sure the backend is running on port 3001.</p>
              <button onClick={onClose} className="text-xs text-stone-400 border border-stone-600 px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors">Close</button>
            </div>
          ) : (
            <div style={{ width: canvasSize.w, maxWidth: '100%' }} className="relative">
              {/* Loading overlay — shown until stage === 'done' */}
              {!loaded && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950 rounded-xl z-10"
                  style={{ minHeight: 200 }}
                >
                  <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-stone-300 text-sm font-medium">{loadStatus}</p>
                  <p className="text-stone-500 text-xs mt-1">This may take a few seconds</p>
                </div>
              )}
              {/* Canvas — always in DOM so refs are available for drawing */}
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                className={`rounded-xl border-2 border-stone-600 w-full block select-none transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
                style={{ cursor: loaded ? 'crosshair' : 'default', touchAction: 'none', userSelect: 'none' }}
                onMouseDown={e => { e.preventDefault(); setIsDrawing(true); doPaint(e); }}
                onMouseMove={e => { if (isDrawing) doPaint(e); }}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                onTouchStart={e => { e.preventDefault(); setIsDrawing(true); doPaint(e); }}
                onTouchMove={e => { e.preventDefault(); if (isDrawing) doPaint(e); }}
                onTouchEnd={() => setIsDrawing(false)}
              />
              <canvas ref={maskRef} width={canvasSize.w} height={canvasSize.h} className="hidden" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 space-y-3 flex-shrink-0 bg-white dark:bg-stone-900">
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-stone-400 uppercase tracking-widest w-20">Brush</span>
            <input
              type="range" min={8} max={90} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="flex-1 accent-amber-400"
              disabled={!loaded}
            />
            <div
              className="rounded-full bg-amber-400/50 border-2 border-amber-400 flex-shrink-0 transition-all"
              style={{ width: Math.max(12, brushSize * 0.55), height: Math.max(12, brushSize * 0.55) }}
            />
            <span className="text-xs font-bold text-stone-500 w-12 text-right">{brushSize}px</span>
          </div>

          {loaded && hasMask  && !isProcessing && (
            <p className="text-xs text-emerald-500 font-bold text-center">✓ Area marked — ready to redesign</p>
          )}
          {loaded && !hasMask && (
            <p className="text-xs text-stone-400 text-center">Paint over the area you want changed, then click Redesign Area</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={clearMask}
              disabled={!hasMask || isProcessing}
              className="flex-1 py-3 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm font-bold rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >✕ Clear Paint</button>
            <button
              onClick={handleSubmit}
              disabled={!hasMask || isProcessing || !loaded}
              className="flex-1 py-3 gold-btn text-sm font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg"
            >
              {isProcessing
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>AI Redesigning…
                  </span>
                : '✦ Redesign Area'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InpaintingCanvas;
