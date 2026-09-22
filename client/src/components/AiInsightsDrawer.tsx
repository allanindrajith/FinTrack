import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { User, Transaction, CashFlowSummary } from '../types.js';

interface AiInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  transactions: Transaction[];
  summary: CashFlowSummary;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  isByoKey?: boolean;
}

export const AiInsightsDrawer: React.FC<AiInsightsDrawerProps> = ({
  isOpen,
  onClose,
  user,
  transactions,
  summary,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        `Hello ${user.name || 'there'}! I'm your FinTrack AI assistant. Ask me questions like "How much did I spend on dining?", "Detect any unusual charges", or tap one of the suggested prompts below.`,
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Prepare a concise, anonymized context summary to pass along with queries (running locally)
  const buildContextSummary = (): string => {
    const recentTx = transactions.slice(0, 40).map((t) => ({
      date: t.date,
      category: t.category_name || 'Uncategorized',
      type: t.type,
      amount: t.amount,
      desc: t.description,
    }));

    return JSON.stringify({
      currency: user.currency || 'USD',
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      netSavings: summary.netSavings,
      savingsRate: `${summary.savingsRate}%`,
      transactionCount: transactions.length,
      sampleTransactions: recentTx,
    });
  };

  const handleSend = async (promptToSend?: string) => {
    const prompt = (promptToSend || inputPrompt).trim();
    if (!prompt || loading) return;

    if (!user.ai_consent) {
      setErrorMsg('AI Insights is currently turned off. Please enable AI consent in FinTrack Settings.');
      return;
    }

    setErrorMsg('');
    setInputPrompt('');
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const contextSummary = buildContextSummary();
      const res = await api.queryAi(prompt, contextSummary);
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: res.answer,
          provider: res.provider,
          isByoKey: res.isByoKey,
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to get AI response.');
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: 'Summarize spending', text: 'Give me a brief summary of my spending habits this period.' },
    { label: 'Food & Dining total', text: 'How much did I spend on Groceries and Dining combined?' },
    { label: 'Subscriptions audit', text: 'What recurring subscriptions or streaming charges do I have?' },
    { label: 'Cut $200 expenses', text: 'Where can I realistically cut back to save $200 this month?' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0e0f0c]/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#e8ebe6] shadow-modal flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#e8ebe6] flex items-center justify-between bg-[#f8faf7]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-[900] text-[#0e0f0c] tracking-tight">AI Financial Assistant</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8ebe6] text-[#0e0f0c]">
                    {user.ai_provider === 'openai' ? 'GPT-4o' : user.ai_provider === 'anthropic' ? 'Claude 3.5' : 'Gemini 1.5 Flash'}
                  </span>
                </div>
                <p className="text-xs text-[#5f655b]">Natural-language budgeting & spending Q&A</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="p-2 text-[#5f655b] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Privacy Note */}
          <div className="px-6 py-2.5 bg-[#e8ebe6]/40 border-b border-[#e8ebe6] flex items-center justify-between text-[11px] text-[#5f655b]">
            <div className="flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-[#0e0f0c]" />
              <span>Zero-knowledge client context dispatch</span>
            </div>
            <span className="font-semibold text-[#0e0f0c]">
              {user.has_byo_key ? 'BYO Key Active' : 'Shared App Quota'}
            </span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c] flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-[18px] px-4 py-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0e0f0c] text-white font-medium rounded-tr-none'
                      : 'bg-[#f4f6f2] text-[#0e0f0c] border border-[#e8ebe6] rounded-tl-none font-normal space-y-2'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.provider && (
                    <div className="pt-1 text-[10px] text-[#7c8378] flex items-center gap-2 border-t border-[#e8ebe6]/60">
                      <span>Powered by {msg.provider.toUpperCase()}</span>
                      {msg.isByoKey && <span>• BYO API Key</span>}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-[#e8ebe6] flex items-center justify-center text-[#0e0f0c] flex-shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-7 h-7 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-[#f4f6f2] border border-[#e8ebe6] rounded-[18px] px-4 py-2.5 text-xs text-[#5f655b] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#9fe870] animate-pulse" />
                  <span>Analyzing financial records...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-[#fce8e8] border border-[#d03238]/30 rounded-xl text-xs text-[#a72027] font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          <div className="p-3 border-t border-[#e8ebe6] bg-[#f8faf7] flex items-center gap-2 overflow-x-auto">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.text)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-[#e8ebe6] hover:border-[#0e0f0c] text-[#0e0f0c] text-[11px] font-bold rounded-full whitespace-nowrap shadow-xs transition-all active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-[#e8ebe6] bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask about spending, budgets, categories..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#e8ebe6] rounded-full text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] border border-transparent focus:outline-none focus:border-[#0e0f0c]"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-2.5 bg-[#9fe870] hover:bg-[#cdffad] disabled:opacity-50 text-[#0e0f0c] rounded-full transition-all flex items-center justify-center active:scale-95"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
