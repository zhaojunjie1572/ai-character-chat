'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Settings, Key, Sparkles, MessageSquare, Trash2, Edit3 } from 'lucide-react';
import { useCharacters } from '@/hooks/useCharacters';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterForm } from '@/components/CharacterForm';
import { ChatInterface } from '@/components/ChatInterface';
import { Character } from '@/types/character';

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseURL: 'https://api.openai.com/v1',
  apiModel: 'gpt-3.5-turbo',
};

export default function Home() {
  const { characters, isLoaded, addCharacter, updateCharacter, deleteCharacter } = useCharacters();
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [chattingCharacter, setChattingCharacter] = useState<Character | undefined>();
  const [apiSettings, setApiSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [tempApiSettings, setTempApiSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const settings = {
        apiKey: parsed.apiKey || '',
        apiBaseURL: parsed.apiBaseURL || 'https://api.openai.com/v1',
        apiModel: parsed.apiModel || 'gpt-3.5-turbo',
      };
      setApiSettings(settings);
      setTempApiSettings(settings);
    }
  }, []);

  const handleSaveApiSettings = () => {
    const fullSettings = {
      ...tempApiSettings,
      voiceEnabled: false,
      voiceInputEnabled: false,
      backgroundImage: '',
    };
    localStorage.setItem('ai_app_settings', JSON.stringify(fullSettings));
    setApiSettings(tempApiSettings);
    setShowApiSettings(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
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
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">API 配置</h3>
                  <p className="text-sm text-gray-500">配置你的 AI 服务</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500">
                  你的 OpenAI API 密钥或其他兼容服务的密钥
                </p>
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

              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">支持的服务：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>OpenAI (GPT-3.5, GPT-4)</li>
                  <li>Azure OpenAI</li>
                  <li>Claude (通过代理)</li>
                  <li>其他兼容 OpenAI API 的服务</li>
                </ul>
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
