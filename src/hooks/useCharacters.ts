'use client';

import { useState, useEffect, useCallback } from 'react';
import { Character } from '@/types/character';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = storage.getCharacters();
    setCharacters(loaded);
    setIsLoaded(true);
  }, []);

  const addCharacter = useCallback((characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCharacter: Character = {
      ...characterData,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    storage.saveCharacter(newCharacter);
    setCharacters(prev => [...prev, newCharacter]);
    return newCharacter;
  }, []);

  const updateCharacter = useCallback((id: string, updates: Partial<Character>) => {
    const character = storage.getCharacterById(id);
    if (character) {
      const updated = { ...character, ...updates, updatedAt: Date.now() };
      storage.saveCharacter(updated);
      setCharacters(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    }
    return null;
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    storage.deleteCharacter(id);
    setCharacters(prev => prev.filter(c => c.id !== id));
  }, []);

  const getCharacter = useCallback((id: string) => {
    return characters.find(c => c.id === id);
  }, [characters]);

  return {
    characters,
    isLoaded,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    getCharacter,
  };
}
