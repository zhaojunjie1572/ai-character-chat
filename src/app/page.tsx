'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Users, Compass, User, Plus, Search, 
  MoreHorizontal, X, Settings, Key, Sparkles, 
  Volume2, Cloud, Download, Upload, RefreshCw, 
  Check, AlertCircle, Trash2, Edit3, Smile, Plus as PlusIcon,
  UsersRound, Folder, ChevronRight, ChevronLeft, Mic, Edit
} from 'lucide-react';
import { useCharacters } from '@/hooks/useCharacters';
import { CharacterForm } from '@/components/CharacterForm';
import { ChatInterface } from '@/components/ChatInterface';
import { MeetingRoom } from '@/components/MeetingRoom';
import { meetingStorage } from '@/lib/meetingStorage';
import { memoStorage, MemoItem } from '@/lib/memoStorage';
import { Avatar } from '@/components/Avatar';
import { Character, CharacterGroup } from '@/types/character';
import { gistSyncService } from '@/lib/gistSync';
import { storage } from '@/lib/storage';
import { TtsConfig, loadTtsConfig, saveTtsConfig, EDGE_TTS_VOICES } from '@/lib/ttsService';
import { searchByPinyin } from '@/lib/pinyin';

type ApiProvider = 'openai' | 'azure' | 'claude' | 'gemini' | 'ollama' | 'local_proxy' | 'minimax' | 'custom';

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
  apiProvider: ApiProvider;
  maxTokens: number;
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

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseURL: 'https://api.openai.com/v1',
  apiModel: 'gpt-3.5-turbo',
  apiProvider: 'openai',
  maxTokens: 4000,
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

type TabType = 'wechat' | 'contacts' | 'discover' | 'me';

