import React, { useState } from 'react';
import Navbar from './components/Navbar';
import BorrowerForm from './components/BorrowerForm';
import AiChatAgent from './components/AiChatAgent';
import AdminDashboard from './components/AdminDashboard';
import { ShieldCheck, HelpCircle, Bot, Coins } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('borrower');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'borrower' && <BorrowerForm />}
        {activeTab === 'agent' && <AiChatAgent />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Floating Action Button for AI Assist if in borrower or admin tab */}
      {activeTab !== 'agent' && (
        <button
          onClick={() => setActiveTab('agent')}
          className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 px-4 py-3 rounded-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white font-bold text-xs sm:text-sm shadow-xl shadow-amber-600/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Bot className="w-5 h-5 text-white animate-bounce" />
          <span>Ask AI Assistant</span>
        </button>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict RBI Compliance: Capped at 75% LTV · Exact Rupee Floor Rounding</span>
          </div>

          <div className="flex items-center space-x-4">
            <span>T Global Full Stack Technical Assignment</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-700 font-medium">Node.js + Express + React + MongoDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
