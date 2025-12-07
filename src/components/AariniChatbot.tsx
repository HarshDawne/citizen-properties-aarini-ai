import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';
import { MessageSquare, Minimize2, Send, ChevronRight, Bot, AlertCircle } from 'lucide-react';

// --- CONFIGURATION ---
const RATE_LIMIT_WINDOW_MS = 60000; // 1 Minute window
const RATE_LIMIT_MAX_REQUESTS = 8;  // Max 8 messages per minute

/**
 * Parses markdown-like syntax for Bold (**text**), Bullet points (- or *), and Numbered lists (1.).
 * Moved outside component to avoid re-creation.
 */
const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    
    // Parse Bold: **text**
    const parseBold = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      });
    };

    // 1. Handle Bullet Points (starts with - or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} className="flex items-start gap-2 ml-2 mb-1">
          <span className="text-blue-500 mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 block" />
          <p className="text-slate-700 leading-relaxed text-[15px]">{parseBold(trimmed.substring(2))}</p>
        </div>
      );
    }

    // 2. Handle Numbered Lists (starts with 1., 2., etc)
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberMatch) {
      return (
        <div key={i} className="flex items-start gap-2 ml-2 mb-2">
          <span className="font-bold text-blue-600 min-w-[1.2rem]">{numberMatch[1]}.</span>
          <p className="text-slate-700 leading-relaxed text-[15px]">{parseBold(numberMatch[2])}</p>
        </div>
      );
    }

    // 3. Handle Empty Lines (spacing)
    if (trimmed === '') {
      return <div key={i} className="h-2" />;
    }

    // 4. Regular Paragraph
    return (
      <p key={i} className="mb-1 text-slate-700 leading-relaxed text-[15px]">
        {parseBold(line)}
      </p>
    );
  });
};

/**
 * Helper to parse text vs suggestions.
 * Robust against streaming partial tags.
 */
const parseMessageContent = (text: string) => {
  // 1. Hide the raw suggestion block from the main text immediately
  // Matches <SUGGESTIONS> and everything after it (even if incomplete/streaming)
  const cleanText = text.replace(/<SUGGESTIONS>[\s\S]*/, '').trim();

  // 2. Extract JSON only if the block is complete
  const suggestionBlockMatch = text.match(/<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>/);
  let suggestions: string[] = [];

  if (suggestionBlockMatch && suggestionBlockMatch[1]) {
    try {
      suggestions = JSON.parse(suggestionBlockMatch[1]);
    } catch (e) {
      // JSON might be incomplete during stream; ignore until complete
    }
  }

  return { cleanText, suggestions };
};

/**
 * Memoized Message Item to prevent re-rendering entire list on every token stream.
 */
