import React, { useState, useRef, useCallback, useEffect } from 'react';

interface BeforeAfterSliderProps { beforeImage: string; afterImage: string; }

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ beforeImage, afterImage }) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDragging) updatePosition(e.clientX); };
    const onTouchMove = (e: TouchEvent) => { if (isDragging) updatePosition(e.touches[0].clientX); };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onUp); };
  }, [isDragging, updatePosition]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{ cursor: isDragging ? 'col-resize' : 'ew-resize' }}
      onMouseDown={e => { setIsDragging(true); updatePosition(e.clientX); }}
      onTouchStart={e => { setIsDragging(true); updatePosition(e.touches[0].clientX); }}>
      <img src={afterImage} alt="After" className="block w-full object-cover" style={{ maxHeight: 480 }} draggable={false}/>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={beforeImage} alt="Before" className="block h-full object-cover" style={{ width: containerRef.current?.offsetWidth ?? '100%', maxHeight: 480 }} draggable={false}/>
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 shadow-[0_0_10px_rgba(0,0,0,0.4)]" style={{ left: `${position}%`, transform: 'translateX(-50%)', background: 'linear-gradient(to bottom,#d4a853,#f0cc7a,#d4a853)' }}/>
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full shadow-2xl flex items-center justify-center border-2 border-amber-400/50 z-10"
        style={{ left: `${position}%`, background: 'linear-gradient(135deg,#d4a853,#c9952e)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 18l-6-6 6-6"/><path d="M15 6l6 6-6 6"/></svg>
      </div>
      <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-widest uppercase pointer-events-none">Before</span>
      <span className="absolute top-3 right-3 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-widest uppercase pointer-events-none" style={{background:'linear-gradient(135deg,#d4a853,#c9952e)'}}>After ✦</span>
    </div>
  );
};

export default BeforeAfterSlider;
