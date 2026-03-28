'use client';

import { create } from 'zustand';
import { Character } from '@/types/character';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

interface CharactersState {
  characters: Character[];
  isLoaded: boolean;
  addCharacter: (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Character;
  updateCharacter: (id: string, updates: Partial<Character>) => Character | null;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
  loadCharacters: () => void;
}

export const useCharactersStore = create<CharactersState>((set, get) => ({
  characters: [],
  isLoaded: false,

  loadCharacters: () => {
    const loaded = storage.getCharacters();
    set({ characters: loaded, isLoaded: true });
  },

  addCharacter: (characterData) => {
    const newCharacter: Character = {
      ...characterData,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    storage.saveCharacter(newCharacter);
    set((state) => ({
      characters: [...state.characters, newCharacter],
    }));
    return newCharacter;
  },

  updateCharacter: (id, updates) => {
    const character = storage.getCharacterById(id);
    if (character) {
      const updated = { ...character, ...updates, updatedAt: Date.now() };
      storage.saveCharacter(updated);
      set((state) => ({
        characters: state.characters.map((c) => (c.id === id ? updated : c)),
      }));
      return updated;
    }
    return null;
  },

  deleteCharacter: (id) => {
    storage.deleteCharacter(id);
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
    }));
  },

  getCharacter: (id) => {
    return get().characters.find((c) => c.id === id);
  },
}));