const ChatMessageItem = React.memo(({ msg, onSuggestionClick }: { msg: Message, onSuggestionClick: (text: string) => void }) => {
  const isUser = msg.role === 'user';
  // Memoize parsing to avoid regex cost on every render of the list item
  const { cleanText, suggestions } = useMemo(() => parseMessageContent(msg.text), [msg.text]);

  return (
    <div 
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-200`}
    >
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`
            relative p-3.5 rounded-2xl shadow-sm text-[15px]
            ${isUser 
              ? 'bg-blue-600 text-white rounded-br-sm' 
              : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
            }
          `}
        >
          <div className={`${isUser ? 'text-white' : ''}`}>
            {isUser ? cleanText : renderFormattedText(cleanText)}
          </div>
        </div>

        {/* Suggestion Chips (Only for model) */}
        {!isUser && suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2 duration-300 delay-75">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick(suggestion)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100 transition-all hover:shadow-md hover:border-blue-200 active:scale-95 group"
              >
                {suggestion}
                <ChevronRight className="w-3 h-3 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className={`text-[10px] mt-1 px-1 ${isUser ? 'text-slate-300' : 'text-slate-400'}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

const AariniChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hi! I'm **Aarini**. How can I help you find your dream home in Mumbai or Thane today?\n\n<SUGGESTIONS>\n[\"Show listings in Bandra\", \"Budget 1 BHKs?\", \"Rentals under ₹50k\"]\n</SUGGESTIONS>",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  
  // isTyping = Input locked (Generating total)
  // isWaitingForResponse = Waiting for first token (Show visual loader)
  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  
  // Rate Limiting Ref (Timestamps of user requests)
  const requestHistoryRef = useRef<number[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize Chat Logic
  useEffect(() => {
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          // Optimized model for low latency
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });
      } else {
        console.warn("REACT_APP_GEMINI_API_KEY is missing. Please set it in .env.local");
      }
    } catch (error) {
      console.error("Failed to initialize Gemini chat:", error);
    }
  }, []);

  // Optimized Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      // Use 'auto' (instant) scroll during active typing/streaming to prevent visual lag
      // Use 'smooth' scroll for initial opens or manual user messages
      const behavior = isTyping ? 'auto' : 'smooth';
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatSessionRef.current) return;

    // --- RATE LIMIT CHECK ---
    const now = Date.now();
    // Filter timestamps that are within the active window (last 60s)
    requestHistoryRef.current = requestHistoryRef.current.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    
    if (requestHistoryRef.current.length >= RATE_LIMIT_MAX_REQUESTS) {
       // Display local warning message without calling API
       const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - requestHistoryRef.current[0])) / 1000);
       
       setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'user',
          text: text,
          timestamp: new Date(),
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `⚠️ **Rate Limit Alert**\n\nTo ensure quality service, we limit rapid messages. Please wait about **${waitSeconds} seconds** before asking again.`,
          timestamp: new Date(),
        }
      ]);
      setInputText('');
      return;
    }
    
    // Log valid request
    requestHistoryRef.current.push(now);
    // --- END RATE LIMIT CHECK ---

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setIsWaitingForResponse(true); // Start showing loader

    try {
      const result = await chatSessionRef.current.sendMessageStream({
        message: text,
      });

      const responseMsgId = (Date.now() + 1).toString();
      let fullResponseText = '';

      // Initialize empty model message
      setMessages((prev) => [
        ...prev,
        {
          id: responseMsgId,
          role: 'model',
          text: '',
          timestamp: new Date(),
        },
      ]);

      for await (const chunk of result) {
        const chunkText = (chunk as GenerateContentResponse).text;
        if (chunkText) {
          // Hide loader as soon as we get the first chunk of data
          setIsWaitingForResponse(false);
          
          fullResponseText += chunkText;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseMsgId
                ? { ...msg, text: fullResponseText }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: "I'm having trouble connecting to the server. Please check your internet connection.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      setIsWaitingForResponse(false);
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div 
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out transform ${isOpen ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'}`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-full shadow-[0_8px_30px_rgb(59,130,246,0.3)] hover:shadow-[0_8px_35px_rgb(59,130,246,0.4)] hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label="Open chat"
        >
          <MessageSquare className="w-7 h-7 fill-current" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
          </span>
        </button>
      </div>

      {/* Main Chat Window */}
      <div
        className={`
          fixed z-50 transition-all duration-300 cubic-bezier(0.19, 1, 0.22, 1)
          ${isOpen 
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 scale-95 translate-y-12 pointer-events-none'
          }
          /* Layout */
          bottom-0 right-0 sm:bottom-6 sm:right-6
          
          /* Fixed Sizing on Desktop (Compact) */
          w-full h-full sm:w-[400px] sm:h-[550px] sm:rounded-3xl
          
          /* Styling */
          bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-slate-100
        `}
      >
        {/* Header - Light Blue Gradient */}
        <div 
          className="relative bg-gradient-to-r from-blue-500 to-cyan-400 p-5 shrink-0 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-inner">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white leading-tight tracking-wide">Aarini</h2>
              <p className="text-blue-50 text-xs font-medium opacity-95">Real Estate Assistant</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-slate-50/50 scroll-smooth">
          {messages.map((msg) => (
            <ChatMessageItem 
              key={msg.id} 
              msg={msg} 
              onSuggestionClick={handleSendMessage} 
            />
          ))}
          
          {/* Loading Indicator - Only shows when waiting for FIRST token */}
          {isWaitingForResponse && (
            <div className="flex justify-start w-full animate-in fade-in duration-200">
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                </div>
                <span className="text-xs text-slate-400 font-medium">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form 
            onSubmit={handleFormSubmit}
            className="group flex items-center gap-2 bg-slate-50 p-1.5 pr-2 rounded-full border border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all duration-200 shadow-inner"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent px-4 py-2.5 outline-none text-[15px] text-slate-800 placeholder:text-slate-400"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className={`
                h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center
                ${inputText.trim() && !isTyping
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-110' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-2.5">
            <p className="text-[10px] text-slate-300 font-medium tracking-wide uppercase">AI Powered</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AariniChatbot;