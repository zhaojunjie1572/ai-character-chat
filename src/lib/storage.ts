import { Character, Message, ChatSession, ChatHistory, CharacterGroup } from '@/types/character';
import { v4 as uuidv4 } from 'uuid';

const CHARACTERS_KEY = 'ai_characters';
const CHAT_SESSIONS_KEY = 'ai_chat_sessions';
const CHAT_HISTORIES_KEY = 'ai_chat_histories';
const CURRENT_SESSION_KEY = 'ai_current_session';
const CHARACTER_GROUPS_KEY = 'ai_character_groups';

// 安全的 localStorage 操作
const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error(`读取 localStorage 失败 [${key}]:`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error(`写入 localStorage 失败 [${key}]:`, e);
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`删除 localStorage 失败 [${key}]:`, e);
      return false;
    }
  },
};

export const storage = {
  // 角色相关
  getCharacters: (): Character[] => {
    const data = safeStorage.getItem(CHARACTERS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('解析角色数据失败:', e);
      return [];
    }
  },

  saveCharacter: (character: Character): void => {
    const characters = storage.getCharacters();
    const index = characters.findIndex(c => c.id === character.id);
    if (index >= 0) {
      characters[index] = character;
    } else {
      characters.push(character);
    }
    safeStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
  },

  deleteCharacter: (id: string): void => {
    const characters = storage.getCharacters().filter(c => c.id !== id);
    safeStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
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
    const data = safeStorage.getItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
    if (!data) return { characterId, messages: [] };
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('解析会话数据失败:', e);
      return { characterId, messages: [] };
    }
  },

  saveChatSession: (session: ChatSession): void => {
    safeStorage.setItem(`${CHAT_SESSIONS_KEY}_${session.characterId}`, JSON.stringify(session));
  },

  deleteChatSession: (characterId: string): void => {
    safeStorage.removeItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
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
    const sessions: Record<string, ChatSession> = {};
    if (typeof window === 'undefined') return sessions;

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
    return safeStorage.getItem(`${CURRENT_SESSION_KEY}_${characterId}`);
  },

  // 设置当前历史会话ID
  setCurrentHistoryId: (characterId: string, historyId: string): void => {
    safeStorage.setItem(`${CURRENT_SESSION_KEY}_${characterId}`, historyId);
  },

  // 获取角色的所有历史会话
  getCharacterHistories: (characterId: string): ChatHistory[] => {
    const data = safeStorage.getItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('解析历史记录失败:', e);
      return [];
    }
  },

  // 保存历史会话列表
  saveCharacterHistories: (characterId: string, histories: ChatHistory[]): void => {
    safeStorage.setItem(`${CHAT_HISTORIES_KEY}_${characterId}`, JSON.stringify(histories));
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
    safeStorage.removeItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    safeStorage.removeItem(`${CURRENT_SESSION_KEY}_${characterId}`);
  },

  // ========== 角色分组 ==========

  // 获取所有分组
  getCharacterGroups: (): CharacterGroup[] => {
    const data = safeStorage.getItem(CHARACTER_GROUPS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('解析分组数据失败:', e);
      return [];
    }
  },

  // 保存分组
  saveCharacterGroup: (group: CharacterGroup): void => {
    const groups = storage.getCharacterGroups();
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) {
      groups[index] = group;
    } else {
      groups.push(group);
    }
    safeStorage.setItem(CHARACTER_GROUPS_KEY, JSON.stringify(groups));
  },

  // 删除分组
  deleteCharacterGroup: (groupId: string): void => {
    const groups = storage.getCharacterGroups().filter(g => g.id !== groupId);
    safeStorage.setItem(CHARACTER_GROUPS_KEY, JSON.stringify(groups));
    // 将该分组下的角色分组设为空
    const characters = storage.getCharacters();
    characters.forEach(c => {
      if (c.group === groupId) {
        c.group = undefined;
        storage.saveCharacter(c);
      }
    });
  },

  // 按分组获取角色
  getCharactersByGroup: (groupId: string): Character[] => {
    return storage.getCharacters().filter(c => c.group === groupId);
  },

  // 获取未分组的角色
  getUngroupedCharacters: (): Character[] => {
    return storage.getCharacters().filter(c => !c.group);
  },
};
