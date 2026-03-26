'use client';

import { useState, useRef, useEffect } from 'react';
import { Character, Message, ChatHistory } from '@/types/character';
import { storage } from '@/lib/storage';
import { apiService } from '@/lib/api';
import { X, Mic, Volume2, VolumeX, MoreHorizontal, Smile, Plus, History, MessageSquare } from 'lucide-react';
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
  backgroundImage: string;
  voiceURI: string;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
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
};

export function ChatInterface({ character, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [histories, setHistories] = useState<ChatHistory[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 初始化：加载设置、历史记录和当前会话
  useEffect(() => {
    // 加载设置
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      setTempSettings({ ...DEFAULT_SETTINGS, ...parsed });
      apiService.setConfig(parsed.apiKey || '', parsed.apiBaseURL, parsed.apiModel);
    }

    // 加载历史记录
    loadHistories();

    // 检查是否有当前历史会话，如果没有则创建新会话
    const currentId = storage.getCurrentHistoryId(character.id);
    if (!currentId) {
      createNewChat();
    } else {
      setCurrentHistoryId(currentId);
      const session = storage.getChatSession(character.id);
      setMessages(session.messages);
    }
  }, [character.id]);

  // 加载历史记录列表
  const loadHistories = () => {
    const characterHistories = storage.getCharacterHistories(character.id);
    setHistories(characterHistories);
  };

  // 创建新聊天
  const createNewChat = () => {
    const newHistory = storage.createNewHistory(character.id);
    setCurrentHistoryId(newHistory.id);
    setMessages([]);
    loadHistories();
    setShowHistory(false);
  };

  // 切换历史会话
  const switchToHistory = (historyId: string) => {
    storage.switchHistory(character.id, historyId);
    setCurrentHistoryId(historyId);
    const session = storage.getChatSession(character.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  // 删除历史会话
  const deleteHistory = (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个对话记录吗？')) {
      storage.deleteHistory(character.id, historyId);
      loadHistories();
      // 如果删除的是当前会话，重新加载当前会话
      const newCurrentId = storage.getCurrentHistoryId(character.id);
      if (newCurrentId !== currentHistoryId) {
        setCurrentHistoryId(newCurrentId);
        const session = storage.getChatSession(character.id);
        setMessages(session.messages);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const speakMessage = (text: string) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.volume = settings.voiceVolume;
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;
    
    if (settings.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('浏览器不支持语音识别');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError('');
      } catch (err) {
        setError('语音识别启动失败');
      }
    }
  };

  const clearHistory = () => {
    if (confirm('确定要清空当前聊天记录吗？')) {
      storage.clearChatHistory(character.id);
      setMessages([]);
      stopSpeaking();
      setShowMoreMenu(false);
      // 更新历史记录标题
      loadHistories();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!settings.apiKey) {
      setError('请先设置API密钥');
      setShowSettings(true);
      setShowMoreMenu(true);
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
      
      // 刷新历史记录列表（更新标题）
      loadHistories();
      
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

  const messageListStyle = settings.backgroundImage
    ? { backgroundImage: `url(${settings.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return '今天';
    } else if (diff < 172800000 && date.getDate() === now.getDate() - 1) {
      return '昨天';
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#EDEDED]">
      {/* 顶部导航栏 - 微信风格 */}
      <div className="h-14 bg-[#EDEDED] border-b border-gray-300 flex items-center px-4 shrink-0">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-2"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
        
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <img
            src={character.avatar}
            alt={character.name}
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">{character.name}</h3>
          </div>
        </div>
        
        {/* 新聊天按钮 */}
        <button
          onClick={createNewChat}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-1"
          title="新聊天"
        >
          <MessageSquare className="w-5 h-5 text-gray-700" />
        </button>

        {/* 历史记录按钮 */}
        <button
          onClick={() => { setShowHistory(!showHistory); setShowMoreMenu(false); }}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-1"
          title="历史记录"
        >
          <History className="w-5 h-5 text-gray-700" />
        </button>
        
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <MoreHorizontal className="w-6 h-6 text-gray-700" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute right-0 top-12 bg-white rounded-lg shadow-xl py-2 min-w-[140px] z-10">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                设置
              </button>
              <button
                onClick={clearHistory}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                清空当前记录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 历史记录侧边栏 */}
      {showHistory && (
        <div className="absolute top-14 right-0 w-72 max-h-[60vh] bg-white shadow-xl rounded-bl-lg z-20 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <span className="font-medium text-gray-900">历史记录</span>
            <button
              onClick={createNewChat}
              className="text-sm text-[#07C160] hover:underline"
            >
              + 新聊天
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {histories.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                暂无历史记录
              </div>
            ) : (
              histories.map((history) => (
                <div
                  key={history.id}
                  onClick={() => switchToHistory(history.id)}
                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${
                    history.id === currentHistoryId ? 'bg-[#E6F7ED]' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {history.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDate(history.updatedAt)} · {history.messages.length} 条消息
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteHistory(history.id, e)}
                    className="p-1.5 hover:bg-red-100 rounded-full ml-2 opacity-0 group-hover:opacity-100"
                    style={{ opacity: history.id === currentHistoryId ? 1 : undefined }}
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 点击历史记录外部关闭 */}
      {showHistory && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowHistory(false)}
        />
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-600 text-sm shrink-0">
          <span>{error}</span>
        </div>
      )}

      {savedMessage && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center gap-2 text-green-600 text-sm shrink-0">
          <span>{savedMessage}</span>
        </div>
      )}

      {/* 消息列表 - 微信风格 */}
      <div 
        className="flex-1 overflow-y-auto px-3 py-4 bg-[#EDEDED]"
        style={messageListStyle}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-sm">开始与 {character.name} 对话</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 mb-4 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <img
                src={message.role === 'user' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=user' : character.avatar}
                alt={message.role === 'user' ? '我' : character.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex flex-col gap-1 max-w-[75%]">
                <div className="relative">
                  <div
                    className={`px-3 py-2.5 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? (settings.backgroundImage 
                            ? 'text-white text-shadow-md' 
                            : 'bg-[#95EC69] text-gray-900')
                        : (settings.backgroundImage 
                            ? 'text-white text-shadow-md' 
                            : 'bg-white text-gray-900 shadow-sm')
                    } rounded-tl-xl rounded-tr-md rounded-bl-xl rounded-br-md`}
                    style={
                      settings.backgroundImage
                        ? { textShadow: '0 1px 3px rgba(0,0,0,0.8)' }
                        : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {!settings.backgroundImage && (
                    <div
                      className={`absolute top-3 w-2 h-2 ${
                        message.role === 'user'
                          ? 'right-[-4px] bg-[#95EC69]'
                          : 'left-[-4px] bg-white'
                      }`}
                      style={{
                        clipPath: message.role === 'user' 
                          ? 'polygon(0 50%, 100% 0, 100% 100%)'
                          : 'polygon(100% 50%, 0 0, 0 100%)'
                      }}
                    />
                  )}
                </div>
                <span className={`text-xs text-gray-400 ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-2 mb-4">
            <img
              src={character.avatar}
              alt={character.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
            <div className="relative">
              <div className={`px-3 py-2.5 rounded-tl-md rounded-tr-xl rounded-bl-md rounded-br-xl ${settings.backgroundImage ? '' : 'bg-white shadow-sm'}`}>
                <div className="flex gap-1.5">
                  <span className={`w-2 h-2 rounded-full animate-bounce ${settings.backgroundImage ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${settings.backgroundImage ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '150ms' }} />
                  <span className={`w-2 h-2 rounded-full animate-bounce ${settings.backgroundImage ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              {!settings.backgroundImage && (
                <div className="absolute top-3 left-[-4px] w-2 h-2 bg-white" style={{ clipPath: 'polygon(100% 50%, 0 0, 0 100%)' }} />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入区域 - 微信风格 */}
      <div className="bg-[#F7F7F7] border-t border-gray-300 px-3 py-2 shrink-0">
        <div className="flex items-end gap-2">
          <button className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0">
            <Smile className="w-6 h-6 text-gray-600" />
          </button>
          
          <button className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0">
            <Plus className="w-6 h-6 text-gray-600" />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#07C160] min-h-[36px] max-h-[120px]"
            style={{ height: 'auto' }}
          />

          {input.trim() ? (
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="px-4 py-2 bg-[#07C160] text-white text-sm rounded-lg hover:bg-[#06AD56] disabled:opacity-50 transition-colors shrink-0"
            >
              发送
            </button>
          ) : (
            <div className="flex gap-1">
              {settings.voiceInputEnabled && (
                <button
                  onClick={toggleVoiceInput}
                  className={`p-2 rounded-full transition-colors shrink-0 ${
                    isListening ? 'bg-red-500 text-white' : 'hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-6 h-6 ${isListening ? 'text-white' : 'text-gray-600'}`} />
                </button>
              )}
              
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                >
                  <VolumeX className="w-6 h-6 text-red-500" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">聊天设置</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">语音朗读</span>
                <button
                  onClick={() => {
                    const newValue = !tempSettings.voiceEnabled;
                    setTempSettings({ ...tempSettings, voiceEnabled: newValue });
                    const newSettings = { ...settings, voiceEnabled: newValue };
                    setSettings(newSettings);
                    localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                  }}
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
                  onClick={() => {
                    const newValue = !tempSettings.voiceInputEnabled;
                    setTempSettings({ ...tempSettings, voiceInputEnabled: newValue });
                    const newSettings = { ...settings, voiceInputEnabled: newValue };
                    setSettings(newSettings);
                    localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                  }}
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
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">音量: {Math.round(tempSettings.voiceVolume * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={tempSettings.voiceVolume}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setTempSettings({ ...tempSettings, voiceVolume: newValue });
                      const newSettings = { ...settings, voiceVolume: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {tempSettings.voiceEnabled && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">语速: {tempSettings.voiceRate.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tempSettings.voiceRate}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setTempSettings({ ...tempSettings, voiceRate: newValue });
                      const newSettings = { ...settings, voiceRate: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {tempSettings.voiceEnabled && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">音调: {tempSettings.voicePitch.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={tempSettings.voicePitch}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setTempSettings({ ...tempSettings, voicePitch: newValue });
                      const newSettings = { ...settings, voicePitch: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
