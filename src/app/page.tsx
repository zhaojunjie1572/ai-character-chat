'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Users, Compass, User, Plus, Search, 
  MoreHorizontal, X, Settings, Key, Sparkles, 
  Volume2, Cloud, Download, Upload, RefreshCw, 
  Check, AlertCircle, Trash2, Edit3, Smile, Plus as PlusIcon
} from 'lucide-react';
import { useCharacters } from '@/hooks/useCharacters';
import { CharacterForm } from '@/components/CharacterForm';
import { ChatInterface } from '@/components/ChatInterface';
import { Character } from '@/types/character';
import { gistSyncService } from '@/lib/gistSync';
import { searchByPinyin } from '@/lib/pinyin';

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
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

  const handleSaveSettings = () => {
    localStorage.setItem('ai_app_settings', JSON.stringify(tempSettings));
    setApiSettings(tempSettings);
    setShowSettings(false);
    setShowMoreMenu(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSyncToGist = async () => {
    if (!apiSettings.gistToken) {
      setSyncError('请先配置 GitHub Token');
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(apiSettings.gistToken, apiSettings.gistId);
      const data = gistSyncService.prepareSyncData(characters, apiSettings);
      
      let gistId: string | null = apiSettings.gistId;
      if (!gistId) {
        gistId = await gistSyncService.createGist(data);
        if (gistId) {
          const newSettings = { ...apiSettings, gistId };
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
    } catch (error) {
      setSyncError('同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromGist = async () => {
    if (!apiSettings.gistToken || !apiSettings.gistId) {
      setSyncError('请先配置 GitHub Token 和 Gist ID');
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(apiSettings.gistToken, apiSettings.gistId);
      const data = await gistSyncService.fetchGist();

      if (data && data.characters) {
        if (confirm(`找到 ${data.characters.length} 个角色，是否恢复？`)) {
          characters.forEach(c => deleteCharacter(c.id));
          data.characters.forEach((c: Character) => {
            addCharacter({
              name: c.name,
              title: c.title,
              description: c.description,
              avatar: c.avatar,
              systemPrompt: c.systemPrompt,
            });
          });
          setSyncMessage('恢复成功！');
          setTimeout(() => setSyncMessage(''), 3000);
        }
      }
    } catch (error) {
      setSyncError('恢复失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const data = gistSyncService.exportFullData(characters, apiSettings);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-character-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const data = gistSyncService.importData(content);

      if (data && data.characters) {
        if (confirm(`找到 ${data.characters.length} 个角色，是否导入？`)) {
          data.characters.forEach((c: Character) => {
            addCharacter({
              name: c.name,
              title: c.title,
              description: c.description,
              avatar: c.avatar,
              systemPrompt: c.systemPrompt,
            });
          });
          setSyncMessage('导入成功！');
          setTimeout(() => setSyncMessage(''), 3000);
        }
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

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDEDED]">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEDED] flex flex-col">
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
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0"
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
                <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                  <div className="w-11 h-11 bg-[#07C160] rounded-lg flex items-center justify-center shrink-0">
                    <PlusIcon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-base text-gray-900">新的朋友</span>
                </div>
                {filteredCharacters.map((character) => (
                  <div
                    key={character.id}
                    onClick={() => setChattingCharacter(character)}
                    className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 active:bg-gray-100 cursor-pointer"
                  >
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0"
                    />
                    <span className="text-base text-gray-900">{character.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="h-full overflow-y-auto">
            <div className="space-y-2">
              <div className="bg-white">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="w-7 h-7 shrink-0" />
                  <span className="text-base text-gray-900">朋友圈</span>
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
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 shrink-0" />
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
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">API密钥</label>
                  <input
                    type="password"
                    value={tempSettings.apiKey}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">API基础URL</label>
                  <input
                    type="text"
                    value={tempSettings.apiBaseURL}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiBaseURL: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">模型</label>
                  <input
                    type="text"
                    value={tempSettings.apiModel}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiModel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] text-sm"
                    placeholder="gpt-3.5-turbo"
                  />
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
    </div>
  );
}
