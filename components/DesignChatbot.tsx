import React, { useState, useRef, useEffect } from 'react';
import {
  sendChatMessage,
  ScannedProduct,
} from '../services/replicateService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  products?: ScannedProduct[];
}

interface DesignChatbotProps {
  designContext: {
    roomType: string;
    style: string;
    budget: string;
    budgetValue?: number;
    prompt: string;
    imageUrl?: string;
    originalImageBase64?: string;
  };
  onClose: () => void;
  onDesignUpdated?: (newImageUrl: string, newPrompt: string, updatedProducts: ScannedProduct[]) => void;
}

const STORE_COLORS: Record<string, string> = {
  'Amazon': 'bg-orange-500 hover:bg-orange-600',
  'Flipkart': 'bg-blue-600 hover:bg-blue-700',
  'IKEA': 'bg-blue-700 hover:bg-blue-800',
};

const CAT_ICONS: Record<string, string> = {
  Seating: '🛋️', Storage: '🗄️', Lighting: '💡', Tables: '🪑', Flooring: '🏠',
  Beds: '🛏️', Mattress: '😴', Wardrobe: '👗', Counters: '🍳', Cabinetry: '🪟',
  Appliance: '⚡', Vanity: '🪥', Shower: '🚿', Tiles: '🔲', Mirror: '🪞', Desk: '🖥️',
};

const ProductCard: React.FC<{ product: ScannedProduct }> = ({ product }) => (
  <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all">
    {/* Top row: icon + name + price */}
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <span className="text-xl flex-shrink-0 mt-0.5">{CAT_ICONS[product.category] || '📦'}</span>
        <div className="min-w-0">
          <p className="text-sm font-black text-stone-900 dark:text-white leading-tight">{product.name}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">{product.description}</p>
        </div>
      </div>
      {/* Estimated price range — bold and green */}
      <div className="flex-shrink-0">
        <span className="inline-block bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap">
          {product.priceRange}
        </span>
      </div>
    </div>
    {/* Store shop links */}
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">Shop:</span>
      {product.stores.map(store => (
        <a key={store.name} href={store.url} target="_blank" rel="noreferrer"
          className={`flex items-center gap-1.5 text-xs font-black text-white px-3 py-2 rounded-xl transition-all hover:scale-105 hover:shadow-md ${STORE_COLORS[store.name] || 'bg-stone-700 hover:bg-stone-800'}`}
          onClick={e => e.stopPropagation()}>
          <span>{store.logo}</span>
          <span>{store.name}</span>
          <span className="opacity-70 text-[10px]">↗</span>
        </a>
      ))}
    </div>
  </div>
);

const DesignChatbot: React.FC<DesignChatbotProps> = ({ designContext, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your **Design Advisor** ✦\n\nYou've got a **${designContext.style} ${designContext.roomType}** (${designContext.budget}).\n\nI can help with:\n• 🎨 **Colour advice** — shades that pair well with your style\n• 🛒 **Product recommendations** — furniture & decor within your budget\n• 📐 **Layout tips** — how to arrange and use your space\n• 💡 **Style guidance** — materials, textures and finishes\n\n*To generate a new design variant, use the Generate button on the left panel.*`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickActions = [
    '🎨 What colours suit this style?',
    '🛋️ Best sofa recommendations',
    '💡 Lighting ideas for this room',
    '🌿 How to add greenery?',
    '💰 Budget-friendly alternatives',
    '📐 Furniture layout tips',
  ];

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    try {
      const result = await sendChatMessage(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        { ...designContext, isChangeRequest: false } as any
      );
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: result.reply, timestamp: Date.now(), products: result.products || undefined },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${err.message}. Please try again.`, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const fmt = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-stone-100 dark:bg-stone-700 px-1 rounded text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br/>');

  return (
    <div className="flex flex-col bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden transition-colors duration-300" style={{ height: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center text-sm font-black text-stone-900">✦</div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">Design Advisor</p>
            <p className="text-xs text-stone-400">{designContext.style} · {designContext.roomType} · {designContext.budget}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black px-2.5 py-1 rounded-full uppercase tracking-widest">Advisor</span>
          <button onClick={onClose} className="text-stone-500 hover:text-white text-lg leading-none transition-colors ml-1">✕</button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 flex-shrink-0">
        <span className="text-amber-500 text-sm">💡</span>
        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
          Ask me for advice & product picks · Use the <strong>Generate</strong> button to create new design variants
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed transition-colors duration-300 ${msg.role === 'user'
              ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-medium rounded-br-sm max-w-[85%]'
              : 'bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-bl-sm w-full'}`}>
              {msg.role === 'assistant'
                ? <span dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                : <span>{msg.content}</span>}
              {msg.products && msg.products.length > 0 && (
                <div className="mt-3 border-t border-stone-100 dark:border-stone-700 pt-3">
                  <button onClick={() => setExpandedMsg(expandedMsg === i ? null : i)} className="flex items-center gap-2 w-full text-left mb-2.5 group">
                    <span className="text-xs font-black text-stone-700 dark:text-stone-300">
                      🛒 {msg.products.length} products with shop links
                    </span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full ml-1">
                      Estimated prices
                    </span>
                    <span className="text-stone-400 text-[11px] ml-auto">
                      {expandedMsg === i ? '▲ hide' : '▼ show & shop'}
                    </span>
                  </button>
                  {expandedMsg === i ? (
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                      {msg.products.map((p, pi) => <ProductCard key={pi} product={p} />)}
                    </div>
                  ) : (
                    <div className="flex gap-1.5 flex-wrap">
                      {msg.products.slice(0, 3).map((p, pi) => (
                        <button key={pi} onClick={() => setExpandedMsg(i)}
                          className="flex items-center gap-1 text-xs bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold px-2.5 py-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors border border-stone-200 dark:border-stone-600">
                          <span>{CAT_ICONS[p.category] || '📦'}</span>
                          <span>{p.name}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-black ml-1">{p.priceRange}</span>
                        </button>
                      ))}
                      {msg.products.length > 3 && (
                        <button onClick={() => setExpandedMsg(i)} className="text-xs bg-amber-400 text-stone-900 font-black px-2.5 py-1.5 rounded-xl hover:bg-amber-300 transition-colors">
                          +{msg.products.length - 3} more →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                <span className="text-[10px] text-stone-400 ml-1">Thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mb-1.5">Quick questions</p>
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map(qa => (
              <button key={qa} onClick={() => sendMessage(qa.replace(/^[\p{Emoji}\s]+/u, '').trim())} disabled={isLoading}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-all border disabled:opacity-40 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-amber-400 hover:text-stone-900 dark:hover:border-amber-400 dark:hover:text-white">
                {qa}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-stone-100 dark:border-stone-800 p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder='e.g. "What sofa colours work here?" or "Best rug for this style?"'
            rows={1} disabled={isLoading}
            className="flex-1 text-sm bg-transparent dark:text-white border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-amber-400 transition-colors placeholder:text-stone-300 dark:placeholder:text-stone-600 disabled:opacity-60"
            style={{ maxHeight: '100px' }} />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            className="w-10 h-10 bg-amber-400 text-stone-900 rounded-xl flex items-center justify-center hover:bg-amber-300 transition-colors disabled:opacity-40 flex-shrink-0">
            {isLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1.5 ml-1">Style advice · product picks · layout tips &nbsp;•&nbsp; Enter to send</p>
      </div>
    </div>
  );
};

export default DesignChatbot;
