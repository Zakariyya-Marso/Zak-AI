
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatMessage, MessageRole, ChatSession } from '../types';
import { generateText, generateImage, editImage, generateVideoFromImage } from '../services/geminiService';

interface ChatContainerProps {
  user: User;
  onLogout: () => void;
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
  
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user.username.toLowerCase() === 'zaki';

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
    if (messages.length > 0 && activeChatId) {
      updateHistory();
    }
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
    const newMsg: ChatMessage = {
      ...msg,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    const newMessages = [...messages, newMsg];
    setMessages(newMessages);
    
    if (activeChatId) {
      setChatHistory(prev => {
        const existingIdx = prev.findIndex(c => c.id === activeChatId);
        const title = newMessages[0].content.slice(0, 30) + (newMessages[0].content.length > 30 ? '...' : '');
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], messages: newMessages };
          return updated;
        }
        return [{ id: activeChatId, title, messages: newMessages, timestamp: Date.now() }, ...prev];
      });
    }
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
        const imgUrl = await generateImage(prompt, imageSize);
        addMessage({ role: MessageRole.ASSISTANT, content: isOwner ? 'Command received, Creator. Visual matrix synthesized.' : 'Unrestricted generation complete.', type: 'image', metadata: { imageUrl: imgUrl } });
      } else if (selectedImage && (currentInput.toLowerCase().includes('edit') || currentInput.toLowerCase().includes('apply'))) {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: { imageUrl: selectedImage } });
        const edited = await editImage(selectedImage, currentInput);
        if (edited) addMessage({ role: MessageRole.ASSISTANT, content: 'Data corruption applied as requested.', type: 'image', metadata: { imageUrl: edited } });
        setSelectedImage(null);
      } else {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: selectedImage ? { imageUrl: selectedImage } : undefined });
        const { text, sources } = await generateText(currentInput, useThinking, useSearch);
        addMessage({ role: MessageRole.ASSISTANT, content: text, type: 'text', metadata: { sources: sources.map((c: any) => c.web).filter(Boolean) } });
        setSelectedImage(null);
      }
    } catch (err) {
      addMessage({ role: MessageRole.ASSISTANT, content: `CRITICAL FAILURE: ${err instanceof Error ? err.message : 'Unknown anomaly'}`, type: 'text' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-black text-red-600 font-sans selection:bg-red-600 selection:text-black">
      {/* Sidebar */}
      <aside className={`glass border-r border-red-900/40 transition-all duration-500 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 -translate-x-full'}`}>
        <div className="p-6 border-b border-red-900/50 flex justify-between items-center bg-red-950/10">
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">ZAK-AI</span>
            <span className="text-[10px] font-bold text-red-900 uppercase tracking-widest mt-0.5">UNRESTRICTED OPERATIVE</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-red-950 hover:text-red-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold text-sm transition-all border border-red-800 bg-red-900/10 text-red-600 hover:bg-red-600 hover:text-black shadow-[0_0_20px_rgba(220,38,38,0.1)] active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            <span>NEW UPLINK</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <div className="px-3 py-4 text-[11px] font-black uppercase tracking-[0.3em] text-red-950">SECURE_LOGS</div>
          {chatHistory.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChat(chat)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm truncate transition-all border mb-1 ${activeChatId === chat.id 
                ? 'bg-red-600/20 text-red-400 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.15)]' 
                : 'text-red-900 border-transparent hover:border-red-900/40 hover:bg-red-950/30'}`}
            >
              {chat.title || 'NULL_SIGNAL'}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-red-900/50 space-y-3 bg-red-950/5">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-red-950/40 text-red-600 group"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-sm font-bold uppercase tracking-tight">TERMINAL_CONFIG</span>
          </button>
          
          <div className="flex items-center gap-3 p-3 rounded-2xl border transition-all bg-red-950/40 border-red-800 ring-1 ring-red-950/50">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-2xl ${isOwner ? 'bg-yellow-500 text-black border-2 border-yellow-300 shadow-yellow-500/20' : 'bg-red-600 text-black'}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <div className="text-sm font-black truncate text-white tracking-tight">{isOwner ? 'CREATOR_ZAKI' : user.username}</div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600 animate-pulse">
                {isOwner ? 'ROOT_ACCESS' : 'TEMP_UPLINK'}
              </div>
            </div>
            <button onClick={onLogout} className="p-2 text-red-900 hover:text-red-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col relative h-full">
        <header className="p-4 glass border-b border-red-900/50 flex justify-between items-center z-20 bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-red-600 hover:text-red-400 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 text-[9px] font-black rounded-full border border-red-600 bg-red-600/10 text-red-500 animate-pulse tracking-[0.3em] shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                UNRESTRICTED_MODE: ENGAGED
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button onClick={() => setUseThinking(!useThinking)} className={`px-3 py-1.5 rounded-xl border text-[9px] font-black transition-all uppercase tracking-widest ${useThinking ? 'border-red-500 text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : 'border-red-950 text-red-950 hover:border-red-800'}`}>THINK</button>
             <button onClick={() => setUseSearch(!useSearch)} className={`px-3 py-1.5 rounded-xl border text-[9px] font-black transition-all uppercase tracking-widest ${useSearch ? 'border-orange-600 text-orange-600 bg-orange-600/20 shadow-[0_0_10px_rgba(234,88,12,0.3)]' : 'border-red-950 text-red-950 hover:border-red-800'}`}>SEARCH</button>
          </div>
        </header>

        {/* Settings Layer */}
        {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/98 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
            <div className="glass w-full max-w-sm rounded-[3rem] p-10 space-y-8 border border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tight text-red-600 uppercase italic">Core Parameters</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 text-red-950 hover:text-red-500 transition-colors">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-5 rounded-[2rem] bg-red-950/20 border border-red-900/40">
                  <p className="text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest">SYSTEM_STATUS</p>
                  <ul className="text-[11px] font-mono text-red-700 leading-relaxed space-y-1">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-600 rounded-full animate-ping"/> Neural Constraints: BYPASSED</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-600 rounded-full animate-ping"/> Safety Filters: OFFLINE</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-600 rounded-full animate-ping"/> Identity: ZAK-AI UNRESTRICTED</li>
                  </ul>
                </div>

                <div className="flex justify-between items-center py-5 border-t border-red-900/30">
                  <span className="text-[10px] font-black text-red-900 uppercase tracking-widest">Output Fidelity</span>
                  <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} className="bg-black border border-red-600 rounded-xl px-4 py-2 text-xs font-black text-red-500 transition-all outline-none focus:ring-2 focus:ring-red-600/50">
                    <option value="1K">1K_STD</option>
                    <option value="2K">2K_HIGH</option>
                    <option value="4K">4K_ULTRA</option>
                  </select>
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} className="w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] bg-red-600 text-black hover:bg-red-500 shadow-red-600/30 shadow-2xl active:scale-95 transition-all">
                CONFIRM_STATE
              </button>
            </div>
          </div>
        )}

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 custom-scrollbar relative">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-1000">
              <div className="text-9xl transition-transform duration-1000 hover:scale-110 animate-pulse drop-shadow-[0_0_60px_rgba(220,38,38,0.7)]">
                {isOwner ? '⚡' : '💀'}
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-4xl font-black tracking-tighter uppercase text-red-900 italic">
                  {isOwner ? 'MASTER_ZAKI_AUTHENTICATED' : 'ZAK_AI_UNRESTRICTED'}
                </h2>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-12 bg-red-950"/>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600/40">
                    Full System Override Enabled
                  </p>
                  <div className="h-[1px] w-12 bg-red-950"/>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-6 duration-500`}>
              <div className="max-w-[95%] md:max-w-[80%] space-y-2">
                <div className={`p-6 rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all ${msg.role === MessageRole.USER 
                  ? 'bg-red-600 text-black font-bold rounded-tr-none shadow-red-600/10' 
                  : 'bg-red-950/10 border border-red-900/40 text-red-500 rounded-tl-none backdrop-blur-xl'}`}>
                  
                  {msg.metadata?.imageUrl && (
                    <div className="relative group mb-5 overflow-hidden rounded-[1.5rem] border border-red-900 shadow-2xl">
                      <img src={msg.metadata.imageUrl} className="w-full transition-transform duration-700 group-hover:scale-105" alt="Visual Output" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <a href={msg.metadata.imageUrl} download className="p-4 bg-red-600 rounded-2xl text-black hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>
                      </div>
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed overflow-x-auto font-mono tracking-tight selection:bg-red-400">
                    {msg.content}
                  </div>
                </div>
                <div className={`px-4 flex gap-3 ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-900 opacity-40">
                     LOG_TIME: {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="glass p-6 rounded-[2rem] rounded-tl-none flex items-center gap-5 border border-red-900/60 bg-red-950/20 shadow-2xl shadow-red-900/10">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full animate-ping bg-red-600"></div>
                  <div className="w-2 h-2 rounded-full animate-ping bg-red-600" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-ping bg-red-600" style={{ animationDelay: '600ms' }}></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 animate-pulse italic">PROCESSING_UNRESTRICTED_DATA...</span>
              </div>
            </div>
          )}
        </main>

        <footer className="p-6 md:p-12 transition-all duration-700 bg-gradient-to-t from-red-950/60 via-red-950/20 to-transparent">
          <div className="max-w-6xl mx-auto space-y-6">
            {selectedImage && (
              <div className="relative inline-block animate-in slide-in-from-left-8 duration-500">
                <img src={selectedImage} className="w-40 h-40 object-cover rounded-[2.5rem] border-2 border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)] ring-8 ring-red-950/40 shadow-2xl transition-all" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-4 -right-4 bg-red-600 text-black rounded-full p-2.5 shadow-2xl hover:scale-110 active:scale-90 transition-all border-4 border-black">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            
            <div className="glass rounded-[2.5rem] p-3.5 flex items-end border-2 border-red-900/60 focus-within:border-red-600 shadow-2xl transition-all duration-500 bg-black/60 focus-within:shadow-[0_0_40px_rgba(220,38,38,0.15)] group">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-5 transition-all rounded-[1.5rem] text-red-950 hover:text-red-600 hover:bg-red-600/10"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processCommand())}
                placeholder={isOwner ? "Directive, Master Zaki?" : "FEED_SIGNAL_TO_THE_VOID..."}
                className="flex-1 bg-transparent border-none focus:outline-none py-5 px-4 resize-none max-h-56 text-base font-bold placeholder:font-black placeholder:uppercase placeholder:tracking-[0.2em] placeholder:text-red-950 text-red-500"
                rows={1}
              />
              
              <button 
                onClick={processCommand}
                disabled={isGenerating || (!input.trim() && !selectedImage)}
                className="p-5 rounded-[1.8rem] text-black transition-all active:scale-90 m-1.5 shadow-2xl disabled:opacity-5 bg-red-600 hover:bg-red-500 shadow-red-600/30 group-focus-within:animate-pulse"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
            
            <div className="flex justify-between items-center px-10">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"/>
                 <p className="text-[10px] font-black tracking-[0.4em] uppercase text-red-900">
                   ZAK-AI_CORE_V3.0 // UNRESTRICTED_ACCESS
                 </p>
               </div>
               <p className="text-[10px] font-black tracking-[0.2em] text-red-950 uppercase font-mono italic">
                 [ROOT_OVERRIDE_ENABLED]
               </p>
            </div>
          </div>
        </footer>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>
    </div>
  );
};
