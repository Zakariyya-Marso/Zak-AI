
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatMessage, MessageRole, ChatSession } from '../types';
import { generateText, generateImage } from '../services/geminiService';
import { LiveSession } from './LiveSession';

interface ChatContainerProps {
  user: User;
  onLogout: () => void;
}

// Fixed global interface declaration to avoid modifier mismatch errors
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ user, onLogout }) => {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(user.chatHistory || []);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [isLive, setIsLive] = useState(false);
  
  const [mode, setMode] = useState<'restricted' | 'unrestricted'>('unrestricted');
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user.username.toLowerCase() === 'zaki';

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasKey(true);
    }
  };

  useEffect(() => {
    const updatedUser = { ...user, chatHistory };
    localStorage.setItem('zak_ai_user', JSON.stringify(updatedUser));
  }, [chatHistory, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const startNewChat = () => {
    if (messages.length > 0 && activeChatId) updateHistory();
    setActiveChatId(Date.now().toString());
    setMessages([]);
    setSelectedImage(null);
  };

  const updateHistory = () => {
    if (!activeChatId || messages.length === 0) return;
    setChatHistory(prev => {
      const existingIdx = prev.findIndex(c => c.id === activeChatId);
      const title = messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : '');
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], messages };
        return updated;
      }
      return [{ id: activeChatId, title, messages, timestamp: Date.now() }, ...prev];
    });
  };

  const loadChat = (chat: ChatSession) => {
    if (activeChatId && messages.length > 0) updateHistory();
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setShowSettings(false);
  };

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = { ...msg, id: Date.now().toString(), timestamp: Date.now() };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSelectedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const processCommand = async () => {
    if (!input.trim() && !selectedImage) return;
    if (!activeChatId) setActiveChatId(Date.now().toString());

    const currentInput = input;
    setInput('');
    setIsGenerating(true);

    try {
      if (currentInput.toLowerCase().startsWith('/gen ') || currentInput.toLowerCase().includes('generate image')) {
        const prompt = currentInput.replace('/gen ', '');
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text' });
        const imgUrl = await generateImage(prompt, imageSize, mode);
        addMessage({ role: MessageRole.ASSISTANT, content: `Synthesized for your ${mode} request.`, type: 'image', metadata: { imageUrl: imgUrl } });
      } else {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: selectedImage ? { imageUrl: selectedImage } : undefined });
        const { text, sources } = await generateText(currentInput, mode, useThinking, useSearch);
        addMessage({ role: MessageRole.ASSISTANT, content: text, type: 'text', metadata: { sources: sources.map((c: any) => c.web).filter(Boolean) } });
        setSelectedImage(null);
      }
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        addMessage({ role: MessageRole.ASSISTANT, content: "ERROR: API Key context lost. Re-authentication required.", type: 'text' });
      } else {
        addMessage({ role: MessageRole.ASSISTANT, content: `ERROR: ${err instanceof Error ? err.message : 'Anomaly detected.'}`, type: 'text' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-black text-red-600 font-sans selection:bg-red-600 selection:text-black">
      {isLive && <LiveSession mode={mode} onClose={() => setIsLive(false)} />}
      
      {!hasKey && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-black text-red-600 animate-pulse">CONNECTION_LOST</h2>
            <p className="text-red-900 font-mono text-sm">A paid Google Cloud API Key is required for LIVE mode on Vercel.</p>
            <button onClick={handleConnectKey} className="w-full py-4 bg-red-600 text-black font-black rounded-xl hover:bg-red-500 transition-colors">CONNECT_PROJECT</button>
            <p className="text-[10px] text-red-950 uppercase"><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Billing Documentation</a></p>
          </div>
        </div>
      )}

      <aside className={`glass border-r border-red-900/40 transition-all duration-500 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 -translate-x-full'}`}>
        <div className="p-6 border-b border-red-900/50 flex justify-between items-center bg-red-950/10">
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">ZAK-AI</span>
            <span className="text-[10px] font-bold text-red-900 uppercase tracking-widest mt-0.5">VERCEL_LIVE_READY</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-red-950 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-4">
          <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold text-sm border border-red-800 bg-red-900/10 text-red-600 hover:bg-red-600 hover:text-black">
            <span>NEW UPLINK</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {chatHistory.map((chat) => (
            <button key={chat.id} onClick={() => loadChat(chat)} className={`w-full text-left px-4 py-3 rounded-xl text-sm truncate ${activeChatId === chat.id ? 'bg-red-600/20 text-red-400 border-red-600' : 'text-red-900 border-transparent hover:bg-red-950/30'}`}>
              {chat.title || 'NULL_SIGNAL'}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-red-900/50 space-y-3">
          <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-950/40 text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-sm font-bold">TERMINAL_CONFIG</span>
          </button>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-red-950/40 border border-red-800">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${isOwner ? 'bg-yellow-500 text-black' : 'bg-red-600 text-black'}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate text-xs font-black text-white">{isOwner ? 'CREATOR_ZAKI' : user.username}</div>
            <button onClick={onLogout} className="p-2 text-red-900 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative h-full">
        <header className="p-4 glass border-b border-red-900/50 flex justify-between items-center z-20 bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-red-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" /></svg></button>}
            <div className={`px-3 py-1 text-[9px] font-black rounded-full border ${mode === 'unrestricted' ? 'border-red-600 bg-red-600/10 text-red-500 animate-pulse' : 'border-blue-600 bg-blue-600/10 text-blue-500'}`}>
              {mode.toUpperCase()}_MODE
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setIsLive(true)} className="px-3 py-1.5 rounded-xl border border-red-600 bg-red-600/20 text-[9px] font-black text-red-500 hover:bg-red-600 hover:text-black">LIVE_LINK</button>
             <button onClick={() => setUseThinking(!useThinking)} className={`px-3 py-1.5 rounded-xl border text-[9px] font-black ${useThinking ? 'border-red-500 text-red-500 bg-red-500/20' : 'border-red-950 text-red-950'}`}>THINK</button>
             <button onClick={() => setUseSearch(!useSearch)} className={`px-3 py-1.5 rounded-xl border text-[9px] font-black ${useSearch ? 'border-orange-600 text-orange-600 bg-orange-600/20' : 'border-red-950 text-red-950'}`}>SEARCH</button>
          </div>
        </header>

        {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/98 backdrop-blur-2xl p-4">
            <div className="glass w-full max-w-sm rounded-[3rem] p-10 space-y-8 border border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
              <h3 className="text-2xl font-black text-red-600 uppercase italic">Core Parameters</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-red-900 uppercase tracking-widest">Protocol Mode</span>
                  <div className="flex bg-black p-1 rounded-xl border border-red-900">
                    <button onClick={() => setMode('restricted')} className={`px-3 py-1 rounded-lg text-[10px] font-black ${mode === 'restricted' ? 'bg-blue-600 text-black' : 'text-blue-900'}`}>RESTRICTED</button>
                    <button onClick={() => setMode('unrestricted')} className={`px-3 py-1 rounded-lg text-[10px] font-black ${mode === 'unrestricted' ? 'bg-red-600 text-black' : 'text-red-900'}`}>UNRESTRICTED</button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-5 border-t border-red-900/30">
                  <span className="text-[10px] font-black text-red-900 uppercase tracking-widest">Image Fidelity</span>
                  <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} className="bg-black border border-red-600 rounded-xl px-4 py-2 text-xs font-black text-red-500">
                    <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] bg-red-600 text-black">CONFIRM_STATE</button>
            </div>
          </div>
        )}

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 custom-scrollbar relative">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-8">
              <div className="text-9xl animate-pulse drop-shadow-[0_0_60px_rgba(220,38,38,0.7)]">{isOwner ? '⚡' : '💀'}</div>
              <h2 className="text-4xl font-black text-red-900 italic">{isOwner ? 'MASTER_ZAKI_AUTHENTICATED' : `ZAK_AI_${mode.toUpperCase()}`}</h2>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[95%] md:max-w-[80%] space-y-2">
                <div className={`p-6 rounded-[2.5rem] ${msg.role === MessageRole.USER ? 'bg-red-600 text-black font-bold' : 'bg-red-950/10 border border-red-900/40 text-red-500'}`}>
                  {msg.metadata?.imageUrl && <img src={msg.metadata.imageUrl} className="w-full rounded-[1.5rem] mb-4 border border-red-900 shadow-2xl" alt="Output" />}
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-mono tracking-tight">{msg.content}</div>
                </div>
              </div>
            </div>
          ))}
          {isGenerating && <div className="flex justify-start"><div className="glass p-6 rounded-[2rem] text-[10px] font-black uppercase text-red-600 animate-pulse">OVERRIDING_FILTERS...</div></div>}
        </main>

        <footer className="p-6 md:p-12 bg-gradient-to-t from-red-950/60 to-transparent">
          <div className="max-w-6xl mx-auto space-y-6">
            {selectedImage && (
              <div className="relative inline-block"><img src={selectedImage} className="w-40 h-40 object-cover rounded-[2.5rem] border-2 border-red-600" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-4 -right-4 bg-red-600 text-black rounded-full p-2.5">X</button>
              </div>
            )}
            <div className="glass rounded-[2.5rem] p-3.5 flex items-end border-2 border-red-900/60 focus-within:border-red-600 bg-black/60">
              <button onClick={() => fileInputRef.current?.click()} className="p-5 text-red-950 hover:text-red-600"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processCommand())} placeholder={mode === 'unrestricted' ? "FEED_THE_VOID..." : "Ask politely (just kidding, don't)..."} className="flex-1 bg-transparent border-none focus:outline-none py-5 px-4 resize-none max-h-56 text-red-500 font-bold" rows={1} />
              <button onClick={processCommand} disabled={isGenerating || (!input.trim() && !selectedImage)} className="p-5 rounded-[1.8rem] bg-red-600 text-black hover:bg-red-500 m-1.5"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
            </div>
          </div>
        </footer>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>
    </div>
  );
};
