import { Character, Message, ChatSession, ChatHistory } from '@/types/character';
import { v4 as uuidv4 } from 'uuid';

const CHARACTERS_KEY = 'ai_characters';
const CHAT_SESSIONS_KEY = 'ai_chat_sessions';
const CHAT_HISTORIES_KEY = 'ai_chat_histories';
const CURRENT_SESSION_KEY = 'ai_current_session';

export const storage = {
  // 角色相关
  getCharacters: (): Character[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(CHARACTERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCharacter: (character: Character): void => {
    if (typeof window === 'undefined') return;
    const characters = storage.getCharacters();
    const index = characters.findIndex(c => c.id === character.id);
    if (index >= 0) {
      characters[index] = character;
    } else {
      characters.push(character);
    }
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
  },

  deleteCharacter: (id: string): void => {
    if (typeof window === 'undefined') return;
    const characters = storage.getCharacters().filter(c => c.id !== id);
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
    // 同时删除相关聊天记录
    storage.deleteChatSession(id);
    // 删除该角色的所有历史会话
    storage.deleteCharacterHistories(id);
  },

  getCharacterById: (id: string): Character | undefined => {
    return storage.getCharacters().find(c => c.id === id);
  },

  // 当前会话（兼容旧版本）
  getChatSession: (characterId: string): ChatSession => {
    if (typeof window === 'undefined') return { characterId, messages: [] };
    const data = localStorage.getItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
    return data ? JSON.parse(data) : { characterId, messages: [] };
  },

  saveChatSession: (session: ChatSession): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${CHAT_SESSIONS_KEY}_${session.characterId}`, JSON.stringify(session));
  },

  deleteChatSession: (characterId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
  },

  addMessage: (characterId: string, message: Message): void => {
    const session = storage.getChatSession(characterId);
    session.messages.push(message);
    storage.saveChatSession(session);
    // 同时更新当前历史会话
    const currentHistoryId = storage.getCurrentHistoryId(characterId);
    if (currentHistoryId) {
      storage.updateHistoryMessages(currentHistoryId, session.messages);
    }
  },

  clearChatHistory: (characterId: string): void => {
    const session = storage.getChatSession(characterId);
    session.messages = [];
    storage.saveChatSession(session);
    // 同时清空当前历史会话
    const currentHistoryId = storage.getCurrentHistoryId(characterId);
    if (currentHistoryId) {
      storage.updateHistoryMessages(currentHistoryId, []);
    }
  },

  // 获取所有聊天记录
  getAllChatSessions: (): Record<string, ChatSession> => {
    if (typeof window === 'undefined') return {};
    const sessions: Record<string, ChatSession> = {};
    
    // 遍历 localStorage 中所有以 ai_chat_sessions_ 开头的 key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CHAT_SESSIONS_KEY}_`)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const session: ChatSession = JSON.parse(data);
            if (session.messages && session.messages.length > 0) {
              sessions[session.characterId] = session;
            }
          }
        } catch (e) {
          console.error('解析聊天记录失败:', key, e);
        }
      }
    }
    
    return sessions;
  },

  // ========== 多会话历史记录 ==========
  
  // 获取当前历史会话ID
  getCurrentHistoryId: (characterId: string): string | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(`${CURRENT_SESSION_KEY}_${characterId}`);
    return data || null;
  },

  // 设置当前历史会话ID
  setCurrentHistoryId: (characterId: string, historyId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${CURRENT_SESSION_KEY}_${characterId}`, historyId);
  },

  // 获取角色的所有历史会话
  getCharacterHistories: (characterId: string): ChatHistory[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    return data ? JSON.parse(data) : [];
  },

  // 保存历史会话列表
  saveCharacterHistories: (characterId: string, histories: ChatHistory[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${CHAT_HISTORIES_KEY}_${characterId}`, JSON.stringify(histories));
  },

  // 创建新会话
  createNewHistory: (characterId: string, title: string = '新对话'): ChatHistory => {
    const history: ChatHistory = {
      id: uuidv4(),
      characterId,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const histories = storage.getCharacterHistories(characterId);
    histories.unshift(history); // 新会话放在最前面
    storage.saveCharacterHistories(characterId, histories);
    
    // 设置为当前会话
    storage.setCurrentHistoryId(characterId, history.id);
    
    // 清空当前会话
    storage.clearChatHistory(characterId);
    
    return history;
  },

  // 获取指定历史会话
  getHistory: (historyId: string): ChatHistory | null => {
    if (typeof window === 'undefined') return null;
    // 遍历所有角色的历史会话
    const characters = storage.getCharacters();
    for (const character of characters) {
      const histories = storage.getCharacterHistories(character.id);
      const history = histories.find(h => h.id === historyId);
      if (history) return history;
    }
    return null;
  },

  // 更新历史会话的消息
  updateHistoryMessages: (historyId: string, messages: Message[]): void => {
    const characters = storage.getCharacters();
    for (const character of characters) {
      const histories = storage.getCharacterHistories(character.id);
      const index = histories.findIndex(h => h.id === historyId);
      if (index >= 0) {
        histories[index].messages = messages;
        histories[index].updatedAt = Date.now();
        // 更新标题（使用第一条用户消息）
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage && histories[index].title === '新对话') {
          histories[index].title = firstUserMessage.content.slice(0, 20) + (firstUserMessage.content.length > 20 ? '...' : '');
        }
        storage.saveCharacterHistories(character.id, histories);
        break;
      }
    }
  },

  // 切换历史会话
  switchHistory: (characterId: string, historyId: string): void => {
    const history = storage.getHistory(historyId);
    if (history) {
      storage.setCurrentHistoryId(characterId, historyId);
      // 加载历史消息到当前会话
      const session: ChatSession = {
        characterId,
        messages: history.messages,
      };
      storage.saveChatSession(session);
    }
  },

  // 删除历史会话
  deleteHistory: (characterId: string, historyId: string): void => {
    const histories = storage.getCharacterHistories(characterId);
    const filtered = histories.filter(h => h.id !== historyId);
    storage.saveCharacterHistories(characterId, filtered);
    
    // 如果删除的是当前会话，切换到最新的会话或创建新会话
    const currentId = storage.getCurrentHistoryId(characterId);
    if (currentId === historyId) {
      if (filtered.length > 0) {
        storage.switchHistory(characterId, filtered[0].id);
      } else {
        storage.createNewHistory(characterId);
      }
    }
  },

  // 删除角色的所有历史会话
  deleteCharacterHistories: (characterId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    localStorage.removeItem(`${CURRENT_SESSION_KEY}_${characterId}`);
  },
};
