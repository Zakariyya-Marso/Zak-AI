
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatMessage, MessageRole, ChatSession } from '../types';
import { generateText, generateImage } from '../services/geminiService';
import { LiveSession } from './LiveSession';

interface ChatContainerProps {
  user: User;
  onLogout: () => void;
}

// Fixed: Define a clear interface and use it in the global augmentation 
// to avoid "All declarations of 'aistudio' must have identical modifiers" errors.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
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

  // Check for API Key on mount (Crucial for Vercel)
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
      setHasKey(true); // Proceed assuming success per guidelines
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

  const processCommand = async () => {
    if (!input.trim() && !selectedImage) return;
    setIsGenerating(true);

    try {
      if (input.toLowerCase().startsWith('/gen ')) {
        const prompt = input.replace('/gen ', '');
        addMessage({ role: MessageRole.USER, content: input, type: 'text' });
        const imgUrl = await generateImage(prompt, imageSize, mode);
        addMessage({ role: MessageRole.ASSISTANT, content: `Image generated in ${mode} mode.`, type: 'image', metadata: { imageUrl: imgUrl } });
      } else {
        addMessage({ role: MessageRole.USER, content: input, type: 'text' });
        const { text, sources } = await generateText(input, mode, useThinking, useSearch);
        addMessage({ role: MessageRole.ASSISTANT, content: text, type: 'text', metadata: { sources: sources.map((s: any) => s.web).filter(Boolean) } });
      }
      setInput('');
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false); // Trigger re-selection
      }
      addMessage({ role: MessageRole.ASSISTANT, content: `CRITICAL_ERROR: ${err.message}`, type: 'text' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-black text-red-600 font-sans">
      {isLive && <LiveSession mode={mode} onClose={() => setIsLive(false)} />}
      
      {!hasKey && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-4xl font-black mb-4 animate-pulse">KEY_REQUIRED</h2>
          <p className="text-red-900 mb-8 max-w-sm">Zak-AI requires an active Google Cloud API key to function on Vercel.</p>
          <button onClick={handleConnectKey} className="px-8 py-4 bg-red-600 text-black font-black rounded-xl">CONNECT_TO_VERCEL</button>
        </div>
      )}

      <aside className={`glass border-r border-red-900/40 transition-all duration-500 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0'}`}>
        <div className="p-6 border-b border-red-900/50 flex justify-between items-center">
          <span className="text-2xl font-black text-red-600">ZAK-AI</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-red-900">✕</button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <button onClick={startNewChat} className="w-full p-4 mb-4 border border-red-800 rounded-xl font-black hover:bg-red-600 hover:text-black transition-all">NEW_UPLINK</button>
          {chatHistory.map(chat => (
            <button key={chat.id} onClick={() => loadChat(chat)} className={`w-full text-left p-3 rounded-lg truncate text-sm mb-1 ${activeChatId === chat.id ? 'bg-red-900/20 border border-red-600' : 'text-red-900 hover:bg-red-950'}`}>
              {chat.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-red-900/50 flex items-center justify-between">
          <span className="text-xs font-black truncate">{user.username}</span>
          <button onClick={onLogout} className="text-xs font-black hover:text-white">LOGOUT</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative">
        <header className="p-4 glass border-b border-red-900/50 flex justify-between items-center bg-black/50">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="font-black">☰</button>}
            <div className={`px-3 py-1 text-[10px] font-black rounded-full border ${mode === 'unrestricted' ? 'border-red-600 text-red-600 animate-pulse' : 'border-blue-600 text-blue-600'}`}>
              {mode.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsLive(true)} className="px-4 py-2 bg-red-600/10 border border-red-600 text-[10px] font-black hover:bg-red-600 hover:text-black">LIVE_LINK</button>
            <button onClick={() => setShowSettings(true)} className="text-red-900 hover:text-red-600">⚙</button>
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl ${msg.role === MessageRole.USER ? 'bg-red-600 text-black font-bold' : 'bg-red-950/20 border border-red-900/40 text-red-500 font-mono'}`}>
                {msg.metadata?.imageUrl && <img src={msg.metadata.imageUrl} className="w-full rounded-2xl mb-3 shadow-2xl border border-red-900" />}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isGenerating && <div className="text-[10px] font-black animate-pulse">GENERATING_RESPONSE...</div>}
        </main>

        <footer className="p-6">
          <div className="max-w-4xl mx-auto glass rounded-2xl p-2 flex items-center border border-red-900">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processCommand())}
              placeholder="Type command..."
              className="flex-1 bg-transparent border-none focus:outline-none p-4 text-red-500 resize-none h-14"
            />
            <button onClick={processCommand} className="p-4 bg-red-600 text-black rounded-xl font-black">SEND</button>
          </div>
        </footer>

        {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
            <div className="glass p-10 rounded-3xl w-full max-w-sm border border-red-600">
              <h2 className="text-2xl font-black mb-8 italic">TERMINAL_CONFIG</h2>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black">MODE</span>
                  <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="bg-black border border-red-900 p-2 text-xs">
                    <option value="restricted">RESTRICTED</option>
                    <option value="unrestricted">UNRESTRICTED</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black">IMAGE_FIDELITY</span>
                  <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} className="bg-black border border-red-900 p-2 text-xs">
                    <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full mt-10 py-4 bg-red-600 text-black font-black rounded-xl">SAVE_CHANGES</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
