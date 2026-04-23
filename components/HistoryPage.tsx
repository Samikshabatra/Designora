import React, { useState, useEffect } from 'react';
import { User, DesignResult } from '../types';

interface HistoryPageProps {
  user: User;
  onOpenDesign: (design: DesignResult) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

// Resolve image URL — local images need the API_BASE prefix
function resolveImg(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/api/')) return API_BASE + url;
  return url;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ user, onOpenDesign }) => {
  const [designs, setDesigns] = useState<DesignResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<DesignResult | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/history`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');
      setDesigns(data.designs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load design history.');
    } finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` },
      });
      setDesigns(prev => prev.filter(d => d.id !== id));
      if (selectedDesign?.id === id) setSelectedDesign(null);
      setDeleteConfirm(null);
    } catch (err) { console.error('Delete failed:', err); }
  };

  const uniqueStyles = ['all', ...new Set(designs.map(d => d.style).filter(Boolean))];
  const filteredDesigns = filter === 'all' ? designs : designs.filter(d => d.style === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">My Designs</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-2 font-medium">
          Browse your past creations &mdash; <span className="font-black text-black dark:text-white">{designs.length}</span> designs saved
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium rounded-xl px-4 py-3 mb-6">
          {error} <button onClick={fetchHistory} className="ml-3 underline font-black">Retry</button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-5 w-5 text-black dark:text-white mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-black text-stone-900 dark:text-white">Loading your designs...</span>
        </div>
      )}

      {!isLoading && designs.length === 0 && !error && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center min-h-[400px] p-12 text-center">
          <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center mb-6 text-4xl">📂</div>
          <h3 className="text-xl font-black text-stone-900 dark:text-white mb-2">No designs yet</h3>
          <p className="text-stone-500 dark:text-stone-400 font-medium max-w-sm">
            Head to the <strong>Design Studio</strong> to create your first AI-generated interior design.
          </p>
        </div>
      )}

      {!isLoading && designs.length > 0 && (
        <>
        <div className="flex gap-2 mb-6 flex-wrap">
          {uniqueStyles.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filter === s
                ? 'gold-btn border-black dark:border-white'
                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-black dark:hover:border-white'}`}>
              {s === 'all' ? `All (${designs.length})` : s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredDesigns.map(design => (
                <div key={design.id}
                  className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-xl ${
                    selectedDesign?.id === design.id ? 'border-black dark:border-white shadow-lg' : 'border-stone-200 dark:border-stone-800 hover:border-stone-400'}`}
                  onClick={() => setSelectedDesign(design)}>
                  <img src={resolveImg(design.imageUrl)} alt={design.prompt} className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold truncate">{design.style} &middot; {design.roomType}</p>
                    <p className="text-white/70 text-[10px]">{new Date(design.timestamp).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(design.id); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedDesign ? (
              <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden sticky top-24">
                <img src={resolveImg(selectedDesign.imageUrl)} alt={selectedDesign.prompt} className="w-full h-56 object-cover" />
                <div className="p-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {[selectedDesign.roomType, selectedDesign.style, selectedDesign.budget].filter(Boolean).map(t => (
                      <span key={t} className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold px-3 py-1.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-1">Prompt</p>
                    <p className="text-sm text-stone-700 dark:text-stone-300 font-medium leading-relaxed">{selectedDesign.prompt}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-1">Generated</p>
                    <p className="text-sm text-stone-700 dark:text-stone-300 font-medium">{new Date(selectedDesign.timestamp).toLocaleString()}</p>
                  </div>
                  {selectedDesign.totalEstimatedCost ? (
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-1">Estimated Cost</p>
                      <p className="text-sm font-black text-stone-900 dark:text-white">&#8377;{selectedDesign.totalEstimatedCost?.toLocaleString('en-IN')}</p>
                    </div>
                  ) : null}
                  <button
                      onClick={() => onOpenDesign(selectedDesign)}
                      className="w-full gold-btn text-xs font-black py-3.5 rounded-xl hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors mb-2">
                      ✦ Continue Editing in Studio
                    </button>
                  <div className="flex gap-2">
                    <a href={resolveImg(selectedDesign.imageUrl)} download="designora-design.jpg" target="_blank" rel="noreferrer"
                      className="flex-1 text-center bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-black py-3 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
                      ↓ Download
                    </a>
                    <button onClick={() => setDeleteConfirm(selectedDesign.id)}
                      className="flex-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-black py-3 rounded-xl hover:bg-red-100 transition-colors">
                      ✕ Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center min-h-[300px] p-8 text-center sticky top-24">
                <div className="text-3xl mb-3">👆</div>
                <p className="text-sm font-bold text-stone-500 dark:text-stone-400">Click a design to view details</p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-stone-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-stone-100 dark:border-stone-800"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-stone-900 dark:text-white mb-2">Delete Design?</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">This will permanently remove this design. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-black text-sm rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white font-black text-sm rounded-xl hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
