import React, { useState } from 'react';
import { User, AppView } from '../types';

interface NavbarProps {
  user: User | null; onLogout: () => void; onLoginClick: () => void;
  onNavigate: (view: AppView) => void; currentView: AppView;
  isDarkMode: boolean; onToggleTheme: () => void;
}

const NAV_LINKS: { label: string; view: AppView }[] = [
  { label: 'Home', view: 'landing' },
  { label: 'Studio', view: 'dashboard' },
  { label: 'History', view: 'history' },
  { label: 'Pricing', view: 'pricing' },
];

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onLoginClick, onNavigate, currentView, isDarkMode, onToggleTheme }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = (v: AppView) => { onNavigate(v); setMobileOpen(false); };

  return (
    <nav className="glass dark:bg-stone-950/90 sticky top-0 z-50 border-b border-stone-200/60 dark:border-stone-800/60 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => nav('landing')} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 gold-btn rounded-xl flex items-center justify-center shadow-md">
            <span className="font-display text-white font-bold text-base">D</span>
          </div>
          <div className="text-left">
            <span className="text-lg font-display font-bold text-stone-900 dark:text-white tracking-wide leading-none block">Designora</span>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tracking-widest uppercase">AI Studio</span>
          </div>
        </button>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, view }) => (
            <button key={view} onClick={() => nav(view)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentView === view
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button onClick={onToggleTheme} className="p-2.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-white transition-colors">
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.59m-1.591-6.364H3m3.386-4.773l1.59-1.591M12 6.75a5.25 5.25 0 110 10.5 5.25 5.25 0 010-10.5z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
            )}
          </button>

          {user ? (
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl">
                <div className="w-7 h-7 gold-btn rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-white leading-none">{user.name}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{user.credits} credits</p>
                </div>
              </div>
              <button onClick={onLogout} className="text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white border border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 px-3 py-2 rounded-xl transition-all">
                Sign Out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={onLoginClick} className="text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white px-3 py-2 transition-colors">Log In</button>
              <button onClick={onLoginClick} className="text-sm font-bold gold-btn px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">Get Started</button>
            </div>
          )}

          <button className="md:hidden p-2.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm px-4 py-4 flex flex-col gap-1 animate-slide-down">
          {NAV_LINKS.map(({ label, view }) => (
            <button key={view} onClick={() => nav(view)}
              className={`text-sm font-semibold text-left py-3 px-4 rounded-xl transition-colors ${
                currentView === view ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}>
              {label}
            </button>
          ))}
          <div className="border-t border-stone-100 dark:border-stone-800 mt-2 pt-3">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="w-8 h-8 gold-btn rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{user.credits} credits</p>
                  </div>
                </div>
                <button onClick={() => { onLogout(); setMobileOpen(false); }} className="w-full text-left text-sm font-semibold text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 px-4 py-2.5 rounded-xl hover:text-stone-900 dark:hover:text-white transition-all">Sign Out</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => { onLoginClick(); setMobileOpen(false); }} className="w-full text-left text-sm font-semibold text-stone-600 dark:text-stone-400 px-4 py-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">Log In</button>
                <button onClick={() => { onLoginClick(); setMobileOpen(false); }} className="w-full text-left text-sm font-bold gold-btn px-4 py-3 rounded-xl">Get Started Free →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
