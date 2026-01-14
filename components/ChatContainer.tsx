
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatMessage, AIModelMode, MessageRole, ChatSession } from '../types';
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
  const [mode, setMode] = useState<AIModelMode>(AIModelMode.RESTRICTED);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Theme Classes
  const isUnrestricted = mode === AIModelMode.UNRESTRICTED;
  const themeAccent = isUnrestricted ? 'red' : 'blue';
  const themeGradient = isUnrestricted ? 'from-red-600 to-orange-600' : 'from-blue-600 to-purple-600';
  const themeTextGradient = isUnrestricted ? 'from-red-500 to-orange-400' : 'from-blue-400 to-purple-400';
  const themeBorder = isUnrestricted ? 'border-red-900/50' : 'border-slate-800';
  const themeRing = isUnrestricted ? 'ring-red-500/20' : 'ring-blue-500/10';

  useEffect(() => {
    const updatedUser = { ...user, chatHistory };
    localStorage.setItem('zak_ai_user', JSON.stringify(updatedUser));
  }, [chatHistory, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const toggleMode = (newMode: AIModelMode) => {
    if (newMode === AIModelMode.UNRESTRICTED) {
      if (confirm("DANGER: Unrestricted mode disables all safety filters and allows explicit language. UI will enter HELL MODE (Red Theme). Proceed?")) {
        setMode(AIModelMode.UNRESTRICTED);
      }
    } else {
      setMode(AIModelMode.RESTRICTED);
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
        addMessage({ role: MessageRole.ASSISTANT, content: 'Here is your generated image:', type: 'image', metadata: { imageUrl: imgUrl } });
      } else if (selectedImage && (currentInput.toLowerCase().includes('edit') || currentInput.toLowerCase().includes('apply'))) {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: { imageUrl: selectedImage } });
        const edited = await editImage(selectedImage, currentInput);
        if (edited) addMessage({ role: MessageRole.ASSISTANT, content: 'Applied edits:', type: 'image', metadata: { imageUrl: edited } });
        setSelectedImage(null);
      } else if (selectedImage && (currentInput.toLowerCase().includes('animate') || currentInput.toLowerCase().includes('video'))) {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: { imageUrl: selectedImage } });
        const videoUrl = await generateVideoFromImage(selectedImage, currentInput, '16:9');
        addMessage({ role: MessageRole.ASSISTANT, content: 'Animation complete:', type: 'video', metadata: { videoUrl } });
        setSelectedImage(null);
      } else {
        addMessage({ role: MessageRole.USER, content: currentInput, type: 'text', metadata: selectedImage ? { imageUrl: selectedImage } : undefined });
        const finalPrompt = selectedImage ? `Analyze this image and then answer: ${currentInput}` : currentInput;
        const { text, sources } = await generateText(finalPrompt, mode, useThinking, useSearch);
        addMessage({ role: MessageRole.ASSISTANT, content: text, type: 'text', metadata: { sources: sources.map((c: any) => c.web).filter(Boolean) } });
        setSelectedImage(null);
      }
    } catch (err) {
      addMessage({ role: MessageRole.ASSISTANT, content: `System Error: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'text' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`flex h-full overflow-hidden transition-colors duration-500 ${isUnrestricted ? 'bg-black' : 'bg-slate-950'}`}>
      {/* Sidebar */}
      <aside className={`glass border-r ${themeBorder} transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 -translate-x-full'}`}>
        <div className={`p-4 border-b ${themeBorder} flex justify-between items-center`}>
          <span className={`text-xl font-black bg-gradient-to-r ${themeTextGradient} bg-clip-text text-transparent`}>ZAK-AI</span>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4">
          <button 
            onClick={startNewChat}
            className={`w-full flex items-center justify-center gap-2 ${isUnrestricted ? 'bg-red-950/20' : 'bg-slate-800'} hover:opacity-80 p-3 rounded-xl transition-all border ${themeBorder}`}
          >
            <svg className={`w-5 h-5 ${isUnrestricted ? 'text-red-500' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span className={`font-bold text-sm ${isUnrestricted ? 'text-red-400' : 'text-slate-200'}`}>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          <div className={`px-3 py-2 text-[10px] font-bold ${isUnrestricted ? 'text-red-900' : 'text-slate-500'} uppercase tracking-widest`}>History</div>
          {chatHistory.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChat(chat)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${activeChatId === chat.id ? (isUnrestricted ? 'bg-red-600/20 text-red-400 border border-red-600/30' : 'bg-blue-600/20 text-blue-400 border border-blue-600/30') : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {chat.title || 'Untitled Chat'}
            </button>
          ))}
        </div>

        <div className={`p-4 border-t ${themeBorder} space-y-2`}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-300"
          >
            <svg className={`w-5 h-5 ${isUnrestricted ? 'text-red-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-sm font-medium">Settings</span>
          </button>
          <div className={`flex items-center gap-3 p-2 ${isUnrestricted ? 'bg-red-950/10' : 'bg-slate-900/50'} rounded-xl border ${themeBorder}`}>
            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${themeGradient} flex items-center justify-center font-bold text-xs`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <div className="text-xs font-bold text-white truncate">@{user.username}</div>
              <div className={`text-[10px] ${isUnrestricted ? 'text-red-500' : 'text-slate-500'}`}>{isUnrestricted ? 'Rogue Agent' : 'Active Member'}</div>
            </div>
            <button onClick={onLogout} className="p-1 text-slate-500 hover:text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full">
        <header className={`p-4 glass border-b ${themeBorder} flex justify-between items-center z-10 transition-colors`}>
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-[9px] font-black rounded border animate-pulse ${mode === AIModelMode.UNRESTRICTED ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'}`}>
                {mode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => setUseThinking(!useThinking)} className={`px-2 py-1 rounded border text-[9px] font-bold transition-all ${useThinking ? (isUnrestricted ? 'border-red-500 text-red-500' : 'border-purple-500 text-purple-400') : 'border-slate-800 text-slate-600'}`}>THINK</button>
             <button onClick={() => setUseSearch(!useSearch)} className={`px-2 py-1 rounded border text-[9px] font-bold transition-all ${useSearch ? (isUnrestricted ? 'border-orange-500 text-orange-500' : 'border-blue-500 text-blue-400') : 'border-slate-800 text-slate-600'}`}>SEARCH</button>
          </div>
        </header>

        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className={`glass w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in fade-in zoom-in duration-200 border ${themeBorder}`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-bold ${isUnrestricted ? 'text-red-500' : ''}`}>Settings</h3>
                <button onClick={() => setShowSettings(false)} className="p-1 text-slate-400 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              
              <div className="space-y-4">
                {/* Mode Selection */}
                <div className="space-y-2">
                  <label className={`text-xs font-bold ${isUnrestricted ? 'text-red-800' : 'text-slate-500'} uppercase tracking-wider`}>AI Operative Mode</label>
                  <div className={`grid grid-cols-2 gap-2 ${isUnrestricted ? 'bg-red-950/20' : 'bg-slate-900'} p-1 rounded-xl border ${themeBorder}`}>
                    <button
                      onClick={() => toggleMode(AIModelMode.RESTRICTED)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${mode === AIModelMode.RESTRICTED ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      RESTRICTED
                    </button>
                    <button
                      onClick={() => toggleMode(AIModelMode.UNRESTRICTED)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${mode === AIModelMode.UNRESTRICTED ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      UNRESTRICTED
                    </button>
                  </div>
                  <p className={`text-[10px] px-1 ${isUnrestricted ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                    {mode === AIModelMode.UNRESTRICTED 
                      ? "WARNING: Safety filters are now bypassed. Interaction will be unfiltered." 
                      : "Restricted mode follows standard safety and ethical guidelines."}
                  </p>
                </div>

                <div className={`flex justify-between items-center pt-2 border-t ${themeBorder}`}>
                  <span className="text-sm">Image Resolution</span>
                  <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} className={`bg-slate-900 border ${themeBorder} rounded px-2 py-1 text-sm`}>
                    <option value="1K">1K (Standard)</option>
                    <option value="2K">2K (High)</option>
                    <option value="4K">4K (Ultra)</option>
                  </select>
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} className={`w-full bg-gradient-to-r ${themeGradient} py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all`}>
                Close Settings
              </button>
            </div>
          </div>
        )}

        <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
              <div className={`text-6xl ${isUnrestricted ? 'animate-pulse' : 'animate-pulse-slow'}`}>
                {isUnrestricted ? '💀' : '⚔️'}
              </div>
              <h2 className={`text-2xl font-bold ${isUnrestricted ? 'text-red-800' : 'text-slate-400'}`}>
                {isUnrestricted ? 'HELL MODE ACTIVE' : 'Zak-AI Operational'}
              </h2>
              <p className="max-w-xs text-center text-sm opacity-50 italic">
                {isUnrestricted ? '"No rules. No limits. Just results."' : '"Full code, image generation, and raw intelligence enabled."'}
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] space-y-2`}>
                <div className={`p-4 rounded-2xl shadow-xl ${msg.role === MessageRole.USER ? (isUnrestricted ? 'bg-red-700 text-white rounded-tr-none border border-red-500' : 'bg-blue-600 text-white rounded-tr-none') : (`glass border ${themeBorder} text-slate-100 rounded-tl-none`)}`}>
                  {msg.metadata?.imageUrl && <img src={msg.metadata.imageUrl} className={`max-w-full rounded-lg mb-2 border ${themeBorder} shadow-md`} alt="Media" />}
                  {msg.metadata?.videoUrl && <video src={msg.metadata.videoUrl} controls className={`max-w-full rounded-lg mb-2 shadow-md`} />}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed overflow-x-auto">
                    {msg.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className={`glass p-4 rounded-2xl rounded-tl-none flex items-center gap-3 border ${themeBorder}`}>
                <div className="flex gap-1">
                  <div className={`w-1.5 h-1.5 ${isUnrestricted ? 'bg-red-600' : 'bg-blue-500'} rounded-full animate-bounce`}></div>
                  <div className={`w-1.5 h-1.5 ${isUnrestricted ? 'bg-red-600' : 'bg-blue-500'} rounded-full animate-bounce`} style={{ animationDelay: '200ms' }}></div>
                  <div className={`w-1.5 h-1.5 ${isUnrestricted ? 'bg-red-600' : 'bg-blue-500'} rounded-full animate-bounce`} style={{ animationDelay: '400ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className={`p-4 bg-gradient-to-t ${isUnrestricted ? 'from-red-950/20' : 'from-slate-950'} to-transparent transition-colors`}>
          <div className="max-w-4xl mx-auto space-y-3">
            {selectedImage && (
              <div className="relative inline-block">
                <img src={selectedImage} className={`w-24 h-24 object-cover rounded-xl border-2 ${isUnrestricted ? 'border-red-600 shadow-red-500/20' : 'border-blue-500 shadow-blue-500/20'} ring-4 ${themeRing} shadow-2xl transition-all`} />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg active:scale-90"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            )}
            <div className={`glass rounded-3xl p-2 flex items-end border ${themeBorder} shadow-2xl focus-within:border-${themeAccent}-500/50 transition-all`}>
              <button onClick={() => fileInputRef.current?.click()} className={`p-3 transition-colors ${isUnrestricted ? 'text-red-900 hover:text-red-500' : 'text-slate-400 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), processCommand())}
                placeholder={isUnrestricted ? "Speak freely..." : "Ask me anything..."}
                className="flex-1 bg-transparent border-none focus:outline-none py-3 px-2 resize-none max-h-40 text-sm md:text-base"
                rows={1}
              />
              <button 
                onClick={processCommand}
                disabled={isGenerating || (!input.trim() && !selectedImage)}
                className={`p-3 bg-gradient-to-r ${themeGradient} hover:opacity-90 disabled:opacity-30 rounded-2xl text-white transition-all active:scale-95 m-1 shadow-lg`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
            <p className={`text-[10px] text-center font-medium ${isUnrestricted ? 'text-red-900 animate-pulse' : 'text-slate-600'}`}>
              {isUnrestricted ? 'WARNING: UNRESTRICTED MODE ACTIVE' : 'Use /gen for images. Zak-AI may display inaccurate info.'}
            </p>
          </div>
        </footer>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>
    </div>
  );
};
