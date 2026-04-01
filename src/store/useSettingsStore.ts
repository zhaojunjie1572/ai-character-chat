'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiProvider } from '@/lib/api';

export interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
  apiProvider: ApiProvider;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
  backgroundImage: string;
  voiceURI: string;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  gistToken: string;
  gistId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseURL: 'https://api.openai.com/v1',
  apiModel: 'gpt-3.5-turbo',
  apiProvider: 'openai',
  voiceEnabled: false,
  voiceInputEnabled: false,
  backgroundImage: '',
  voiceURI: '',
  voiceVolume: 1,
  voiceRate: 1,
  voicePitch: 1,
  gistToken: '',
  gistId: '',
};

interface SettingsState {
  settings: AppSettings;
  tempSettings: AppSettings;
  availableVoices: SpeechSynthesisVoice[];
  isSettingsLoaded: boolean;
  setSettings: (settings: Partial<AppSettings>) => void;
  setTempSettings: (settings: Partial<AppSettings>) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  saveSettings: () => void;
  resetTempSettings: () => void;
  loadVoices: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      tempSettings: DEFAULT_SETTINGS,
      availableVoices: [],
      isSettingsLoaded: false,

      setSettings: (newSettings) =>
        set((state) => ({
        settings: { ...state.settings, ...newSettings },
        tempSettings: { ...state.tempSettings, ...newSettings },
      })),

      setTempSettings: (newSettings) =>
        set((state) => ({
        tempSettings: { ...state.tempSettings, ...newSettings },
      })),

      updateSetting: (key, value) =>
        set((state) => {
          const newSettings = { ...state.settings, [key]: value };
          const newTempSettings = { ...state.tempSettings, [key]: value };
          try {
            localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
          } catch (e) {
            console.error('保存设置失败:', e);
          }
          return {
            settings: newSettings,
            tempSettings: newTempSettings,
          };
        }),

      saveSettings: () =>
        set((state) => {
          try {
            localStorage.setItem('ai_app_settings', JSON.stringify(state.tempSettings));
          } catch (e) {
            console.error('保存设置失败:', e);
          }
          return {
            settings: state.tempSettings,
          };
        }),

      resetTempSettings: () =>
        set((state) => ({
          tempSettings: state.settings,
        })),

      loadVoices: () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        
        const loadVoicesFn = () => {
          const voices = window.speechSynthesis.getVoices();
          const chineseVoices = voices.filter((v) => v.lang.includes('zh'));
          set({
            availableVoices: chineseVoices.length > 0 ? chineseVoices : voices,
            isSettingsLoaded: true,
          });
        };

        loadVoicesFn();
        window.speechSynthesis.onvoiceschanged = loadVoicesFn;
      },
    }),
    {
      name: 'ai-app-settings',
      storage: {
        getItem: (name) => {
          try {
            const item = localStorage.getItem(name);
            if (item) {
              const parsed = JSON.parse(item);
              return {
                state: {
                  settings: { ...DEFAULT_SETTINGS, ...parsed.state?.settings },
                  tempSettings: { ...DEFAULT_SETTINGS, ...parsed.state?.settings },
                },
              };
            }
          } catch (e) {
            console.error('加载设置失败:', e);
          }
          return null;
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify({
              state: { settings: value.state.settings },
            }));
          } catch (e) {
            console.error('保存设置失败:', e);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
