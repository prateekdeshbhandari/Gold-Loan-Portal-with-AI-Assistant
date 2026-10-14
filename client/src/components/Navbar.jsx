import React from 'react';
import { Coins, Sparkles, ShieldCheck, UserCheck, Bot } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('borrower')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">SwarnaLoan</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Instant Gold Valuation & Digital Lending</p>
            </div>
          </div>

          {/* Market Ticker Pill */}
          <div className="hidden md:flex items-center space-x-3 bg-amber-50/80 border border-amber-200/80 rounded-full px-3.5 py-1 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">Mock 24K Rate:</span>
            <span className="font-bold text-amber-900 font-mono">₹7,000 / g</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">RBI Max LTV:</span>
            <span className="font-bold text-slate-900">75%</span>
          </div>

          {/* Navigation Switcher Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('borrower')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'borrower'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Apply</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'agent'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bot className="w-4 h-4 text-amber-500 group-hover:text-amber-600" />
              <span>AI Assist</span>
              <span className="hidden sm:inline-block text-[10px] bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                Agent
              </span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Field Agent</span>
              <span>Admin</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
