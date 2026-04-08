'use client';

import { useState, useRef, useEffect } from 'react';
import { Character, Message, ChatHistory } from '@/types/character';
import { storage } from '@/lib/storage';
import { apiService, ApiProvider } from '@/lib/api';
import { X, Mic, Volume2, VolumeX, MoreHorizontal, Smile, Plus, History, MessageSquare, Bookmark, Check } from 'lucide-react';
import { memoStorage } from '@/lib/memoStorage';
import { v4 as uuidv4 } from 'uuid';
import { TtsConfig, loadTtsConfig, synthesizeSpeech, speakLongTextEdgeTTS, speakLongTextBrowser, SpeechController } from '@/lib/ttsService';

interface ChatInterfaceProps {
  character: Character;
  onClose: () => void;
}

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
  const [memoSavedMessage, setMemoSavedMessage] = useState('');
  
  // 文本选择收藏相关状态
  const [selectedText, setSelectedText] = useState('');
  const [showTextSelectionMenu, setShowTextSelectionMenu] = useState(false);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState({ x: 0, y: 0 });
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(loadTtsConfig());
  const speechControllerRef = useRef<SpeechController | null>(null);
  const [speechProgress, setSpeechProgress] = useState<{ current: number; total: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 加载可用语音列表
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const chineseVoices = voices.filter(v => v.lang.includes('zh'));
        setAvailableVoices(chineseVoices.length > 0 ? chineseVoices : voices);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // 更新设置并持久化
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newTempSettings = { ...tempSettings, [key]: value };
    const newSettings = { ...settings, [key]: value };
    setTempSettings(newTempSettings);
    setSettings(newSettings);
    try {
      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.error('保存设置失败:', e);
    }
  };

  // 初始化：加载设置、历史记录和当前会话
  useEffect(() => {
    // 加载设置
    try {
      const savedSettings = localStorage.getItem('ai_app_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // 确保有默认值
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          // 如果保存的值为空，使用默认值
          apiBaseURL: parsed.apiBaseURL || DEFAULT_SETTINGS.apiBaseURL,
          apiModel: parsed.apiModel || DEFAULT_SETTINGS.apiModel,
        };
        setSettings(mergedSettings);
        setTempSettings(mergedSettings);
        apiService.setConfig({
          apiKey: mergedSettings.apiKey,
          baseURL: mergedSettings.apiBaseURL,
          model: mergedSettings.apiModel,
          provider: mergedSettings.apiProvider,
        });
      }
    } catch (e) {
      console.error('加载设置失败:', e);
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

  // 清理文本，移除 Markdown 标记和特殊符号
  const cleanTextForSpeech = (text: string): string => {
    return text
      // 移除 Markdown 强调标记
      .replace(/\*\*(.+?)\*\*/g, '$1')  // **粗体**
      .replace(/\*(.+?)\*/g, '$1')      // *斜体*
      .replace(/__(.+?)__/g, '$1')      // __粗体__
      .replace(/_(.+?)_/g, '$1')        // _斜体_
      // 移除代码块
      .replace(/```[\s\S]*?```/g, '代码块')
      .replace(/`(.+?)`/g, '$1')
      // 移除链接，保留文本
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      // 移除 HTML 标签
      .replace(/<[^>]+>/g, '')
      // 移除 URL
      .replace(/https?:\/\/\S+/g, '链接')
      // 移除多余的换行和空格
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const speakMessage = async (text: string) => {
    // 停止当前播放
    stopSpeaking();

    // 清理文本
    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    // 根据 useEdgeTTS 开关决定使用哪种 TTS
    if (ttsConfig.useEdgeTTS && ttsConfig.edgeTtsUrl) {
      try {
        setIsSpeaking(true);
        setSpeechProgress({ current: 1, total: 1 }); // 初始状态

        const controller = await speakLongTextEdgeTTS(cleanedText, ttsConfig, {
          rate: settings.voiceRate,
          pitch: settings.voicePitch,
          volume: settings.voiceVolume,
          voiceURI: settings.voiceURI,
          onProgress: (current, total) => {
            setSpeechProgress({ current, total });
          },
          onEnded: () => {
            setIsSpeaking(false);
            setSpeechProgress(null);
            speechControllerRef.current = null;
          },
          onError: (error) => {
            console.error('Edge TTS error:', error);
            // 出错时回退到浏览器 TTS
            speechControllerRef.current = null;
            setSpeechProgress(null);
            fallbackToBrowserTTS(cleanedText);
          },
          onFallback: () => {
            // Edge TTS 自动回退到浏览器 TTS 时触发
            console.log('Edge TTS 已自动回退到浏览器 TTS');
          }
        });

        speechControllerRef.current = controller;
        controller.play();
      } catch (error) {
        console.error('Edge TTS initialization error:', error);
        // 如果 Edge TTS 初始化失败，回退到浏览器 TTS
        fallbackToBrowserTTS(cleanedText);
      }
    } else {
      // 使用浏览器原生 TTS（系统默认语音）
      console.log('Edge TTS 已关闭，使用浏览器默认语音');
      fallbackToBrowserTTS(cleanedText);
    }
  };

  const fallbackToBrowserTTS = (text: string) => {
    if (!window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSpeaking(true);
      setSpeechProgress({ current: 1, total: 1 });

      const controller = speakLongTextBrowser(text, {
        rate: settings.voiceRate,
        pitch: settings.voicePitch,
        volume: settings.voiceVolume,
        voiceURI: settings.voiceURI,
        onProgress: (current, total) => {
          setSpeechProgress({ current, total });
        },
        onEnded: () => {
          setIsSpeaking(false);
          setSpeechProgress(null);
          speechControllerRef.current = null;
        },
        onError: (error) => {
          console.error('Browser TTS error:', error);
          setIsSpeaking(false);
          setSpeechProgress(null);
          speechControllerRef.current = null;
        }
      });

      speechControllerRef.current = controller;
      controller.play();
    } catch (error) {
      console.error('Browser TTS initialization error:', error);
      setIsSpeaking(false);
      setSpeechProgress(null);
    }
  };

  const stopSpeaking = () => {
    // 停止长文本朗读控制器
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }

    // 备用：停止浏览器 TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setSpeechProgress(null);
  };

  // 收藏消息到备忘录
  const saveToMemo = (content: string) => {
    memoStorage.addMemo(content, character.name, character.avatar);
    setMemoSavedMessage('已收藏到备忘录');
    setTimeout(() => setMemoSavedMessage(''), 2000);
  };

  // 处理文本选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setSelectionMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 50
      });
      setShowTextSelectionMenu(true);
    } else {
      setShowTextSelectionMenu(false);
    }
  };

  // 收藏选中的文本
  const saveSelectedText = () => {
    if (selectedText) {
      memoStorage.addMemo(selectedText, character.name, character.avatar);
      setMemoSavedMessage('已收藏选中内容');
      setTimeout(() => setMemoSavedMessage(''), 2000);
      setShowTextSelectionMenu(false);
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
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
      apiService.setConfig({
        apiKey: settings.apiKey,
        baseURL: settings.apiBaseURL,
        model: settings.apiModel,
        provider: settings.apiProvider,
      });
      
      const chatMessages = [
        { role: 'system' as const, content: character.systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage.content },
      ];

      // 对于自定义提供商，优先使用流式请求
      if (settings.apiProvider === 'custom') {
        
        // 先创建一个空的助手消息
        const assistantMessage: Message = {
          id: uuidv4(),
          characterId: character.id,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        try {
          let fullContent = '';
          const stream = apiService.chatStream({
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: settings.maxTokens || 4000,
          });
          
          for await (const chunk of stream) {
            if (chunk.error) {
              throw new Error(chunk.error);
            }
            if (chunk.content) {
              fullContent += chunk.content;
              // 实时更新消息
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            }
          }
          
          // 保存完整消息
          assistantMessage.content = fullContent;
          storage.addMessage(character.id, assistantMessage);
          
          if (!fullContent || fullContent.trim() === '') {
            throw new Error('API 返回空内容，请检查 API 配置');
          }
          
          if (settings.voiceEnabled) {
            speakMessage(fullContent);
          }
          
          // 刷新历史记录列表
          loadHistories();
          setIsLoading(false);
          return;
          
        } catch (err) {
          // 如果流式请求失败，回退到非流式请求
          console.warn('流式请求失败，回退到非流式请求:', err);
          // 移除临时消息
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
        }
      }

      // 非流式请求（或回退方案）
      const response = await apiService.chat({
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: settings.maxTokens || 4000,
      });

      console.log('API Response:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.content || response.content.trim() === '') {
        console.warn('API returned empty content');
        throw new Error('API 返回空内容，请检查 API 配置');
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
                  className={`group p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${
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
                    className="p-1.5 hover:bg-red-100 rounded-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {memoSavedMessage && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2 text-yellow-600 text-sm shrink-0">
          <Bookmark className="w-4 h-4" />
          <span>{memoSavedMessage}</span>
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
                <div className="relative group">
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
                    <p 
                      className="whitespace-pre-wrap select-text cursor-text"
                      onMouseUp={handleTextSelection}
                      onTouchEnd={handleTextSelection}
                    >{message.content}</p>
                  </div>
                  {/* 语音朗读按钮 - 仅角色消息显示 */}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => speakMessage(message.content)}
                      className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="朗读消息"
                    >
                      <Volume2 className="w-4 h-4 text-gray-400 hover:text-[#07C160]" />
                    </button>
                  )}
                  {/* 整段收藏按钮 - 仅角色消息显示 */}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => saveToMemo(message.content)}
                      className="absolute -right-8 top-[calc(50%+20px)] -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="收藏整段到备忘录"
                    >
                      <Bookmark className="w-4 h-4 text-gray-400 hover:text-yellow-500" />
                    </button>
                  )}
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
            onChange={(e) => {
              setInput(e.target.value);
              // 自动调整高度
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#07C160] min-h-[36px] max-h-[120px] overflow-y-auto"
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
                  title={isListening ? '停止语音输入' : '开始语音输入'}
                >
                  <Mic className={`w-6 h-6 ${isListening ? 'text-white' : 'text-gray-600'}`} />
                </button>
              )}
              
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0 flex items-center gap-1"
                  title="停止朗读"
                >
                  <VolumeX className="w-6 h-6 text-red-500" />
                  {speechProgress && speechProgress.total > 1 && (
                    <span className="text-xs text-red-500">
                      {speechProgress.current}/{speechProgress.total}
                    </span>
                  )}
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
                  onClick={() => updateSetting('voiceEnabled', !tempSettings.voiceEnabled)}
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
                  onClick={() => updateSetting('voiceInputEnabled', !tempSettings.voiceInputEnabled)}
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
                    <label className="block text-sm text-gray-600 mb-1.5">音量: {Math.round(tempSettings.voiceVolume * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={tempSettings.voiceVolume}
                      onChange={(e) => updateSetting('voiceVolume', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">语速: {tempSettings.voiceRate.toFixed(1)}x</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={tempSettings.voiceRate}
                      onChange={(e) => updateSetting('voiceRate', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">音调: {tempSettings.voicePitch.toFixed(1)}</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={tempSettings.voicePitch}
                      onChange={(e) => updateSetting('voicePitch', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">选择声音</label>
                    <select
                      value={tempSettings.voiceURI}
                      onChange={(e) => updateSetting('voiceURI', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#07C160] focus:outline-none"
                    >
                      <option value="">默认声音</option>
                      {availableVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
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

      {/* 文本选择悬浮菜单 */}
      {showTextSelectionMenu && selectedText && (
        <div
          className="fixed z-50 bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2"
          style={{
            left: `${Math.min(Math.max(selectionMenuPosition.x - 60, 10), window.innerWidth - 130)}px`,
            top: `${Math.max(selectionMenuPosition.y, 50)}px`,
          }}
        >
          <span className="text-xs text-gray-300 max-w-[150px] truncate">
            选中 {selectedText.length} 字
          </span>
          <button
            onClick={saveSelectedText}
            className="flex items-center gap-1 px-2 py-1 bg-yellow-500 hover:bg-yellow-600 rounded text-xs font-medium transition-colors"
          >
            <Bookmark className="w-3 h-3" />
            收藏
          </button>
          <button
            onClick={() => {
              setShowTextSelectionMenu(false);
              setSelectedText('');
              window.getSelection()?.removeAllRanges();
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 点击其他地方关闭选择菜单 */}
      {showTextSelectionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowTextSelectionMenu(false);
            setSelectedText('');
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </div>
  );
}