export default function Home() {
  const { characters, isLoaded, addCharacter, updateCharacter, deleteCharacter } = useCharacters();
  const [activeTab, setActiveTab] = useState<TabType>('wechat');
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [chattingCharacter, setChattingCharacter] = useState<Character | undefined>();
  const [apiSettings, setApiSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [contextMenuCharacter, setContextMenuCharacter] = useState<Character | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showMeetingRoom, setShowMeetingRoom] = useState(false);
  
  // 分组相关状态
  const [groups, setGroups] = useState<CharacterGroup[]>([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 备忘录相关状态
  const [showService, setShowService] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceView, setServiceView] = useState<'folders' | 'notes'>('folders');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [filteredMemos, setFilteredMemos] = useState<MemoItem[]>([]);

  // TTS 设置相关状态
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(loadTtsConfig());

  // API 连接和模型相关状态
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      setApiSettings(settings);
      setTempSettings(settings);
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const chineseVoices = voices.filter(v => v.lang.includes('zh'));
      setAvailableVoices(chineseVoices.length > 0 ? chineseVoices : voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 加载分组数据
  useEffect(() => {
    setGroups(storage.getCharacterGroups());
  }, [characters]); // 当角色列表变化时重新加载分组

  // 加载备忘录数据
  useEffect(() => {
    const loadedMemos = memoStorage.getMemos();
    setMemos(loadedMemos);
    setFilteredMemos(loadedMemos);
  }, [showService]); // 当打开服务页面时重新加载

  // 搜索备忘录
  useEffect(() => {
    if (serviceSearchQuery.trim()) {
      setFilteredMemos(memoStorage.searchMemos(serviceSearchQuery));
    } else {
      setFilteredMemos(memos);
    }
  }, [serviceSearchQuery, memos]);

  const handleSaveSettings = () => {
    localStorage.setItem('ai_app_settings', JSON.stringify(tempSettings));
    setApiSettings(tempSettings);
    setShowSettings(false);
    setShowMoreMenu(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // 获取模型列表
  const fetchModels = async () => {
    if (!tempSettings.apiBaseURL) {
      setConnectionMessage('请先输入 API 地址');
      return;
    }

    // Minimax 没有标准的 models 端点，提供预设的模型列表
    if (tempSettings.apiProvider === 'minimax') {
      const minimaxModels = [
        { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed (极速版 100tps)' },
        { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7 (自我迭代 60tps)' },
        { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed (极速版 100tps)' },
        { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5 (顶尖性能 60tps)' },
        { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed (极速版 100tps)' },
        { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1 (多语言编程 60tps)' },
        { id: 'MiniMax-M2', name: 'MiniMax-M2 (高效编码/Agent)' },
      ];
      setAvailableModels(minimaxModels);
      setConnectionStatus('connected');
      setConnectionMessage('已加载 Minimax 预设模型列表');
      return;
    }

    setIsLoadingModels(true);
    setConnectionStatus('testing');
    setConnectionMessage('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tempSettings.apiKey) {
        headers['Authorization'] = `Bearer ${tempSettings.apiKey}`;
      }

      // 构建 models 端点 URL，自动处理 /v1 路径
      const baseUrl = tempSettings.apiBaseURL.replace(/\/$/, '');
      const modelsUrl = baseUrl.endsWith('/v1') 
        ? `${baseUrl}/models` 
        : `${baseUrl}/v1/models`;
      
      console.log('请求模型列表:', modelsUrl);
      
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('模型列表响应:', data);

      // 支持多种响应格式
      let models: { id: string; name: string }[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        // OpenAI 标准格式: { data: [{ id: '...', ... }] }
        models = data.data.map((m: any) => ({
          id: m.id || m.name || '',
          name: m.id || m.name || '',
        }));
      } else if (data.models && Array.isArray(data.models)) {
        // 另一种常见格式: { models: [...] }
        models = data.models.map((m: any) => ({
          id: m.id || m.name || m || '',
          name: m.id || m.name || m || '',
        }));
      } else if (Array.isArray(data)) {
        // 直接数组格式: [...]
        models = data.map((m: any) => ({
          id: m.id || m.name || m || '',
          name: m.id || m.name || m || '',
        }));
      }

      // 过滤掉空值
      models = models.filter(m => m.id);

      setAvailableModels(models);
      setConnectionStatus('connected');
      setConnectionMessage(`成功获取 ${models.length} 个模型`);
    } catch (error) {
      console.error('获取模型失败:', error);
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : '连接失败');
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!tempSettings.apiBaseURL) {
      setConnectionMessage('请先输入 API 地址');
      return;
    }

    setConnectionStatus('testing');
    setConnectionMessage('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tempSettings.apiKey) {
        headers['Authorization'] = `Bearer ${tempSettings.apiKey}`;
      }

      // 对于 Minimax，使用简单的聊天请求来测试连接
      if (tempSettings.apiProvider === 'minimax') {
        const testUrl = `${tempSettings.apiBaseURL.replace(/\/$/, '')}/text/chatcompletion_v2`;
        console.log('测试 Minimax 连接 - 请求:', testUrl);
        
        const response = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: tempSettings.apiModel || 'abab7.5-chat',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        // Minimax 测试成功，设置预设模型列表
        const minimaxModels = [
          { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7-highspeed (极速版 100tps)' },
          { id: 'MiniMax-M2.7', name: 'MiniMax-M2.7 (自我迭代 60tps)' },
          { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed (极速版 100tps)' },
          { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5 (顶尖性能 60tps)' },
          { id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed (极速版 100tps)' },
          { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1 (多语言编程 60tps)' },
          { id: 'MiniMax-M2', name: 'MiniMax-M2 (高效编码/Agent)' },
        ];
        setAvailableModels(minimaxModels);
        setConnectionStatus('connected');
        setConnectionMessage('Minimax 连接成功！');
        return;
      }

      // 对于其他提供商，继续使用 models 端点
      // 构建 models 端点 URL，自动处理 /v1 路径
      const testBaseUrl = tempSettings.apiBaseURL.replace(/\/$/, '');
      const testModelsUrl = testBaseUrl.endsWith('/v1') 
        ? `${testBaseUrl}/models` 
        : `${testBaseUrl}/v1/models`;
      
      console.log('测试连接 - 请求:', testModelsUrl);
      
      // 尝试获取模型列表来测试连接
      const response = await fetch(testModelsUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setConnectionStatus('connected');
      
      // 同时获取模型列表
      const data = await response.json();
      console.log('连接测试 - 模型列表响应:', data);
      
      // 支持多种响应格式
      let models: { id: string; name: string }[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        models = data.data.map((m: any) => ({
          id: m.id || m.name || '',
          name: m.id || m.name || '',
        }));
      } else if (data.models && Array.isArray(data.models)) {
        models = data.models.map((m: any) => ({
          id: m.id || m.name || m || '',
          name: m.id || m.name || m || '',
        }));
      } else if (Array.isArray(data)) {
        models = data.map((m: any) => ({
          id: m.id || m.name || m || '',
          name: m.id || m.name || m || '',
        }));
      }
      
      models = models.filter(m => m.id);
      setAvailableModels(models);
      setConnectionMessage(`连接成功，获取 ${models.length} 个模型`);
    } catch (error) {
      console.error('连接测试失败:', error);
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : '连接失败');
    }
  };

  const getAllChatSessions = () => {
    return storage.getAllChatSessions();
  };

  const getAllCharacterHistories = () => {
    return storage.getAllCharacterHistories();
  };

  const handleSyncToGist = async () => {
    // 使用 tempSettings 中的值，这样用户修改后可以立即同步
    const currentSettings = { ...apiSettings, ...tempSettings };

    if (!currentSettings.gistToken) {
      setSyncError('请先配置 GitHub Token');
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(currentSettings.gistToken, currentSettings.gistId);
      const chatSessions = getAllChatSessions();
      const characterHistories = getAllCharacterHistories();
      const currentHistoryIds = storage.getAllCurrentHistoryIds();
      const characterGroups = storage.getCharacterGroups();
      const meetings = meetingStorage.getMeetings();
      const memos = memoStorage.getMemos();
      const data = gistSyncService.prepareSyncData(characters, chatSessions, characterHistories, currentHistoryIds, characterGroups, meetings, memos, currentSettings);

      let gistId: string | null = currentSettings.gistId;
      if (!gistId) {
        gistId = await gistSyncService.createGist(data);
        if (gistId) {
          const newSettings = { ...currentSettings, gistId };
          setApiSettings(newSettings);
          setTempSettings(newSettings);
          localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
        }
      } else {
        await gistSyncService.updateGist(data);
      }

      if (gistId) {
        setSyncMessage('同步成功！');
        setTimeout(() => setSyncMessage(''), 3000);
      }
    } catch (error: any) {
      setSyncError(error.message || '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromGist = async () => {
    // 使用 tempSettings 中的值
    const currentSettings = { ...apiSettings, ...tempSettings };
    
    if (!currentSettings.gistToken || !currentSettings.gistId) {
      setSyncError('请先配置 GitHub Token 和 Gist ID');
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(currentSettings.gistToken, currentSettings.gistId);
      const data = await gistSyncService.fetchGist();

      if (data && (data.characters || data.settings || data.chatSessions || data.characterHistories || data.meetings || data.memos)) {
        const hasCharacters = data.characters && data.characters.length > 0;
        const hasSettings = data.settings && Object.keys(data.settings).length > 0;
        const hasChatSessions = data.chatSessions && Object.keys(data.chatSessions).length > 0;
        const hasHistories = data.characterHistories && Object.keys(data.characterHistories).length > 0;
        const hasCurrentHistoryIds = data.currentHistoryIds && Object.keys(data.currentHistoryIds).length > 0;
        const hasMeetings = data.meetings && data.meetings.length > 0;
        const hasMemos = data.memos && data.memos.length > 0;

        let message = '找到数据，是否恢复？';
        const parts: string[] = [];
        if (hasCharacters) parts.push(`${data.characters.length} 个角色`);
        if (hasMeetings) parts.push(`${data.meetings.length} 个会议`);
        if (hasMemos) parts.push(`${data.memos.length} 条备忘录`);
        if (hasHistories) parts.push('历史记录');
        if (hasChatSessions) parts.push('当前会话');
        if (hasSettings) parts.push('设置');
        if (parts.length > 0) {
          message = `找到 ${parts.join('、')}，是否恢复？`;
        }

        if (confirm(message)) {
          if (hasCharacters) {
            // 清空现有角色，但使用原始ID保存新角色，以保持与聊天记录的关联
            characters.forEach(c => deleteCharacter(c.id));
            data.characters.forEach((c: Character) => {
              // 直接使用 storage.saveCharacter 保留原始 ID
              storage.saveCharacter(c);
            });
          }

          // 恢复分组数据
          if (data.characterGroups && data.characterGroups.length > 0) {
            data.characterGroups.forEach((g: CharacterGroup) => {
              storage.saveCharacterGroup(g);
            });
          }

          // 恢复历史记录（重要！）
          if (hasHistories && data.characterHistories) {
            storage.saveAllCharacterHistories(data.characterHistories);
          }

          // 恢复当前历史会话ID（关键！让聊天记录回到正确位置）
          if (hasCurrentHistoryIds && data.currentHistoryIds) {
            storage.saveAllCurrentHistoryIds(data.currentHistoryIds);
          }

          // 恢复当前会话
          if (hasChatSessions && data.chatSessions) {
            Object.values(data.chatSessions).forEach((session: any) => {
              storage.saveChatSession(session);
            });
          }

          // 恢复会议记录
          if (hasMeetings && data.meetings) {
            meetingStorage.saveMeetings(data.meetings);
          }

          // 恢复备忘录
          if (hasMemos && data.memos) {
            memoStorage.saveMemos(data.memos);
          }

          if (hasSettings) {
            // 保留本地的敏感信息（Token 等），只恢复其他设置
            const restoredSettings = {
              ...DEFAULT_SETTINGS,
              ...data.settings,
              apiKey: currentSettings.apiKey,      // 保留本地 API Key
              gistToken: currentSettings.gistToken, // 保留本地 GitHub Token
            };
            setApiSettings(restoredSettings);
            setTempSettings(restoredSettings);
            localStorage.setItem('ai_app_settings', JSON.stringify(restoredSettings));
          }

          setSyncMessage('恢复成功！');
          setTimeout(() => setSyncMessage(''), 3000);
          // 刷新页面以加载分组数据
          window.location.reload();
        }
      }
    } catch (error: any) {
      setSyncError(error.message || '恢复失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const chatSessions = getAllChatSessions();
    const characterHistories = getAllCharacterHistories();
    const currentHistoryIds = storage.getAllCurrentHistoryIds();
    const characterGroups = storage.getCharacterGroups();
    const meetings = meetingStorage.getMeetings();
    const memos = memoStorage.getMemos();
    const data = gistSyncService.exportFullData(characters, chatSessions, characterHistories, currentHistoryIds, characterGroups, meetings, memos, apiSettings);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `san-da-tong-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSyncMessage('导出成功！');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 获取当前设置，用于保留敏感信息
    const currentSettings = { ...apiSettings, ...tempSettings };

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const data = gistSyncService.importData(content);

      if (data && (data.characters || data.chatSessions || data.settings || data.characterGroups || data.meetings || data.memos)) {
        const hasCharacters = data.characters && data.characters.length > 0;
        const hasChatSessions = data.chatSessions && Object.keys(data.chatSessions).length > 0;
        const hasHistories = data.characterHistories && Object.keys(data.characterHistories).length > 0;
        const hasCurrentHistoryIds = data.currentHistoryIds && Object.keys(data.currentHistoryIds).length > 0;
        const hasSettings = data.settings && Object.keys(data.settings).length > 0;
        const hasGroups = data.characterGroups && data.characterGroups.length > 0;
        const hasMeetings = data.meetings && data.meetings.length > 0;
        const hasMemos = data.memos && data.memos.length > 0;

        let message = '找到数据，是否导入？';
        const parts: string[] = [];
        if (hasCharacters) parts.push(`${data.characters.length} 个角色`);
        if (hasGroups) parts.push(`${data.characterGroups.length} 个分组`);
        if (hasMeetings) parts.push(`${data.meetings.length} 个会议`);
        if (hasMemos) parts.push(`${data.memos.length} 条备忘录`);
        if (hasHistories) parts.push('历史记录');
        if (hasChatSessions) parts.push('当前会话');
        if (hasSettings) parts.push('设置');
        if (parts.length > 0) {
          message = `找到 ${parts.join('、')}，是否导入？`;
        }

        if (confirm(message)) {
          // 先恢复分组
          if (hasGroups) {
            data.characterGroups.forEach((g: CharacterGroup) => {
              storage.saveCharacterGroup(g);
            });
          }

          if (hasCharacters) {
            data.characters.forEach((c: Character) => {
              // 直接使用 storage.saveCharacter 保留原始 ID
              storage.saveCharacter(c);
            });
          }

          // 恢复历史记录
          if (hasHistories && data.characterHistories) {
            storage.saveAllCharacterHistories(data.characterHistories);
          }

          // 恢复当前历史会话ID（关键！让聊天记录回到正确位置）
          if (hasCurrentHistoryIds && data.currentHistoryIds) {
            storage.saveAllCurrentHistoryIds(data.currentHistoryIds);
          }

          if (hasChatSessions && data.chatSessions) {
            Object.values(data.chatSessions).forEach((session: any) => {
              storage.saveChatSession(session);
            });
          }

          // 恢复会议记录
          if (hasMeetings && data.meetings) {
            meetingStorage.saveMeetings(data.meetings);
          }

          // 恢复备忘录
          if (hasMemos && data.memos) {
            memoStorage.saveMemos(data.memos);
          }

          if (hasSettings) {
            // 保留本地的敏感信息（Token 等），只恢复其他设置
            const restoredSettings = {
              ...DEFAULT_SETTINGS,
              ...data.settings,
              apiKey: currentSettings.apiKey,      // 保留本地 API Key
              gistToken: currentSettings.gistToken, // 保留本地 GitHub Token
            };
            setApiSettings(restoredSettings);
            setTempSettings(restoredSettings);
            localStorage.setItem('ai_app_settings', JSON.stringify(restoredSettings));
          }

          setSyncMessage('导入成功！');
          setTimeout(() => setSyncMessage(''), 3000);
          window.location.reload();
        }
      } else {
        setSyncError('导入的文件格式不正确');
        setTimeout(() => setSyncError(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddCharacter = (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    addCharacter(characterData);
    setShowForm(false);
  };

  const handleUpdateCharacter = (characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCharacter) {
      updateCharacter(editingCharacter.id, characterData);
      setEditingCharacter(undefined);
    }
  };

  const handleDeleteCharacter = (id: string) => {
    if (confirm('确定要删除这个角色吗？')) {
      deleteCharacter(id);
    }
  };

  const openEditForm = (character: Character) => {
    setEditingCharacter(character);
    setShowForm(true);
    setShowMoreMenu(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCharacter(undefined);
  };

  const filteredCharacters = useMemo(() => {
    if (!searchKeyword) return characters;
    return searchByPinyin(characters, c => c.name, searchKeyword);
  }, [characters, searchKeyword]);

  const getLastMessage = (characterId: string) => {
    const session = characters.length > 0 ? storage.getChatSession(characterId) : { messages: [] };
    if (session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      const content = lastMsg.content.replace(/\n/g, ' ');
      return content.length > 20 ? content.slice(0, 20) + '...' : content;
    }
    return '';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diff < 604800000) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return weekdays[date.getDay()];
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const getLastMessageTime = (characterId: string) => {
    const session = characters.length > 0 ? storage.getChatSession(characterId) : { messages: [] };
    if (session.messages.length > 0) {
      return formatTime(session.messages[session.messages.length - 1].timestamp);
    }
    return '';
  };

  const hasApiKey = !!apiSettings.apiKey;

  // 关闭更多菜单当点击外部时
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = () => setShowMoreMenu(false);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, { once: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showMoreMenu]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDEDED]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#07C160] rounded-full animate-spin" />
          <div className="text-gray-500 text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#EDEDED] flex flex-col"
      onClick={() => setContextMenuCharacter(null)}
    >
      {/* 顶部导航栏 */}
      <header className="bg-[#EDEDED] border-b border-gray-300 flex items-center justify-between px-4 h-14 shrink-0">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <button onClick={() => { setShowSearch(false); setSearchKeyword(''); }} className="p-1">
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <input
              type="text"
              autoFocus
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索"
              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm outline-none"
            />
          </div>
        ) : (
          <>
            <div className="flex-1" />
            <h1 className="text-lg font-semibold text-gray-900">
              {activeTab === 'wechat' && '微信'}
              {activeTab === 'contacts' && '通讯录'}
              {activeTab === 'discover' && '发现'}
              {activeTab === 'me' && '我'}
            </h1>
            <div className="flex items-center gap-2">
              {activeTab === 'wechat' && (
                <button onClick={() => setShowSearch(true)} className="p-1.5 hover:bg-gray-200 rounded-full">
                  <Search className="w-5 h-5 text-gray-700" />
                </button>
              )}
              {(activeTab === 'wechat' || activeTab === 'contacts') && (
                <div className="relative">
                  <button 
                    onClick={() => setShowMoreMenu(!showMoreMenu)} 
                    className="p-1.5 hover:bg-gray-200 rounded-full"
                  >
                    <Plus className="w-5 h-5 text-gray-700" />
                  </button>
                  {showMoreMenu && (
                    <div className="absolute right-0 top-10 bg-white rounded-md shadow-xl py-1 min-w-[140px] z-50">
                      {activeTab === 'wechat' && (
                        <button 
                          onClick={() => { setShowForm(true); setShowMoreMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          发起群聊
                        </button>
                      )}
                      <button 
                        onClick={() => { setShowForm(true); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        {activeTab === 'wechat' ? '添加朋友' : '添加角色'}
                      </button>
                      <button 
                        onClick={() => { setShowSettings(true); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        扫一扫
                      </button>
                      <button 
                        onClick={() => { setShowSettings(true); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        收付款
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'wechat' && (
          <div className="h-full overflow-y-auto">
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-20 px-4">
                <p className="text-gray-500 text-sm">暂无角色</p>
                <button 
                  onClick={() => setShowForm(true)}
                  className="mt-4 px-6 py-2 bg-[#07C160] text-white rounded-md text-sm"
                >
                  添加角色
                </button>
              </div>
            ) : (
              filteredCharacters.map((character) => {
                const lastMsg = getLastMessage(character.id);
                const lastTime = getLastMessageTime(character.id);
                return (
                  <div
                    key={character.id}
                    onClick={() => setChattingCharacter(character)}
                    className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 active:bg-gray-100 cursor-pointer"
                  >
                    <Avatar
                      src={character.avatar}
                      name={character.name}
                      size="md"
                      borderColor="ring-2 ring-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-base font-normal text-gray-900 truncate">{character.name}</h3>
                        {lastTime && (
                          <span className="text-xs text-gray-400 shrink-0 ml-2">{lastTime}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {lastMsg || character.description || '暂无消息'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="h-full overflow-y-auto">
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-20 px-4">
                <p className="text-gray-500 text-sm">暂无角色</p>
                <button 
                  onClick={() => setShowForm(true)}
                  className="mt-4 px-6 py-2 bg-[#07C160] text-white rounded-md text-sm"
                >
                  添加角色
                </button>
              </div>
            ) : (
              <>
                {/* 新的朋友 */}
                <div 
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 active:bg-gray-100 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-[#07C160] rounded-lg flex items-center justify-center shrink-0">
                    <PlusIcon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-base text-gray-900">新的朋友</span>
                </div>
                
                {/* 分组管理入口 */}
                <div 
                  onClick={() => setShowGroupManager(true)}
                  className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 active:bg-gray-100 cursor-pointer"
                >
                  <div className="w-11 h-11 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-base text-gray-900">分组管理</span>
                  <span className="ml-auto text-xs text-gray-400">{groups.length}个分组</span>
                </div>
                
                {/* 按分组显示角色 */}
                {groups.map(group => {
                  const groupCharacters = filteredCharacters.filter(c => c.group === group.id);
                  if (groupCharacters.length === 0) return null;
                  const isExpanded = expandedGroups.has(group.id);
                  
                  return (
                    <div key={group.id} className="bg-white">
                      {/* 分组标题 */}
                      <div 
                        onClick={() => {
                          setExpandedGroups(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(group.id)) {
                              newSet.delete(group.id);
                            } else {
                              newSet.add(group.id);
                            }
                            return newSet;
                          });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{group.name}</span>
                        <span className="text-xs text-gray-400">({groupCharacters.length})</span>
                        <span className={`ml-auto text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                      </div>
                      
                      {/* 分组下的角色 */}
                      {isExpanded && groupCharacters.map(character => (
                        <div key={character.id} className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 pl-8">
                          <Avatar
                            src={character.avatar}
                            name={character.name}
                            size="md"
                            borderColor="ring-2 ring-gray-100"
                          />
                          <div 
                            onClick={() => setChattingCharacter(character)}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="text-base text-gray-900">{character.name}</span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextMenuCharacter(contextMenuCharacter?.id === character.id ? null : character);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-full"
                            >
                              <MoreHorizontal className="w-5 h-5 text-gray-400" />
                            </button>
                            {contextMenuCharacter?.id === character.id && (
                              <div className="absolute right-0 top-10 bg-white rounded-md shadow-xl py-1 min-w-[160px] z-50">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCharacter(character);
                                    setShowForm(true);
                                    setContextMenuCharacter(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  编辑
                                </button>
                                {/* 分组选项 */}
                                <div className="border-t border-gray-100 my-1" />
                                <div className="px-4 py-2 text-xs text-gray-500">移动到分组</div>
                                {groups.map(g => (
                                  <button
                                    key={g.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updatedChar = { ...character, group: g.id };
                                      storage.saveCharacter(updatedChar);
                                      // 刷新角色列表
                                      window.location.reload();
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                      character.group === g.id 
                                        ? 'bg-blue-50 text-blue-600' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: g.color }}
                                    />
                                    {g.name}
                                    {character.group === g.id && <span className="ml-auto text-xs">✓</span>}
                                  </button>
                                ))}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedChar = { ...character, group: undefined };
                                    storage.saveCharacter(updatedChar);
                                    window.location.reload();
                                  }}
                                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                    !character.group 
                                      ? 'bg-blue-50 text-blue-600' 
                                      : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                                  未分组
                                  {!character.group && <span className="ml-auto text-xs">✓</span>}
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`确定要删除 ${character.name} 吗？`)) {
                                      deleteCharacter(character.id);
                                    }
                                    setContextMenuCharacter(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  删除
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                
                {/* 未分组角色 */}
                {filteredCharacters.filter(c => !c.group).length > 0 && (
                  <div className="bg-white">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="w-3 h-3 rounded-full bg-gray-400" />
                      <span className="text-sm font-medium text-gray-700">未分组</span>
                      <span className="text-xs text-gray-400">({filteredCharacters.filter(c => !c.group).length})</span>
                    </div>
                    {filteredCharacters.filter(c => !c.group).map(character => (
                      <div key={character.id} className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                        <Avatar
                          src={character.avatar}
                          name={character.name}
                          size="md"
                          borderColor="ring-2 ring-gray-100"
                        />
                        <div 
                          onClick={() => setChattingCharacter(character)}
                          className="flex-1 cursor-pointer"
                        >
                          <span className="text-base text-gray-900">{character.name}</span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenuCharacter(contextMenuCharacter?.id === character.id ? null : character);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-full"
                          >
                            <MoreHorizontal className="w-5 h-5 text-gray-400" />
                          </button>
                          {contextMenuCharacter?.id === character.id && (
                            <div className="absolute right-0 top-10 bg-white rounded-md shadow-xl py-1 min-w-[160px] z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCharacter(character);
                                  setShowForm(true);
                                  setContextMenuCharacter(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit3 className="w-4 h-4" />
                                编辑
                              </button>
                              {/* 分组选项 */}
                              <div className="border-t border-gray-100 my-1" />
                              <div className="px-4 py-2 text-xs text-gray-500">移动到分组</div>
                              {groups.map(g => (
                                <button
                                  key={g.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedChar = { ...character, group: g.id };
                                    storage.saveCharacter(updatedChar);
                                    window.location.reload();
                                  }}
                                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                    character.group === g.id 
                                      ? 'bg-blue-50 text-blue-600' 
                                      : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: g.color }}
                                  />
                                  {g.name}
                                  {character.group === g.id && <span className="ml-auto text-xs">✓</span>}
                                </button>
                              ))}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updatedChar = { ...character, group: undefined };
                                  storage.saveCharacter(updatedChar);
                                  window.location.reload();
                                }}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                  !character.group 
                                    ? 'bg-blue-50 text-blue-600' 
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full bg-gray-400" />
                                未分组
                                {!character.group && <span className="ml-auto text-xs">✓</span>}
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`确定要删除 ${character.name} 吗？`)) {
                                    deleteCharacter(character.id);
                                  }
                                  setContextMenuCharacter(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="h-full overflow-y-auto">
            <div className="space-y-2">
              <div className="bg-white">
                <div 
                  onClick={() => setShowMeetingRoom(true)}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-100 cursor-pointer"
                >
                  <div className="w-7 h-7 bg-[#07C160] rounded-lg flex items-center justify-center shrink-0">
                    <UsersRound className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900">会议室</span>
                  <span className="ml-auto text-xs text-gray-400">多角色讨论</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">朋友圈</span>
                </div>
              </div>
              <div className="bg-white">
                <div 
                  onClick={() => setShowTtsSettings(true)}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-100 cursor-pointer"
                >
                  <div className="w-7 h-7 bg-[#07C160] rounded-lg flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900">语音设置</span>
                  <span className="ml-auto text-xs text-gray-400">Edge TTS</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">扫一扫</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">摇一摇</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">看一看</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">搜一搜</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">附近</span>
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">购物</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">游戏</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'me' && (
          <div className="h-full overflow-y-auto">
            <div className="bg-white px-4 py-4 border-b border-gray-200 mb-2">
              <div className="flex items-center gap-4">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
                  alt="我"
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">我</h2>
                  <p className="text-sm text-gray-500">微信号：user</p>
                </div>
                <div className="p-2">
                  <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="bg-white">
                <div 
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-100"
                  onClick={() => setShowService(true)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                      <Folder className="w-6 h-6 text-yellow-500" />
                    </div>
                    <span className="text-base text-gray-900">服务</span>
                  </div>
                </div>
              </div>
              <div className="bg-white">
                <div 
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-100"
                  onClick={() => setShowSettings(true)}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-gray-700 shrink-0" />
                    <span className="text-base text-gray-900">设置</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 底部 Tab 栏 */}
      <nav className="bg-[#F7F7F7] border-t border-gray-300 flex items-center justify-around h-14 shrink-0 pb-safe">
        <button
          onClick={() => setActiveTab('wechat')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'wechat' ? 'text-[#07C160]' : 'text-gray-600'}`}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs mt-0.5">微信</span>
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'contacts' ? 'text-[#07C160]' : 'text-gray-600'}`}
        >
          <Users className="w-6 h-6" />
          <span className="text-xs mt-0.5">通讯录</span>
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'discover' ? 'text-[#07C160]' : 'text-gray-600'}`}
        >
          <Compass className="w-6 h-6" />
          <span className="text-xs mt-0.5">发现</span>
        </button>
        <button
          onClick={() => setActiveTab('me')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'me' ? 'text-[#07C160]' : 'text-gray-600'}`}
        >
          <User className="w-6 h-6" />
          <span className="text-xs mt-0.5">我</span>
        </button>
      </nav>

      {(syncMessage || syncError) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50">
          {syncMessage && (
            <div className="bg-green-500 text-white px-4 py-2 rounded-lg">{syncMessage}</div>
          )}
          {syncError && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-lg">{syncError}</div>
          )}
        </div>
      )}

      {saveSuccess && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          设置已保存
        </div>
      )}

      {showForm && (
        <CharacterForm
          character={editingCharacter}
          onSave={editingCharacter ? handleUpdateCharacter : handleAddCharacter}
          onCancel={closeForm}
          apiSettings={apiSettings}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">设置</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-sm">API配置</h4>
                
                {/* API提供商选择 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">API提供商</label>
                  <select
                    value={tempSettings.apiProvider}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiProvider: e.target.value as ApiProvider })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="gemini">Gemini (Google)</option>
                    <option value="ollama">Ollama (本地)</option>
                    <option value="minimax">Minimax (上海稀宇)</option>
                    <option value="local_proxy">本地 HTTP 反代服务</option>
                    <option value="custom">自定义</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {tempSettings.apiProvider === 'local_proxy' 
                      ? '连接到本地 HTTP 反代服务，如 SillyTavern 兼容的反代' 
                      : '选择API提供商，系统会自动适配对应的请求格式'}
                  </p>
                </div>

                {/* 本地 HTTP 反代服务特殊说明 */}
                {tempSettings.apiProvider === 'local_proxy' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    <p className="font-medium mb-1">本地 HTTP 反代服务</p>
                    <p className="text-xs">
                      用于连接 SillyTavern 或其他工具提供的本地反代服务。
                      支持 /v1/chat/completions 端点的 OpenAI 兼容格式。
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    {tempSettings.apiProvider === 'local_proxy' ? '反代密码/密钥 (可选)' : 'API密钥'}
                  </label>
                  <input
                    type="password"
                    value={tempSettings.apiKey}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder={
                      tempSettings.apiProvider === 'local_proxy' 
                        ? '如果反代服务需要密码，请在此输入' 
                        : tempSettings.apiProvider === 'ollama' 
                          ? '本地模型可不填' 
                          : tempSettings.apiProvider === 'minimax'
                          ? 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
                          : 'sk-...'
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    {tempSettings.apiProvider === 'local_proxy' ? '反代服务器 URL' : 'API基础URL'}
                  </label>
                  <input
                    type="text"
                    value={tempSettings.apiBaseURL}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiBaseURL: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder={
                      tempSettings.apiProvider === 'local_proxy' 
                        ? 'http://127.0.0.1:9998' 
                        : tempSettings.apiProvider === 'minimax'
                        ? 'https://api.minimax.chat/v1'
                        : 'https://api.openai.com/v1'
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {tempSettings.apiProvider === 'local_proxy' 
                      ? '输入本地反代服务的地址，例如 http://127.0.0.1:9998' 
                      : ''}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">最大 Token 数</label>
                  <input
                    type="number"
                    value={tempSettings.maxTokens}
                    onChange={(e) => setTempSettings({ ...tempSettings, maxTokens: parseInt(e.target.value) || 4000 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="4000"
                    min={1000}
                    max={32000}
                    step={1000}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    限制 AI 回复的最大长度，建议 4000-8000
                  </p>
                </div>
                {/* 连接测试和模型选择 */}
                <div className="flex gap-2">
                  <button
                    onClick={testConnection}
                    disabled={connectionStatus === 'testing'}
                    className="flex-1 px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {connectionStatus === 'testing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        测试中...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        测试连接
                      </>
                    )}
                  </button>
                </div>

                {/* 连接状态显示 */}
                {connectionStatus !== 'idle' && connectionMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    connectionStatus === 'connected' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : connectionStatus === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {connectionStatus === 'connected' && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                      {connectionStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                      {connectionStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {connectionMessage}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm text-gray-600">模型选择</label>
                    <button
                      onClick={fetchModels}
                      disabled={isLoadingModels || !tempSettings.apiBaseURL}
                      className="text-xs text-[#07C160] hover:text-[#06AD56] disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      {isLoadingModels ? '刷新中...' : '刷新模型'}
                    </button>
                  </div>
                  {availableModels.length > 0 ? (
                    <select
                      value={tempSettings.apiModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, apiModel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    >
                      <option value="">选择模型...</option>
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={tempSettings.apiModel}
                      onChange={(e) => setTempSettings({ ...tempSettings, apiModel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                      placeholder={
                        tempSettings.apiProvider === 'local_proxy' 
                          ? 'gemini-3.1-pro-preview' 
                          : tempSettings.apiProvider === 'minimax'
                          ? 'MiniMax-M2.7-highspeed'
                          : 'gpt-3.5-turbo'
                      }
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-sm">语音设置</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">语音朗读</span>
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, voiceEnabled: !tempSettings.voiceEnabled })}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      tempSettings.voiceEnabled ? 'bg-[#07C160]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      tempSettings.voiceEnabled ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">语音输入</span>
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, voiceInputEnabled: !tempSettings.voiceInputEnabled })}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      tempSettings.voiceInputEnabled ? 'bg-[#07C160]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                      tempSettings.voiceInputEnabled ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>
                {tempSettings.voiceEnabled && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">声音选择</label>
                      <select
                        value={tempSettings.voiceURI}
                        onChange={(e) => setTempSettings({ ...tempSettings, voiceURI: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                      >
                        <option value="">默认声音</option>
                        {availableVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">
                        音量: {Math.round(tempSettings.voiceVolume * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={tempSettings.voiceVolume}
                        onChange={(e) => setTempSettings({ ...tempSettings, voiceVolume: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">
                        语速: {tempSettings.voiceRate.toFixed(1)}x
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={tempSettings.voiceRate}
                        onChange={(e) => setTempSettings({ ...tempSettings, voiceRate: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">
                        音调: {tempSettings.voicePitch.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={tempSettings.voicePitch}
                        onChange={(e) => setTempSettings({ ...tempSettings, voicePitch: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-sm">外观设置</h4>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">聊天背景</label>
                  {tempSettings.backgroundImage ? (
                    <div className="space-y-2">
                      <div className="w-full h-24 rounded-lg overflow-hidden border border-gray-300">
                        <img
                          src={tempSettings.backgroundImage}
                          alt="背景预览"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <label className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm text-center cursor-pointer">
                          更换图片
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  setTempSettings({ ...tempSettings, backgroundImage: result });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => setTempSettings({ ...tempSettings, backgroundImage: '' })}
                          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm"
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-[#07C160] hover:bg-gray-50">
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-6 h-6 text-gray-400" />
                        <span className="text-sm text-gray-500">点击上传背景图片</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setTempSettings({ ...tempSettings, backgroundImage: result });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-sm">数据同步</h4>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">GitHub Token</label>
                  <input
                    type="password"
                    value={tempSettings.gistToken}
                    onChange={(e) => setTempSettings({ ...tempSettings, gistToken: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="ghp_..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">Gist ID</label>
                  <input
                    type="text"
                    value={tempSettings.gistId}
                    onChange={(e) => setTempSettings({ ...tempSettings, gistId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="可选"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncToGist}
                    disabled={isSyncing}
                    className="flex-1 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] disabled:opacity-50 text-sm"
                  >
                    {isSyncing ? '同步中...' : '同步到云端'}
                  </button>
                  <button
                    onClick={handleRestoreFromGist}
                    disabled={isSyncing}
                    className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
                  >
                    从云端恢复
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  导出备份
                </button>
                <label className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm text-center cursor-pointer">
                  导入备份
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {chattingCharacter && (
        <ChatInterface
          character={chattingCharacter}
          onClose={() => setChattingCharacter(undefined)}
        />
      )}

      {showMeetingRoom && (
        <MeetingRoom
          characters={characters}
          onClose={() => setShowMeetingRoom(false)}
        />
      )}

      {/* 分组管理弹窗 */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">分组管理</h3>
              <button
                onClick={() => setShowGroupManager(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 新建分组 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">新建分组</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="newGroupName"
                  placeholder="分组名称"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="color"
                  id="newGroupColor"
                  defaultValue="#3B82F6"
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <button
                  onClick={() => {
                    const nameInput = document.getElementById('newGroupName') as HTMLInputElement;
                    const colorInput = document.getElementById('newGroupColor') as HTMLInputElement;
                    const name = nameInput.value.trim();
                    if (name) {
                      const newGroup: CharacterGroup = {
                        id: Date.now().toString(),
                        name,
                        color: colorInput.value,
                        createdAt: Date.now(),
                      };
                      storage.saveCharacterGroup(newGroup);
                      setGroups(storage.getCharacterGroups());
                      nameInput.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-[#07C160] text-white rounded-lg text-sm hover:bg-[#06AD56]"
                >
                  添加
                </button>
              </div>
            </div>

            {/* 分组列表 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">现有分组</h4>
              {groups.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">暂无分组</p>
              ) : (
                groups.map(group => {
                  const groupChars = characters.filter(c => c.group === group.id);
                  return (
                    <div key={group.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="flex-1 text-sm">{group.name}</span>
                      <span className="text-xs text-gray-400">{groupChars.length}人</span>
                      <button
                        onClick={() => {
                          if (confirm(`确定要删除分组"${group.name}"吗？分组内的角色将变为未分组。`)) {
                            storage.deleteCharacterGroup(group.id);
                            setGroups(storage.getCharacterGroups());
                          }
                        }}
                        className="p-1.5 hover:bg-red-100 rounded-full text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* 角色分组设置 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">设置角色分组</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {characters.map(character => (
                  <div key={character.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <Avatar
                      src={character.avatar}
                      name={character.name}
                      size="sm"
                    />
                    <span className="flex-1 text-sm">{character.name}</span>
                    <select
                      value={character.group || ''}
                      onChange={(e) => {
                        const updatedChar = { ...character, group: e.target.value || undefined };
                        storage.saveCharacter(updatedChar);
                        // 触发重新加载
                        window.location.reload();
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">未分组</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGroupManager(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 服务 - 备忘录风格页面 */}
      {showService && (
        <div className="fixed inset-0 bg-[#F2F2F6] z-50 flex flex-col">
          {/* 顶部导航 */}
          <div className="bg-[#F2F2F6] px-4 pt-12 pb-2">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (serviceView === 'notes') {
                    setServiceView('folders');
                    setSelectedFolder(null);
                  } else {
                    setShowService(false);
                  }
                }}
                className="flex items-center gap-1 text-[#007AFF] text-base"
              >
                {serviceView === 'folders' ? (
                  <>
                    <ChevronLeft className="w-5 h-5" />
                    <span>返回</span>
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-5 h-5" />
                    <span>文件夹</span>
                  </>
                )}
              </button>
              <div className="flex items-center gap-3">
                {serviceView === 'folders' ? (
                  <>
                    <button className="p-2">
                      <Folder className="w-6 h-6 text-[#FF9500]" />
                    </button>
                    <span className="text-base font-medium text-gray-900">文件夹</span>
                    <button className="px-3 py-1 text-[#007AFF] text-base font-medium">
                      编辑
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-bold text-gray-900">备忘录</span>
                    <button className="p-2">
                      <MoreHorizontal className="w-6 h-6 text-[#007AFF]" />
                    </button>
                  </>
                )}
              </div>
              <div className="w-16" />
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto px-4">
            {serviceView === 'folders' ? (
              /* 文件夹列表 */
              <div className="space-y-4">
                {/* iCloud 区域 */}
                <div>
                  <h2 className="text-sm font-medium text-gray-500 mb-2 ml-2">iCloud</h2>
                  <div className="bg-white rounded-xl overflow-hidden">
                    <div
                      onClick={() => {
                        setSelectedFolder('memo');
                        setServiceView('notes');
                      }}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="w-7 h-7 text-[#FF9500]" />
                        <span className="text-base text-gray-900">备忘录</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-base">{memos.length}</span>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 我的账户区域 */}
                <div>
                  <h2 className="text-sm font-medium text-gray-500 mb-2 ml-2">我的账户</h2>
                  <div className="bg-white rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-base text-gray-900">角色</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-base">{characters.length}</span>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                          <UsersRound className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-base text-gray-900">会议室</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-base">{meetingStorage.getMeetings().length}</span>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 备忘录列表 */
              <div className="space-y-2">
                {filteredMemos.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <p className="text-base">{serviceSearchQuery ? '没有找到匹配的备忘录' : '暂无备忘录'}</p>
                    <p className="text-sm mt-2">在聊天时长按消息即可收藏</p>
                  </div>
                ) : (
                  filteredMemos.map((memo, index) => (
                    <div
                      key={memo.id}
                      className="bg-white rounded-xl px-4 py-3 cursor-pointer active:bg-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-[#007AFF] text-sm font-medium shrink-0">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-base text-gray-900 line-clamp-3">{memo.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {memo.characterAvatar && (
                              <img 
                                src={memo.characterAvatar} 
                                alt={memo.characterName}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            )}
                            <span className="text-xs text-gray-500">{memo.characterName}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(memo.timestamp).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定要删除这条备忘录吗？')) {
                              memoStorage.deleteMemo(memo.id);
                              setMemos(memos.filter(m => m.id !== memo.id));
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 底部搜索栏 */}
          <div className="bg-[#F2F2F6] px-4 pb-8 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white rounded-xl flex items-center gap-2 px-3 py-2.5">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索"
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-gray-400"
                />
                <button className="p-1">
                  <Mic className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <button 
                onClick={() => setShowForm(true)}
                className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm"
              >
                <Edit className="w-5 h-5 text-[#007AFF]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TTS 设置弹窗 */}
      {showTtsSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">语音设置</h3>
              <button
                onClick={() => setShowTtsSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Edge TTS 开关 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900">使用 Edge TTS</div>
                  <div className="text-xs text-gray-500">
                    {ttsConfig.useEdgeTTS ? '使用微软 Edge 语音' : '使用系统默认语音'}
                  </div>
                </div>
                <button
                  onClick={() => setTtsConfig({ ...ttsConfig, useEdgeTTS: !ttsConfig.useEdgeTTS })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    ttsConfig.useEdgeTTS ? 'bg-[#07C160]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      ttsConfig.useEdgeTTS ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Edge TTS 配置 */}
              {ttsConfig.useEdgeTTS && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edge TTS 代理 URL
                    </label>
                    <input
                      type="text"
                      value={ttsConfig.edgeTtsUrl || ''}
                      onChange={(e) => setTtsConfig({ ...ttsConfig, edgeTtsUrl: e.target.value })}
                      placeholder="https://yytts.zeabur.app/tts"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#07C160]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      使用您在 Zeabur 部署的 Edge TTS 服务地址
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">声音选择</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                      {EDGE_TTS_VOICES.map((voice) => (
                        <label
                          key={voice.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            ttsConfig.edgeTtsVoice === voice.id
                              ? voice.gender === 'female' ? 'bg-pink-50' : 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="edge-voice"
                            value={voice.id}
                            checked={ttsConfig.edgeTtsVoice === voice.id}
                            onChange={() => setTtsConfig({ ...ttsConfig, edgeTtsVoice: voice.id })}
                            className={`w-4 h-4 ${voice.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{voice.name}</div>
                            <div className="text-xs text-gray-500">{voice.desc}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            voice.gender === 'female' 
                              ? 'bg-pink-100 text-pink-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {voice.gender === 'female' ? '女声' : '男声'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 保存按钮 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowTtsSettings(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    saveTtsConfig(ttsConfig);
                    setShowTtsSettings(false);
                  }}
                  className="flex-1 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56]"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
