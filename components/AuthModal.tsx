import React, { useState } from 'react';

interface AuthModalProps {
  onClose: () => void;
  onLogin: (email: string, token: string, user: { id: string; name: string; credits: number }) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setIsLoading(true); setError('');
    try {
      const endpoint = isSignUp ? '/api/register' : '/api/login';
      const body: any = { email, password };
      if (isSignUp && name.trim()) body.name = name.trim();
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      onLogin(data.user.email, data.token, { id: data.user.id.toString(), name: data.user.name, credits: data.user.credits });
    } catch { setError('Cannot connect to server. Make sure the backend is running on port 3001.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
      <div className="relative bg-white dark:bg-stone-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-stone-100 dark:border-stone-800 animate-scale-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all">✕</button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 gold-btn rounded-xl flex items-center justify-center shadow-md">
            <span className="font-display text-white font-bold text-base">D</span>
          </div>
          <div>
            <span className="text-lg font-display font-bold text-stone-900 dark:text-white">Designora</span>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-widest uppercase">AI Studio</p>
          </div>
        </div>

        <h2 className="text-2xl font-display font-bold text-stone-900 dark:text-white mb-1">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{isSignUp ? 'Sign up and get 10 free AI design credits.' : 'Log in to your design studio.'}</p>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">Display Name (optional)</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Your name"
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors placeholder:text-stone-300 dark:placeholder:text-stone-600"/>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="you@example.com"
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors placeholder:text-stone-300 dark:placeholder:text-stone-600"/>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="••••••••"
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors placeholder:text-stone-300 dark:placeholder:text-stone-600"/>
          </div>
          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full gold-btn font-bold text-sm py-4 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </span>
            ) : (isSignUp ? '✦ Create Account' : '✦ Sign In')}
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm text-stone-400">{isSignUp ? 'Already have an account? ' : "Don't have an account? "}</span>
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-sm font-bold text-amber-600 dark:text-amber-400 hover:underline">
            {isSignUp ? 'Sign In' : 'Sign Up Free'}
          </button>
        </div>
        <p className="text-center text-xs text-stone-300 dark:text-stone-700 mt-4">🔒 Passwords secured with bcrypt</p>
      </div>
    </div>
  );
};

export default AuthModal;
