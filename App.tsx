import React, { useState, useEffect } from 'react';
import { User, AppView } from './types';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Pricing from './components/Pricing';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import HistoryPage from './components/HistoryPage';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [editingDesign, setEditingDesign] = useState<any>(null);

  useEffect(() => {
    localStorage.removeItem('decoryx_user');
    const token = localStorage.getItem('designora_token') || localStorage.getItem('decoryx_token');
    if (token) {
      fetch(`${API_BASE}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            setUser({ id: data.user.id.toString(), email: data.user.email, name: data.user.name, isLoggedIn: true, credits: data.user.credits, token });
          } else {
            localStorage.removeItem('designora_token');
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingAuth(false));
    } else {
      setIsLoadingAuth(false);
    }
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  const handleLogin = (email: string, token: string, userData: { id: string; name: string; credits: number }) => {
    const newUser: User = { id: userData.id, email, name: userData.name, isLoggedIn: true, credits: userData.credits, token };
    setUser(newUser);
    localStorage.setItem('designora_token', token);
    setIsAuthModalOpen(false);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('designora_token');
    localStorage.removeItem('decoryx_token');
    setView('landing');
  };

  const navigateTo = (newView: AppView) => {
    if (['dashboard', 'history'].includes(newView) && !user) { setIsAuthModalOpen(true); return; }
    setView(newView);
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gold-btn flex items-center justify-center">
            <span className="font-display text-white font-bold text-lg">D</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm font-semibold text-stone-500">Loading Designora...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} onLoginClick={() => setIsAuthModalOpen(true)} onNavigate={navigateTo} currentView={view} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />
      <main className="flex-grow">
        {view === 'landing' && <LandingPage onGetStarted={() => navigateTo('dashboard')} />}
        {view === 'dashboard' && user && <Dashboard user={user} setUser={setUser} editingDesign={editingDesign} onClearEditing={() => setEditingDesign(null)} />}
        {view === 'pricing' && <Pricing onSelectPlan={() => navigateTo('dashboard')} user={user} setUser={setUser} onLoginClick={() => setIsAuthModalOpen(true)} />}
        {view === 'history' && user && <HistoryPage user={user} onOpenDesign={(design) => { setEditingDesign(design); setView('dashboard'); }} />}
      </main>

      <footer className="bg-stone-900 dark:bg-black border-t border-stone-800 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gold-btn rounded-xl flex items-center justify-center">
              <span className="font-display text-white font-bold text-lg">D</span>
            </div>
            <div>
              <span className="text-xl font-display font-bold text-white tracking-wide">Designora</span>
              <p className="text-xs text-stone-500 mt-0.5">AI Interior Design Studio</p>
            </div>
          </div>
          <div className="flex gap-8 text-sm font-medium text-stone-500">
            <a href="#" className="hover:text-amber-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Support</a>
          </div>
          <p className="text-stone-600 text-xs">© 2025 Designora. Powered by Replicate AI.</p>
        </div>
      </footer>

      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onLogin={handleLogin} />}
    </div>
  );
};

export default App;
