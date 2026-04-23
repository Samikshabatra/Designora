import React, { useState } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

interface StarRatingProps { designId: string; initialRating?: number | null; token?: string; onRate?: (r: number) => void; }

const StarRating: React.FC<StarRatingProps> = ({ designId, initialRating = null, token, onRate }) => {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRate = async (star: number) => {
    if (saving) return;
    setSaving(true); setRating(star);
    try {
      if (token) await fetch(`${API_BASE}/api/designs/${designId}/rating`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ rating: star }) });
      onRate?.(star); setConfirmed(true); setTimeout(() => setConfirmed(false), 2000);
    } catch { } finally { setSaving(false); }
  };

  const display = hovered ?? rating;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Rate</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(star => (
          <button key={star} onClick={() => handleRate(star)} onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(null)} disabled={saving}
            className="transition-transform hover:scale-125 active:scale-110 disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={display !== null && star <= display ? '#d4a853' : 'none'} stroke={display !== null && star <= display ? '#d4a853' : '#94a3b8'} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        ))}
      </div>
      {confirmed && <span className="text-[10px] font-bold text-emerald-600 animate-pulse">✓ Saved</span>}
      {!confirmed && rating && <span className="text-[10px] text-stone-400 font-semibold">{rating}/5</span>}
    </div>
  );
};

export default StarRating;
