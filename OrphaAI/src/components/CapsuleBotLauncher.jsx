import React, { useState, useEffect } from 'react';

export default function CapsuleBotLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  // Sync state if HelloTars widget is closed externally (e.g. from iframe close button)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data === 'closeWidgetFromNewlook' || event.data === 'close_widget') {
        setIsOpen(false);
      }
    };
    window.addEventListener('message', handleMessage);

    // MutationObserver to track when Tars modal opens or closes
    let observer;
    const tarsWidget = document.getElementById('tars-cb-widget');
    if (tarsWidget) {
      observer = new MutationObserver(() => {
        const isWidgetVisible = tarsWidget.classList.contains('show') || tarsWidget.style.display === 'block';
        setIsOpen(isWidgetVisible);
      });
      observer.observe(tarsWidget, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (observer) observer.disconnect();
    };
  }, []);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    // Trigger HelloTars widget programmatically
    try {
      if (window.tars) {
        if (nextState) {
          if (typeof window.tars.open === 'function') {
            window.tars.open();
          } else if (typeof window.tars.show === 'function') {
            window.tars.show();
          }
        } else {
          if (typeof window.tars.close === 'function') {
            window.tars.close();
          } else if (typeof window.tars.hide === 'function') {
            window.tars.hide();
          }
        }
      } else {
        // Fallback DOM event click
        const tarsTrigger = document.querySelector('#tars-widget-fab button, #tars-widget-fab, .convbot-button');
        if (tarsTrigger) {
          tarsTrigger.click();
        }
      }
    } catch (e) {
      console.warn("HelloTars trigger fallback", e);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[999999] select-none animate-capsule-float">
      {/* Circular Glass Pedestal (Base Container) */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Open AI Research Copilot"
        title="Open AI Research Copilot"
        className="w-16 h-16 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 shadow-[0_12px_28px_rgba(0,0,0,0.5)] flex items-center justify-center relative group cursor-pointer transition-all duration-300 hover:scale-110 hover:border-emerald-400/40 active:scale-95 focus:outline-none"
      >
        {/* Soft Radial Glow */}
        <div className="absolute inset-0 rounded-full bg-emerald-500/15 blur-lg group-hover:bg-emerald-400/25 transition-all pointer-events-none" />

        {/* Live "AI Active" Status Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-20">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900" />
        </span>

        {/* Hover Tooltip Pill */}
        <div className="absolute right-20 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg flex items-center gap-1.5 z-30">
          <span>💊</span>
          <span>OrphaAI Copilot</span>
        </div>

        {/* Rotated Capsule Container (-35deg tilt) */}
        <div className="relative -rotate-[35deg] flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
          {/* Left / Bottom Half: Glossy Medical White */}
          <div
            className={`w-7 h-7 bg-gradient-to-b from-white via-slate-100 to-slate-200 rounded-l-full border border-slate-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)] transition-all duration-400 ease-out origin-right relative ${
              isOpen
                ? '-translate-x-3.5 translate-y-2.5 -rotate-12 opacity-85 shadow-md'
                : 'group-hover:-translate-x-0.5'
            }`}
          >
            {/* Top Gloss Reflection */}
            <div className="w-4 h-1.5 bg-white/95 rounded-full ml-1.5 mt-1 blur-[0.5px]" />
          </div>

          {/* Right / Top Half: Glossy Ruby Red Cap */}
          <div
            className={`w-8 h-7 bg-gradient-to-b from-red-500 via-red-600 to-red-800 rounded-r-full border border-red-400/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-400 ease-out origin-left relative ${
              isOpen
                ? 'translate-x-3.5 -translate-y-2.5 rotate-12 opacity-85 shadow-md'
                : 'group-hover:translate-x-0.5'
            }`}
          >
            {/* Top Gloss Reflection */}
            <div className="w-5 h-1.5 bg-white/45 rounded-full ml-1 mt-1 blur-[0.5px]" />
          </div>

          {/* Particle / Energy Burst at Seam when Opening */}
          {isOpen && (
            <div className="absolute w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping pointer-events-none" />
          )}
        </div>
      </button>
    </div>
  );
}
