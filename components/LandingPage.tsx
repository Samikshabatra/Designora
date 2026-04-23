import React from 'react';

interface LandingPageProps { onGetStarted: () => void; }

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const features = [
    { icon: '🏠', title: 'AI Room Redesign', desc: 'Upload any room photo and watch FLUX AI reimagine it in any style — Modern, Scandi, Luxury, and more.' },
    { icon: '✦', title: 'Two Variants at Once', desc: 'Get two unique design variants per generation. Daylight and evening moods for the perfect pick.' },
    { icon: '🖌', title: 'Area Inpainting', desc: 'Paint over any part of your design and AI will redesign only that section — pixel-perfect control.' },
    { icon: '↔', title: 'Before & After Slider', desc: 'Drag to compare your original room against the AI redesign with a smooth interactive slider.' },
    { icon: '₹', title: 'Smart Budget Planner', desc: 'Get a detailed cost breakdown tailored to Indian market pricing — from ₹50K to ₹25L+.' },
    { icon: '🛒', title: 'Shop the Look', desc: 'Every item in your design links directly to Amazon, Flipkart, and IKEA with filtered price ranges.' },
    { icon: '📐', title: 'Room Dimensions', desc: 'Enter your room\'s exact dimensions and get furniture recommendations sized perfectly for your space.' },
    { icon: '📄', title: 'PDF Design Brief', desc: 'Export a polished PDF with your design, budget breakdown, and product list — ready to share.' },
    { icon: '⭐', title: 'Rate & Save', desc: 'Star-rate your favourite designs and keep a full history of all your AI creations.' },
  ];

  const styles = ['Modern', 'Scandinavian', 'Industrial', 'Bohemian', 'Luxury', 'Farmhouse', 'Art Deco', 'Japandi'];

  return (
    <div className="overflow-hidden">
      {/* ── HERO ── */}
      <section className="relative bg-stone-50 dark:bg-stone-950 pt-20 pb-28 px-6 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style={{background:'radial-gradient(circle,#d4a853,transparent 70%)'}}/>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10" style={{background:'radial-gradient(circle,#d4a853,transparent 70%)'}}/>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5" style={{background:'radial-gradient(circle,#d4a853,transparent 60%)'}}/>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-4 py-2 rounded-full mb-8 tracking-widest animate-fade-up">
            <span>✦</span><span>POWERED BY FLUX AI & REPLICATE</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-stone-900 dark:text-white leading-tight mb-6 animate-fade-up" style={{animationDelay:'0.1s'}}>
            Transform Any Room<br />
            <span className="gold-text italic">Into Luxury.</span>
          </h1>

          <p className="text-lg text-stone-500 dark:text-stone-400 font-medium max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up" style={{animationDelay:'0.2s'}}>
            Upload your room photo or describe your vision. <strong className="text-stone-700 dark:text-stone-300">Designora</strong> transforms it into a stunning professional interior — with budgeting, shopping links, and PDF export.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{animationDelay:'0.3s'}}>
            <button onClick={onGetStarted} className="gold-btn font-bold text-base px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              Start Designing Free →
            </button>
            <button onClick={onGetStarted} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-white font-bold text-base px-8 py-4 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-500 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg">
              View Examples
            </button>
          </div>
          <p className="text-sm text-stone-400 font-medium mt-5 animate-fade-up" style={{animationDelay:'0.4s'}}>10 free credits on signup · No credit card required</p>

          {/* Style pills */}
          <div className="mt-14 flex flex-wrap gap-2.5 justify-center animate-fade-up" style={{animationDelay:'0.5s'}}>
            {styles.map((s, i) => (
              <div key={s} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold px-4 py-2 rounded-full hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400 transition-all cursor-default" style={{animationDelay:`${0.5 + i*0.05}s`}}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-14 px-6 border-y border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['FLUX AI', 'Model'], ['8', 'Design Styles'], ['₹50K–₹25L+', 'Budget Range'], ['3', 'Shopping Sites']].map(([val, label]) => (
            <div key={label}>
              <p className="text-2xl font-display font-bold gold-text">{val}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-6 bg-stone-50 dark:bg-stone-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase mb-3">Everything Included</p>
            <h2 className="text-4xl font-display font-bold text-stone-900 dark:text-white tracking-tight mb-4">A Complete Design Studio</h2>
            <p className="text-stone-500 dark:text-stone-400 font-medium max-w-xl mx-auto">From AI generation to PDF export — everything you need to design, budget, and shop your perfect room.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-100 dark:border-stone-800 card-hover group cursor-default">
                <div className="w-11 h-11 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-xl mb-5 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-white dark:bg-stone-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase mb-3">Simple Process</p>
          <h2 className="text-4xl font-display font-bold text-stone-900 dark:text-white tracking-tight mb-16">Three Steps to Your Dream Room</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Upload or Describe', desc: 'Take a photo of your room or describe what you want to create from scratch.' },
              { step: '02', title: 'Choose Style & Budget', desc: 'Pick from 8 design aesthetics and set your budget. Add room dimensions for precision.' },
              { step: '03', title: 'Get Your Design', desc: 'Receive 2 photorealistic variants, full budget breakdown, shopping links, and a PDF brief.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative group p-7 rounded-2xl bg-stone-50 dark:bg-stone-800 hover:bg-white dark:hover:bg-stone-750 border border-stone-100 dark:border-stone-700 hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-default">
                <div className="text-6xl font-display font-bold gold-text mb-4 leading-none opacity-30 group-hover:opacity-60 transition-opacity">{step}</div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">{title}</h3>
                <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 relative overflow-hidden" style={{background:'linear-gradient(135deg,#1a0e00,#2d1a00,#1a0e00)'}}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20" style={{background:'radial-gradient(circle,#d4a853,transparent 70%)'}}/>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-15" style={{background:'radial-gradient(circle,#f0cc7a,transparent 70%)'}}/>
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 border border-amber-700/50 bg-amber-900/20 text-amber-400 text-xs font-bold px-4 py-2 rounded-full mb-8 tracking-widest">
            <span>✦</span><span>START FOR FREE TODAY</span>
          </div>
          <h2 className="text-5xl sm:text-6xl font-display font-bold text-white tracking-tight leading-tight mb-6">
            Your Dream Room<br /><span className="gold-text">Starts Here.</span>
          </h2>
          <p className="text-stone-400 font-medium mb-10 text-lg leading-relaxed">No credit card. No design experience needed.<br />Just your vision and 3 minutes.</p>
          <button onClick={onGetStarted} className="gold-btn font-bold text-base px-10 py-5 rounded-2xl shadow-2xl hover:-translate-y-1 hover:shadow-amber-900/50 transition-all duration-300">
            Start Designing Free →
          </button>
          <p className="text-stone-600 text-sm font-medium mt-6">10 free credits on signup · No credit card required</p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
