
import React, { useState } from 'react';
import { User } from '../types';

interface AuthScreenProps {
  onAuth: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    // Simple mock auth
    onAuth({
      id: Math.random().toString(36).substr(2, 9),
      username,
      chats: []
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 glass rounded-3xl space-y-8 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tighter gradient-text">ZAK-AI</h1>
          <p className="text-slate-400 text-sm">{isLogin ? 'Welcome back, commander.' : 'Initialize your secure access.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 ml-1">Identity</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="Username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 ml-1">Access Code</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
          >
            {isLogin ? 'Log In' : 'Initialize Access'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            {isLogin ? "New here? Create identity" : "Existing user? Authenticate"}
          </button>
        </div>
      </div>
    </div>
  );
};
