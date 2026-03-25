import { Character, Message, ChatSession } from '@/types/character';

const CHARACTERS_KEY = 'ai_characters';
const CHAT_SESSIONS_KEY = 'ai_chat_sessions';

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
  },

  getCharacterById: (id: string): Character | undefined => {
    return storage.getCharacters().find(c => c.id === id);
  },

  // 聊天记录相关
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
  },

  clearChatHistory: (characterId: string): void => {
    const session = storage.getChatSession(characterId);
    session.messages = [];
    storage.saveChatSession(session);
  },
};
