export interface Character {
  id: string;
  name: string;
  title?: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  group?: string; // 角色分组
  createdAt: number;
  updatedAt: number;
}

// 角色分组
export interface CharacterGroup {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Message {
  id: string;
  characterId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  characterId: string;
  messages: Message[];
}

// 多会话支持
export interface ChatHistory {
  id: string;
  characterId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
