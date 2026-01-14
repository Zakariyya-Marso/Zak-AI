
import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ChatContainer } from './components/ChatContainer';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('zak_ai_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const handleAuth = (userData: User) => {
    localStorage.setItem('zak_ai_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('zak_ai_user');
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="text-2xl font-bold animate-pulse gradient-text">ZAK-AI</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
      {!user ? (
        <AuthScreen onAuth={handleAuth} />
      ) : (
        <ChatContainer user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
