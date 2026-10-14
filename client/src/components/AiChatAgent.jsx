import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  Wrench,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/apiClient';

export default function AiChatAgent() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '👋 Hello! I am **GoldAssist**, your AI Loan Assistant.\n\nI can calculate your eligible gold loan amount in real-time and help submit your application.\n\nYou can ask me: *"I have 45 grams of 22 carat jewellery, how much loan can I get?"*',
      toolCalls: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [sessionState, setSessionState] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTool, loading]);

  const handleSend = async (customText) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', content: textToSend.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Call backend AI agent endpoint
      const res = await api.sendMessage({
        messages: updatedMessages,
        sessionState
      });

      if (res.data?.toolCalls && res.data.toolCalls.length > 0) {
        // Flash tool chips
        for (const tc of res.data.toolCalls) {
          setActiveTool(tc.tool);
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.reply,
          toolCalls: res.data.toolCalls || []
        }
      ]);

      if (res.data.sessionState) {
        setSessionState(res.data.sessionState);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue processing your request. Please try again or use the guided application form.',
          isError: true
        }
      ]);
    } finally {
      setActiveTool(null);
      setLoading(false);
    }
  };

  const samplePrompts = [
    'I have 45 grams of 22 carat jewellery, how much can I get?',
    'What loan schemes and interest rates do you offer?',
    'I have 10 grams of 18 carat gold jewellery.',
    'Should I invest in cryptocurrency?'
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 rounded-2xl p-6 text-white shadow-md mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold">GoldAssist AI Agent</h2>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/30 text-amber-100 border border-amber-300/40">
                Tool Calling Active
              </span>
            </div>
            <p className="text-xs text-amber-100 mt-0.5">
              Powered by server-side calculations & strict RBI compliance.
            </p>
          </div>
        </div>

        <div className="text-xs bg-white/10 backdrop-blur rounded-xl px-3 py-2 border border-white/20 self-stretch sm:self-auto">
          <span className="block font-semibold text-amber-100 uppercase tracking-wider text-[10px]">
            Strict Guardrails
          </span>
          <span className="font-mono text-white">No arithmetic in LLM · Explicit confirmation</span>
        </div>
      </div>

      {/* Chat Window Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[580px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              } animate-fadeIn`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-600" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-slate-50 text-slate-800 border border-slate-200'
                }`}
              >
                {/* Tool status chips for assistant */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-slate-200/80">
                    {msg.toolCalls.map((tc, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300/80"
                      >
                        <Wrench className="w-3 h-3 text-amber-700" />
                        <span>Tool: {tc.tool}()</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Markdown-style content parsing */}
                <div className="space-y-1.5 whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* If session state is ready for confirmation, show 1-click confirm button */}
                {msg.role === 'assistant' &&
                  sessionState.quoteCalculated &&
                  sessionState.fullName &&
                  sessionState.mobileNumber &&
                  !sessionState.submitted &&
                  idx === messages.length - 1 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <button
                        onClick={() => handleSend('Yes, confirm and submit my application.')}
                        disabled={loading}
                        className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Submit Application Now</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {/* Active Tool Chip Indicator */}
          {activeTool && (
            <div className="flex items-center space-x-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 w-fit animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>
                Executing backend tool:{' '}
                <strong>
                  {activeTool === 'calculate_quote'
                    ? 'POST /quotes (financial math)'
                    : activeTool === 'get_loan_schemes'
                    ? 'GET /loan-schemes'
                    : 'POST /leads (application submission)'}
                </strong>
              </span>
            </div>
          )}

          {/* Loading indicator */}
          {loading && !activeTool && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 w-fit">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-ping" />
              <span>GoldAssist is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Sample Prompts */}
        <div className="p-2 sm:p-3 bg-slate-50/80 border-t border-slate-200 overflow-x-auto flex items-center space-x-2 no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0 px-1">
            Try:
          </span>
          {samplePrompts.map((p, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="text-xs bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 rounded-lg px-2.5 py-1 whitespace-nowrap transition-all shadow-2xs flex-shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message, e.g. I have 45 grams of 22 carat gold..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 text-sm transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
