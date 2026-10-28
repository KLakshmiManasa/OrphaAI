import React, { useState } from 'react';
import { X, Bot } from 'lucide-react';

export default function CapsuleBotLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 1. Chatbot Modal Container */}
      {isOpen && (
        <div className="fixed inset-0 z-[999998] flex items-end sm:items-end justify-end p-2 sm:p-6 pointer-events-none">
          <div className="relative w-full sm:w-[400px] h-[82vh] sm:h-[620px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col pointer-events-auto animate-in fade-in slide-in-from-bottom-6 duration-200">
            
            {/* Modal Header */}
            <div className="h-12 bg-slate-900 px-4 flex items-center justify-between text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-sm tracking-wide">OrphaAI Copilot</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors"
                aria-label="Close Assistant"
              >
                <X className="w-5 h-5 text-slate-300 hover:text-white" />
              </button>
            </div>

            {/* HelloTars Iframe — header clipped via negative margin-top */}
            <div className="flex-1 w-full overflow-hidden relative">
              <iframe
                src="https://chatbot.hellotars.com/conv/s_oIBs"
                title="OrphaAI Copilot"
                className="w-full border-0 bg-white"
                style={{ marginTop: '-50px', height: 'calc(100% + 50px)' }}
                allow="microphone; camera; clipboard-read; clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Floating Splitting Capsule Action Button */}
      <div className="fixed bottom-6 right-6 z-[999999] select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle AI Assistant"
          className="relative w-14 h-14 flex items-center justify-center cursor-pointer focus:outline-none transition-transform hover:scale-105 active:scale-95 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
        >
          {/* Capsule Pill Rotated -45deg */}
          <div className="relative -rotate-45 flex items-center justify-center">
            {/* White Half */}
            <div
              className={`w-6 h-6 bg-gradient-to-b from-white via-slate-100 to-slate-200 rounded-l-full border border-slate-300 shadow-inner transition-transform duration-300 ease-out origin-right ${
                isOpen ? '-translate-x-2.5 -translate-y-1.5 -rotate-12' : ''
              }`}
            />
            {/* Red Half */}
            <div
              className={`w-6 h-6 bg-gradient-to-b from-red-500 via-red-600 to-red-700 rounded-r-full border border-red-600 shadow-inner transition-transform duration-300 ease-out origin-left ${
                isOpen ? 'translate-x-2.5 translate-y-1.5 rotate-12' : ''
              }`}
            />
          </div>
        </button>
      </div>
    </>
  );
}
