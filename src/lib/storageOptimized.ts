import { Character, Message, ChatSession, ChatHistory, CharacterGroup } from '@/types/character';
import { v4 as uuidv4 } from 'uuid';

const CHARACTERS_KEY = 'ai_characters';
const CHAT_SESSIONS_KEY = 'ai_chat_sessions';
const CHAT_HISTORIES_KEY = 'ai_chat_histories';
const CURRENT_SESSION_KEY = 'ai_current_session';
const CHARACTER_GROUPS_KEY = 'ai_character_groups';

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

const serialize = <T>(data: T): string => {
  return JSON.stringify(data);
};

const deserialize = <T>(data: string | null): T | null => {
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    console.error('反序列化数据失败:', e);
    return null;
  }
};

export const storageOptimized = {
  getCharacters: (): Character[] => {
    const data = safeStorage.getItem(CHARACTERS_KEY);
    return deserialize<Character[]>(data) || [];
  },

  saveCharacter: (character: Character): void => {
    const characters = storageOptimized.getCharacters();
    const index = characters.findIndex((c) => c.id === character.id);
    if (index >= 0) {
      characters[index] = character;
    } else {
      characters.push(character);
    }
    safeStorage.setItem(CHARACTERS_KEY, serialize(characters));
  },

  deleteCharacter: (id: string): void => {
    const characters = storageOptimized.getCharacters().filter((c) => c.id !== id);
    safeStorage.setItem(CHARACTERS_KEY, serialize(characters));
    storageOptimized.deleteChatSession(id);
    storageOptimized.deleteCharacterHistories(id);
  },

  getCharacterById: (id: string): Character | undefined => {
    return storageOptimized.getCharacters().find((c) => c.id === id);
  },

  getChatSession: (characterId: string): ChatSession => {
    const data = safeStorage.getItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
    return deserialize<ChatSession>(data) || { characterId, messages: [] };
  },

  saveChatSession: (session: ChatSession): void => {
    safeStorage.setItem(`${CHAT_SESSIONS_KEY}_${session.characterId}`, serialize(session));
  },

  deleteChatSession: (characterId: string): void => {
    safeStorage.removeItem(`${CHAT_SESSIONS_KEY}_${characterId}`);
  },

  addMessage: (characterId: string, message: Message): void => {
    const session = storageOptimized.getChatSession(characterId);
    session.messages.push(message);
    storageOptimized.saveChatSession(session);
    const currentHistoryId = storageOptimized.getCurrentHistoryId(characterId);
    if (currentHistoryId) {
      storageOptimized.updateHistoryMessages(currentHistoryId, session.messages);
    }
  },

  clearChatHistory: (characterId: string): void => {
    const session = storageOptimized.getChatSession(characterId);
    session.messages = [];
    storageOptimized.saveChatSession(session);
    const currentHistoryId = storageOptimized.getCurrentHistoryId(characterId);
    if (currentHistoryId) {
      storageOptimized.updateHistoryMessages(currentHistoryId, []);
    }
  },

  getAllChatSessions: (): Record<string, ChatSession> => {
    const sessions: Record<string, ChatSession> = {};
    if (typeof window === 'undefined') return sessions;

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

  getCurrentHistoryId: (characterId: string): string | null => {
    return safeStorage.getItem(`${CURRENT_SESSION_KEY}_${characterId}`);
  },

  setCurrentHistoryId: (characterId: string, historyId: string): void => {
    safeStorage.setItem(`${CURRENT_SESSION_KEY}_${characterId}`, historyId);
  },

  getCharacterHistories: (characterId: string): ChatHistory[] => {
    const data = safeStorage.getItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    return deserialize<ChatHistory[]>(data) || [];
  },

  saveCharacterHistories: (characterId: string, histories: ChatHistory[]): void => {
    safeStorage.setItem(`${CHAT_HISTORIES_KEY}_${characterId}`, serialize(histories));
  },

  createNewHistory: (characterId: string, title: string = '新对话'): ChatHistory => {
    const history: ChatHistory = {
      id: uuidv4(),
      characterId,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const histories = storageOptimized.getCharacterHistories(characterId);
    histories.unshift(history);
    storageOptimized.saveCharacterHistories(characterId, histories);
    storageOptimized.setCurrentHistoryId(characterId, history.id);
    storageOptimized.clearChatHistory(characterId);

    return history;
  },

  getHistory: (historyId: string): ChatHistory | null => {
    const characters = storageOptimized.getCharacters();
    for (const character of characters) {
      const histories = storageOptimized.getCharacterHistories(character.id);
      const history = histories.find((h) => h.id === historyId);
      if (history) return history;
    }
    return null;
  },

  updateHistoryMessages: (historyId: string, messages: Message[]): void => {
    const characters = storageOptimized.getCharacters();
    for (const character of characters) {
      const histories = storageOptimized.getCharacterHistories(character.id);
      const index = histories.findIndex((h) => h.id === historyId);
      if (index >= 0) {
        histories[index].messages = messages;
        histories[index].updatedAt = Date.now();
        const firstUserMessage = messages.find((m) => m.role === 'user');
        if (firstUserMessage && histories[index].title === '新对话') {
          histories[index].title =
            firstUserMessage.content.slice(0, 20) +
            (firstUserMessage.content.length > 20 ? '...' : '');
        }
        storageOptimized.saveCharacterHistories(character.id, histories);
        break;
      }
    }
  },

  switchHistory: (characterId: string, historyId: string): void => {
    const history = storageOptimized.getHistory(historyId);
    if (history) {
      storageOptimized.setCurrentHistoryId(characterId, historyId);
      const session: ChatSession = {
        characterId,
        messages: history.messages,
      };
      storageOptimized.saveChatSession(session);
    }
  },

  deleteHistory: (characterId: string, historyId: string): void => {
    const histories = storageOptimized.getCharacterHistories(characterId).filter(
      (h) => h.id !== historyId
    );
    storageOptimized.saveCharacterHistories(characterId, histories);

    const currentId = storageOptimized.getCurrentHistoryId(characterId);
    if (currentId === historyId) {
      if (histories.length > 0) {
        storageOptimized.switchHistory(characterId, histories[0].id);
      } else {
        storageOptimized.createNewHistory(characterId);
      }
    }
  },

  deleteCharacterHistories: (characterId: string): void => {
    safeStorage.removeItem(`${CHAT_HISTORIES_KEY}_${characterId}`);
    safeStorage.removeItem(`${CURRENT_SESSION_KEY}_${characterId}`);
  },

  getAllCharacterHistories: (): Record<string, ChatHistory[]> => {
    const histories: Record<string, ChatHistory[]> = {};
    if (typeof window === 'undefined') return histories;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CHAT_HISTORIES_KEY}_`)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const characterId = key.replace(`${CHAT_HISTORIES_KEY}_`, '');
            const parsed: ChatHistory[] = JSON.parse(data);
            if (parsed && parsed.length > 0) {
              histories[characterId] = parsed;
            }
          }
        } catch (e) {
          console.error('解析历史记录失败:', key, e);
        }
      }
    }

    return histories;
  },

  saveAllCharacterHistories: (histories: Record<string, ChatHistory[]>): void => {
    Object.entries(histories).forEach(([characterId, characterHistories]) => {
      if (characterHistories && characterHistories.length > 0) {
        safeStorage.setItem(
          `${CHAT_HISTORIES_KEY}_${characterId}`,
          serialize(characterHistories)
        );
      }
    });
  },

  getCharacterGroups: (): CharacterGroup[] => {
    const data = safeStorage.getItem(CHARACTER_GROUPS_KEY);
    return deserialize<CharacterGroup[]>(data) || [];
  },

  saveCharacterGroup: (group: CharacterGroup): void => {
    const groups = storageOptimized.getCharacterGroups();
    const index = groups.findIndex((g) => g.id === group.id);
    if (index >= 0) {
      groups[index] = group;
    } else {
      groups.push(group);
    }
    safeStorage.setItem(CHARACTER_GROUPS_KEY, serialize(groups));
  },

  deleteCharacterGroup: (groupId: string): void => {
    const groups = storageOptimized.getCharacterGroups().filter((g) => g.id !== groupId);
    safeStorage.setItem(CHARACTER_GROUPS_KEY, serialize(groups));
    const characters = storageOptimized.getCharacters();
    characters.forEach((c) => {
      if (c.group === groupId) {
        c.group = undefined;
        storageOptimized.saveCharacter(c);
      }
    });
  },

  getCharactersByGroup: (groupId: string): Character[] => {
    return storageOptimized.getCharacters().filter((c) => c.group === groupId);
  },

  getUngroupedCharacters: (): Character[] => {
    return storageOptimized.getCharacters().filter((c) => !c.group);
  },
};
