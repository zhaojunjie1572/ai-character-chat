'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Settings, Key, Sparkles, MessageSquare, Trash2, Edit3, Volume2, Cloud, Download, Upload, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useCharacters } from '@/hooks/useCharacters';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterForm } from '@/components/CharacterForm';
import { ChatInterface } from '@/components/ChatInterface';
import { Character } from '@/types/character';
import { gistSyncService, SyncData } from '@/lib/gistSync';

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
  backgroundImage: string;
  // 语音设置
  voiceURI: string;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  // Gist 同步设置
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

export default function Home() {
  const { characters, isLoaded, addCharacter, updateCharacter, deleteCharacter, getCharacters } = useCharacters();
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [chattingCharacter, setChattingCharacter] = useState<Character | undefined>();
  const [apiSettings, setApiSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [tempApiSettings, setTempApiSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Gist 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [showGistSetup, setShowGistSetup] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      setApiSettings(settings);
      setTempApiSettings(settings);
    }

    // 加载可用语音
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const chineseVoices = voices.filter(v => v.lang.includes('zh'));
      setAvailableVoices(chineseVoices.length > 0 ? chineseVoices : voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSaveApiSettings = () => {
    localStorage.setItem('ai_app_settings', JSON.stringify(tempApiSettings));
    setApiSettings(tempApiSettings);
    setShowApiSettings(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // 同步到 Gist
  const handleSyncToGist = async () => {
    if (!apiSettings.gistToken) {
      setSyncError('请先配置 GitHub Token');
      setShowGistSetup(true);
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(apiSettings.gistToken, apiSettings.gistId);
      
      const data = gistSyncService.prepareSyncData(characters, apiSettings);
      
      let gistId = apiSettings.gistId;
      if (!gistId) {
        // 创建新 Gist
        gistId = await gistSyncService.createGist(data);
        if (gistId) {
          const newSettings = { ...apiSettings, gistId };
          setApiSettings(newSettings);
          setTempApiSettings(newSettings);
          localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
        }
      } else {
        // 更新现有 Gist
        await gistSyncService.updateGist(data);
      }

      if (gistId) {
        setSyncMessage('同步成功！数据已保存到 GitHub Gist');
        setTimeout(() => setSyncMessage(''), 3000);
      } else {
        setSyncError('同步失败，请检查 Token 是否有效');
      }
    } catch (error) {
      setSyncError('同步过程中出现错误');
    } finally {
      setIsSyncing(false);
    }
  };

  // 从 Gist 恢复
  const handleRestoreFromGist = async () => {
    if (!apiSettings.gistToken || !apiSettings.gistId) {
      setSyncError('请先配置 GitHub Token 和 Gist ID');
      setShowGistSetup(true);
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncMessage('');

    try {
      gistSyncService.setConfig(apiSettings.gistToken, apiSettings.gistId);
      const data = await gistSyncService.fetchGist();

      if (data) {
        // 恢复角色
        if (data.characters && data.characters.length > 0) {
          if (confirm(`找到 ${data.characters.length} 个角色，是否恢复？这将覆盖本地现有角色。`)) {
            // 清除现有角色并恢复
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
          }
        }

        // 恢复设置（保留 API Key）
        if (data.settings) {
          const newSettings = {
            ...apiSettings,
            ...data.settings,
            apiKey: apiSettings.apiKey, // 保留本地 API Key
            gistToken: apiSettings.gistToken,
            gistId: apiSettings.gistId,
          };
          setApiSettings(newSettings);
          setTempApiSettings(newSettings);
          localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
        }

        setSyncMessage('恢复成功！数据已从 GitHub Gist 恢复');
        setTimeout(() => setSyncMessage(''), 3000);
      } else {
        setSyncError('恢复失败，请检查 Gist ID 是否正确');
      }
    } catch (error) {
      setSyncError('恢复过程中出现错误');
    } finally {
      setIsSyncing(false);
    }
  };

  // 导出数据到文件
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

  // 从文件导入
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const data = gistSyncService.importData(content);

      if (data) {
        if (confirm(`找到 ${data.characters.length} 个角色，是否导入？`)) {
          // 导入角色
          data.characters.forEach((c: Character) => {
            addCharacter({
              name: c.name,
              title: c.title,
              description: c.description,
              avatar: c.avatar,
              systemPrompt: c.systemPrompt,
            });
          });

          // 导入设置（保留敏感信息）
          if (data.settings) {
            const newSettings = {
              ...apiSettings,
              ...data.settings,
              apiKey: data.settings.apiKey || apiSettings.apiKey,
            };
            setApiSettings(newSettings);
            setTempApiSettings(newSettings);
            localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
          }

          setSyncMessage('导入成功！');
          setTimeout(() => setSyncMessage(''), 3000);
        }
      } else {
        setSyncError('文件格式不正确');
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
    if (confirm('确定要删除这个角色吗？相关的聊天记录也会被删除。')) {
      deleteCharacter(id);
    }
  };

  const openEditForm = (character: Character) => {
    setEditingCharacter(character);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCharacter(undefined);
  };

  const hasApiKey = !!apiSettings.apiKey;
  const hasGistConfig = !!apiSettings.gistToken;

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50">
      {/* 头部 */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                  AI角色对话
                </h1>
                <p className="text-xs text-gray-500">创建你的专属AI伙伴</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 同步按钮 */}
              {hasGistConfig && (
                <button
                  onClick={handleSyncToGist}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all disabled:opacity-50"
                  title="同步到云端"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline text-sm font-medium">同步</span>
                </button>
              )}
              <button
                onClick={() => setShowApiSettings(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  hasApiKey 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  {hasApiKey ? 'API已配置' : '配置API'}
                </span>
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">创建角色</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 同步状态提示 */}
      {(syncMessage || syncError) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {syncMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{syncMessage}</p>
            </div>
          )}
          {syncError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{syncError}</p>
            </div>
          )}
        </div>
      )}

      {/* API配置提示 */}
      {!hasApiKey && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">需要配置 API 密钥</h3>
              <p className="text-sm text-amber-700">
                请先配置 OpenAI API 密钥或其他兼容的 API，才能使用 AI 对话和自动生成角色功能
              </p>
            </div>
            <button
              onClick={() => setShowApiSettings(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shrink-0"
            >
              立即配置
            </button>
          </div>
        </div>
      )}

      {/* 保存成功提示 */}
      {saveSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-5 h-5" />
            <span>设置已保存</span>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {characters.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Users className="w-12 h-12 text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">还没有角色</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              创建你的第一个AI角色，开始智能对话。你可以手动创建，或使用 AI 自动生成知名人物
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" />
                创建角色
              </button>
              {hasApiKey && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-primary-200 text-primary-700 rounded-xl hover:bg-primary-50 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  AI自动生成
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                我的角色 ({characters.length})
              </h2>
              {hasApiKey && (
                <p className="text-sm text-gray-500">
                  点击角色卡片上的对话按钮开始聊天
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
                <div
                  key={character.id}
                  className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <img
                          src={character.avatar}
                          alt={character.name}
                          className="w-16 h-16 rounded-2xl object-cover shadow-md group-hover:scale-105 transition-transform"
                        />
                        <button
                          onClick={() => setChattingCharacter(character)}
                          className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900 truncate">
                            {character.name}
                          </h3>
                        </div>
                        {character.title && (
                          <span className="inline-block text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full mb-2">
                            {character.title}
                          </span>
                        )}
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {character.description || '暂无描述'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
                    <button
                      onClick={() => openEditForm(character)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-primary-600 hover:bg-white rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* API设置弹窗 */}
      {showApiSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">系统配置</h3>
                  <p className="text-sm text-gray-500">配置 API、语音和同步</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="space-y-6">
              {/* API 配置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2">API 配置</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API 密钥 *
                  </label>
                  <input
                    type="password"
                    value={tempApiSettings.apiKey}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="sk-..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API 基础 URL
                  </label>
                  <input
                    type="text"
                    value={tempApiSettings.apiBaseURL}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, apiBaseURL: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模型
                  </label>
                  <input
                    type="text"
                    value={tempApiSettings.apiModel}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, apiModel: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="gpt-3.5-turbo"
                  />
                </div>
              </div>

              {/* 云端同步配置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  云端同步 (GitHub Gist)
                </h4>
                
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  <p>使用 GitHub Gist 实现多端数据同步。配置后可以将角色和设置同步到云端，在其他设备上恢复。</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GitHub Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={tempApiSettings.gistToken}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, gistToken: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="ghp_..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    在 GitHub Settings → Developer settings → Personal access tokens 中创建，需要 gist 权限
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gist ID (可选)
                  </label>
                  <input
                    type="text"
                    value={tempApiSettings.gistId}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, gistId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="留空将自动创建新的 Gist"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    如果已有 Gist ID，可以输入以恢复数据；留空将创建新的 Gist
                  </p>
                </div>

                {/* 同步操作按钮 */}
                {tempApiSettings.gistToken && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncToGist}
                      disabled={isSyncing}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      同步到云端
                    </button>
                    <button
                      onClick={handleRestoreFromGist}
                      disabled={isSyncing}
                      className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      从云端恢复
                    </button>
                  </div>
                )}
              </div>

              {/* 数据导入导出 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2">数据备份</h4>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出备份
                  </button>
                  <label className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    导入备份
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* 语音配置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  语音配置
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择声音
                  </label>
                  <select
                    value={tempApiSettings.voiceURI}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, voiceURI: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">使用系统默认</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang}) {voice.localService ? '[本地]' : '[网络]'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">音量</label>
                    <span className="text-sm text-gray-500">{Math.round(tempApiSettings.voiceVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={tempApiSettings.voiceVolume}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, voiceVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">语速</label>
                    <span className="text-sm text-gray-500">{tempApiSettings.voiceRate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tempApiSettings.voiceRate}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, voiceRate: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">音调</label>
                    <span className="text-sm text-gray-500">{tempApiSettings.voicePitch}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tempApiSettings.voicePitch}
                    onChange={(e) => setTempApiSettings({ ...tempApiSettings, voicePitch: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <button
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance('这是一段测试语音，您可以调整音量、语速和音调。');
                    utterance.lang = 'zh-CN';
                    utterance.volume = tempApiSettings.voiceVolume;
                    utterance.rate = tempApiSettings.voiceRate;
                    utterance.pitch = tempApiSettings.voicePitch;
                    if (tempApiSettings.voiceURI) {
                      const voice = availableVoices.find(v => v.voiceURI === tempApiSettings.voiceURI);
                      if (voice) utterance.voice = voice;
                    }
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  测试语音
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowApiSettings(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveApiSettings}
                className="px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建/编辑角色表单 */}
      {showForm && (
        <CharacterForm
          character={editingCharacter}
          onSave={editingCharacter ? handleUpdateCharacter : handleAddCharacter}
          onCancel={closeForm}
          apiSettings={apiSettings}
        />
      )}

      {/* 聊天界面 */}
      {chattingCharacter && (
        <ChatInterface
          character={chattingCharacter}
          onClose={() => setChattingCharacter(undefined)}
        />
      )}
    </main>
  );
}
