
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  type: 'text' | 'image' | 'video' | 'code';
  metadata?: {
    imageUrl?: string;
    videoUrl?: string;
    language?: string;
    sources?: Array<{ title: string; web: { uri: string } }>;
  };
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  chatHistory: ChatSession[];
}
