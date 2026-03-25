'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Character, Message } from '@/types/character';
import { storage } from '@/lib/storage';
import { apiService } from '@/lib/api';
import { Send, Trash2, X, Settings, AlertCircle, Maximize2, Minimize2, Mic, Volume2, VolumeX, Save, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ChatInterfaceProps {
  character: Character;
  onClose: () => void;
}

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseURL: 'https://api.openai.com/v1',
  apiModel: 'gpt-3.5-turbo',
  voiceEnabled: false,
  voiceInputEnabled: false,
};

export function ChatInterface({ character, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  
  // 设置状态
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // 加载设置和消息
  useEffect(() => {
    const session = storage.getChatSession(character.id);
    setMessages(session.messages);

    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      setTempSettings({ ...DEFAULT_SETTINGS, ...parsed });
      apiService.setConfig(parsed.apiKey || '', parsed.apiBaseURL, parsed.apiModel);
    }
  }, [character.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        setError('语音识别失败');
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('ai_app_settings', JSON.stringify(tempSettings));
    setSettings(tempSettings);
    apiService.setConfig(tempSettings.apiKey, tempSettings.apiBaseURL, tempSettings.apiModel);
    setShowSettings(false);
    showSavedTip('设置已保存');
  };

  const showSavedTip = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(''), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const speakMessage = (text: string) => {
    if (!settings.voiceEnabled) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('您的浏览器不支持语音识别');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      setError('');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!settings.apiKey) {
      setError('请先设置API密钥');
      setShowSettings(true);
      return;
    }

    setError('');
    stopSpeaking();
    
    const userMessage: Message = {
      id: uuidv4(),
      characterId: character.id,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    storage.addMessage(character.id, userMessage);
    setInput('');
    setIsLoading(true);

    try {
      apiService.setConfig(settings.apiKey, settings.apiBaseURL, settings.apiModel);
      
      const chatMessages = [
        { role: 'system' as const, content: character.systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage.content },
      ];

      const response = await apiService.chat({
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const assistantMessage: Message = {
        id: uuidv4(),
        characterId: character.id,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      storage.addMessage(character.id, assistantMessage);
      
      // 自动朗读回复
      if (settings.voiceEnabled) {
        speakMessage(response.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送消息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    if (confirm('确定要清空聊天记录吗？')) {
      storage.clearChatHistory(character.id);
      setMessages([]);
      stopSpeaking();
    }
  };

  const dialogClass = isFullscreen 
    ? 'fixed inset-0 z-50 flex flex-col bg-white'
    : 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';

  const contentClass = isFullscreen
    ? 'w-full h-full flex flex-col'
    : 'bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col';

  return (
    <div className={dialogClass}>
      <div className={contentClass}>
        {/* 头部 */}
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <img
              src={character.avatar}
              alt={character.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-bold text-gray-900">{character.name}</h3>
              <p className="text-sm text-gray-500">{character.title || 'AI角色'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="p-2 hover:bg-red-100 text-red-600 rounded-full transition-colors"
                title="停止朗读"
              >
                <VolumeX className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-gray-600" /> : <Maximize2 className="w-5 h-5 text-gray-600" />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="设置"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={clearHistory}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="清空记录"
            >
              <Trash2 className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 保存成功提示 */}
        {savedMessage && (
          <div className="px-4 py-2 bg-green-50 border-b flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <span className="text-sm">{savedMessage}</span>
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="mb-2">开始与 {character.name} 对话</p>
              <p className="text-sm">{character.description}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <img
                  src={message.role === 'user' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=user' : character.avatar}
                  alt={message.role === 'user' ? '我' : character.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex flex-col gap-1 max-w-[70%]">
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className={`flex items-center gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    <span className="text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.role === 'assistant' && settings.voiceEnabled && (
                      <button
                        onClick={() => speakMessage(message.content)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="朗读"
                      >
                        <Volume2 className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <img
                src={character.avatar}
                alt={character.name}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="bg-white px-4 py-2 rounded-2xl shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            {settings.voiceInputEnabled && (
              <button
                onClick={toggleVoiceInput}
                disabled={isLoading}
                className={`p-3 rounded-lg transition-colors ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isListening ? '停止录音' : '语音输入'}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? '正在聆听...' : `给 ${character.name} 发送消息...`}
              rows={1}
              disabled={isListening}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isListening}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">设置</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* API设置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2">API配置</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API密钥 *
                  </label>
                  <input
                    type="password"
                    value={tempSettings.apiKey}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API基础URL
                  </label>
                  <input
                    type="text"
                    value={tempSettings.apiBaseURL}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiBaseURL: e.target.value })}
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
                    value={tempSettings.apiModel}
                    onChange={(e) => setTempSettings({ ...tempSettings, apiModel: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="gpt-3.5-turbo"
                  />
                </div>
              </div>

              {/* 语音设置 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b pb-2">语音设置</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">语音朗读</label>
                    <p className="text-sm text-gray-500">自动朗读AI回复</p>
                  </div>
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, voiceEnabled: !tempSettings.voiceEnabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      tempSettings.voiceEnabled ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                      tempSettings.voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">语音输入</label>
                    <p className="text-sm text-gray-500">使用麦克风输入</p>
                  </div>
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, voiceInputEnabled: !tempSettings.voiceInputEnabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      tempSettings.voiceInputEnabled ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                      tempSettings.voiceInputEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                支持 OpenAI、Azure、Claude 等兼容 OpenAI API 格式的服务
              </p>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
