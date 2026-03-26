'use client';

import { useState, useRef, useEffect } from 'react';
import { Character } from '@/types/character';
import { MeetingSession, MeetingParticipant, MeetingMessage } from '@/types/meeting';
import { meetingStorage } from '@/lib/meetingStorage';
import { apiService } from '@/lib/api';
import { X, Plus, Users, MessageCircle, Download, ChevronRight, ChevronLeft, Settings, Play, Square, Mic, Volume2, VolumeX } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface MeetingRoomProps {
  characters: Character[];
  onClose: () => void;
}

interface AppSettings {
  apiKey: string;
  apiBaseURL: string;
  apiModel: string;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  voiceURI: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseURL: 'https://api.openai.com/v1',
  apiModel: 'gpt-3.5-turbo',
  voiceEnabled: false,
  voiceInputEnabled: false,
  voiceVolume: 1,
  voiceRate: 1,
  voicePitch: 1,
  voiceURI: '',
};

// 为参与者分配的颜色方案
const PARTICIPANT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', name: 'text-blue-600' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', name: 'text-purple-600' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', name: 'text-orange-600' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', name: 'text-pink-600' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', name: 'text-teal-600' },
  { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800', name: 'text-indigo-600' },
  { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800', name: 'text-cyan-600' },
  { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800', name: 'text-rose-600' },
];

export function MeetingRoom({ characters, onClose }: MeetingRoomProps) {
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<MeetingSession | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMeetingList, setShowMeetingList] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // 创建表单状态
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [maxLength, setMaxLength] = useState(300);
  const [maxRounds, setMaxRounds] = useState(3);
  const [contextMode, setContextMode] = useState<'independent' | 'discussion'>('independent');
  const [participantSettings, setParticipantSettings] = useState<Record<string, { maxLength: number; canSeeOthers: boolean }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMeetings();
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
      });
    }
    // 调试：检查 characters
    console.log('MeetingRoom characters:', characters);

    // 加载可用的语音列表
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const chineseVoices = voices.filter(v => v.lang.includes('zh'));
      setAvailableVoices(chineseVoices.length > 0 ? chineseVoices : voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [characters]);

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
        if (inputRef.current) {
          inputRef.current.value = inputRef.current.value + transcript;
        }
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMeeting?.messages]);

  const loadMeetings = () => {
    const allMeetings = meetingStorage.getMeetings();
    setMeetings(allMeetings);
  };

  // 获取参与者的颜色索引
  const getParticipantColorIndex = (characterId: string) => {
    if (!currentMeeting) return 0;
    const index = currentMeeting.participants.findIndex(p => p.characterId === characterId);
    return index >= 0 ? index % PARTICIPANT_COLORS.length : 0;
  };

  // 获取参与者的颜色方案
  const getParticipantColors = (characterId: string) => {
    return PARTICIPANT_COLORS[getParticipantColorIndex(characterId)];
  };

  // 文字转语音
  const speakMessage = (text: string, messageId: string) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.volume = settings.voiceVolume;
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;
    
    // 使用选中的声音
    if (settings.voiceURI) {
      const selectedVoice = availableVoices.find(v => v.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // 停止朗读
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  // 切换语音输入
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

  const handleCreateMeeting = () => {
    if (!meetingTitle.trim() || selectedParticipants.length === 0) {
      setError('请填写会议标题并选择参与者');
      return;
    }

    const participants: MeetingParticipant[] = selectedParticipants.map((characterId, index) => {
      const character = characters.find(c => c.id === characterId)!;
      const customSettings = participantSettings[characterId] || {};
      return {
        characterId,
        character,
        order: index,
        maxLength: customSettings.maxLength || maxLength,
        canSeeOthers: customSettings.canSeeOthers ?? (contextMode === 'discussion'),
        isActive: true,
      };
    });

    const meeting = meetingStorage.createMeeting(
      meetingTitle,
      meetingTopic,
      participants,
      maxRounds,
      contextMode
    );

    setCurrentMeeting(meeting);
    setShowCreateForm(false);
    setShowMeetingList(false);
    loadMeetings();
    
    // 重置表单
    setMeetingTitle('');
    setMeetingTopic('');
    setSelectedParticipants([]);
    setParticipantSettings({});
    setError('');
  };

  const handleSendMessage = async (content: string) => {
    if (!currentMeeting || !content.trim() || isProcessing) return;
    if (!settings.apiKey) {
      setError('请先设置API密钥');
      return;
    }

    setIsProcessing(true);
    setError('');

    // 添加主持人消息
    const hostMessage: Omit<MeetingMessage, 'id' | 'timestamp'> = {
      meetingId: currentMeeting.id,
      characterId: '',
      role: 'user',
      content: content.trim(),
      round: currentMeeting.currentRound,
      participantOrder: 0,
    };

    meetingStorage.addMessage(currentMeeting.id, hostMessage);
    
    // 重新加载会议数据
    const updatedMeeting = meetingStorage.getMeeting(currentMeeting.id);
    if (updatedMeeting) {
      setCurrentMeeting(updatedMeeting);
    }

    // 让每个参与者依次回复
    apiService.setConfig(settings.apiKey, settings.apiBaseURL, settings.apiModel);

    for (const participant of currentMeeting.participants) {
      if (!participant.isActive) continue;

      try {
        // 构建上下文
        const contextMessages = meetingStorage.getContextMessages(
          currentMeeting.id,
          participant.characterId,
          currentMeeting.contextMode
        );

        const systemPrompt = `${participant.character.systemPrompt}

你正在参加一个会议室讨论。${currentMeeting.contextMode === 'discussion' ? '你可以看到其他参与者的发言。' : '你只回复主持人的问题。'}

重要限制：你的回复必须控制在${participant.maxLength}字以内。请简洁明了地表达观点。

会议主题：${currentMeeting.topic || '无特定主题'}

${contextMessages ? '之前的讨论：\n' + contextMessages : ''}`;

        const response = await apiService.chat({
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: `主持人说：${content.trim()}\n\n请给出你的专业意见（${participant.maxLength}字以内）：` },
          ],
          temperature: 0.7,
          max_tokens: Math.min(participant.maxLength * 2, 1000),
        });

        if (response.error) {
          throw new Error(response.error);
        }

        // 截断回复以确保不超过字数限制
        let replyContent = response.content;
        if (replyContent.length > participant.maxLength) {
          replyContent = replyContent.slice(0, participant.maxLength) + '...';
        }

        const participantMessage: Omit<MeetingMessage, 'id' | 'timestamp'> = {
          meetingId: currentMeeting.id,
          characterId: participant.characterId,
          role: 'assistant',
          content: replyContent,
          round: currentMeeting.currentRound,
          participantOrder: participant.order,
        };

        meetingStorage.addMessage(currentMeeting.id, participantMessage);
        
        // 更新当前会议状态
        const latestMeeting = meetingStorage.getMeeting(currentMeeting.id);
        if (latestMeeting) {
          setCurrentMeeting(latestMeeting);
          
          // 如果开启了语音朗读，朗读最新消息
          if (settings.voiceEnabled) {
            const newMessage = latestMeeting.messages[latestMeeting.messages.length - 1];
            if (newMessage && newMessage.characterId === participant.characterId) {
              speakMessage(replyContent, newMessage.id);
            }
          }
        }
      } catch (err) {
        console.error(`${participant.character.name} 回复失败:`, err);
        // 继续让其他参与者回复
      }
    }

    // 进入下一轮
    meetingStorage.nextRound(currentMeeting.id);
    const finalMeeting = meetingStorage.getMeeting(currentMeeting.id);
    if (finalMeeting) {
      setCurrentMeeting(finalMeeting);
    }

    setIsProcessing(false);
  };

  const handleExportMeeting = () => {
    if (!currentMeeting) return;
    
    const content = meetingStorage.exportMeeting(currentMeeting.id);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `会议记录-${currentMeeting.title}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleParticipant = (characterId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId);
      } else {
        return [...prev, characterId];
      }
    });
  };

  const updateParticipantSetting = (characterId: string, key: 'maxLength' | 'canSeeOthers', value: any) => {
    setParticipantSettings(prev => ({
      ...prev,
      [characterId]: {
        ...prev[characterId],
        [key]: value,
      },
    }));
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#EDEDED]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#EDEDED] border-b border-gray-300 flex items-center px-4 shrink-0">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-2"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>

        <div className="flex-1 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">会议室</h2>
        </div>

        {currentMeeting && (
          <>
            <button
              onClick={handleExportMeeting}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-1"
              title="导出会议记录"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => { setCurrentMeeting(null); setShowMeetingList(true); stopSpeaking(); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              返回列表
            </button>
          </>
        )}

        {!currentMeeting && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#07C160] text-white text-sm rounded-lg hover:bg-[#06AD56] transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建会议
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* 会议列表 */}
      {!currentMeeting && showMeetingList && (
        <div className="flex-1 overflow-y-auto p-4">
          {meetings.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">还没有会议室</p>
              <p className="text-sm mb-4">创建一个会议室，与多个角色同时对话</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56]"
              >
                创建会议室
              </button>
            </div>
          ) : (
            <div className="grid gap-3 max-w-2xl mx-auto">
              {meetings.map(meeting => (
                <div
                  key={meeting.id}
                  onClick={() => { setCurrentMeeting(meeting); setShowMeetingList(false); }}
                  className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{meeting.title}</h3>
                      {meeting.topic && (
                        <p className="text-sm text-gray-500 mb-2">{meeting.topic}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{meeting.participants.length} 位参与者</span>
                        <span>{meeting.messages.length} 条消息</span>
                        <span>第 {meeting.currentRound}/{meeting.maxRounds} 轮</span>
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {meeting.participants.slice(0, 3).map(p => (
                        <img
                          key={p.characterId}
                          src={p.character.avatar}
                          alt={p.character.name}
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                      ))}
                      {meeting.participants.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                          +{meeting.participants.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 创建会议表单 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">创建会议室</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会议标题</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="例如：产品需求讨论会"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会议主题</label>
                <textarea
                  value={meetingTopic}
                  onChange={(e) => setMeetingTopic(e.target.value)}
                  placeholder="描述会议要讨论的内容..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择参与者</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {characters.length === 0 ? (
                    <div className="text-center text-gray-500 py-4 text-sm">
                      暂无角色，请先创建角色
                    </div>
                  ) : (
                    characters.map(character => (
                      <div key={character.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => toggleParticipant(character.id)}>
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(character.id)}
                          onChange={() => toggleParticipant(character.id)}
                          className="w-4 h-4 text-[#07C160] rounded cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <img
                          src={character.avatar}
                          alt={character.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{character.name}</div>
                          <div className="text-xs text-gray-500">{character.title}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedParticipants.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2">参与者设置</h4>
                  <div className="space-y-2">
                    {selectedParticipants.map(characterId => {
                      const character = characters.find(c => c.id === characterId)!;
                      const settings = participantSettings[characterId] || {};
                      return (
                        <div key={characterId} className="flex items-center gap-2 text-sm">
                          <span className="w-20 truncate">{character.name}</span>
                          <input
                            type="number"
                            value={settings.maxLength || maxLength}
                            onChange={(e) => updateParticipantSetting(characterId, 'maxLength', parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="字数"
                          />
                          <span className="text-xs text-gray-500">字</span>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={settings.canSeeOthers ?? (contextMode === 'discussion')}
                              onChange={(e) => updateParticipantSetting(characterId, 'canSeeOthers', e.target.checked)}
                              className="w-3 h-3"
                            />
                            可见他人
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">默认字数限制</label>
                  <input
                    type="number"
                    value={maxLength}
                    onChange={(e) => setMaxLength(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">讨论轮数</label>
                  <input
                    type="number"
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                    min={1}
                    max={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">对话模式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="independent"
                      checked={contextMode === 'independent'}
                      onChange={(e) => setContextMode(e.target.value as 'independent')}
                      className="w-4 h-4 text-[#07C160]"
                    />
                    <span className="text-sm">独立回复（只看主持人）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="discussion"
                      checked={contextMode === 'discussion'}
                      onChange={(e) => setContextMode(e.target.value as 'discussion')}
                      className="w-4 h-4 text-[#07C160]"
                    />
                    <span className="text-sm">讨论模式（互相可见）</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateMeeting}
                className="px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56]"
              >
                创建会议
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 会议室界面 */}
      {currentMeeting && (
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧参与者列表 */}
          <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 shrink-0">
            {currentMeeting.participants.map((p, index) => {
              const colors = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
              return (
                <div key={p.characterId} className="mb-3 relative group">
                  <div className={`w-10 h-10 rounded-lg overflow-hidden border-2 ${colors.border}`}>
                    <img
                      src={p.character.avatar}
                      alt={p.character.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                    {p.character.name}
                  </div>
                  {/* 颜色指示器 */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                    <span className={`text-[8px] font-bold ${colors.name}`}>{index + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 中间消息区域 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 会议信息 */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold text-gray-900">{currentMeeting.title}</h3>
              {currentMeeting.topic && (
                <p className="text-sm text-gray-500 mt-0.5">{currentMeeting.topic}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-gray-400">第 {currentMeeting.currentRound}/{currentMeeting.maxRounds} 轮</span>
                
                {/* 模式切换按钮 */}
                <button
                  onClick={() => {
                    const newMode: 'independent' | 'discussion' = currentMeeting.contextMode === 'discussion' ? 'independent' : 'discussion';
                    const updatedMeeting = { ...currentMeeting, contextMode: newMode, updatedAt: Date.now() };
                    setCurrentMeeting(updatedMeeting);
                    // 更新存储
                    meetingStorage.updateMeeting(updatedMeeting);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                    currentMeeting.contextMode === 'discussion'
                      ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                  title="点击切换模式"
                >
                  {currentMeeting.contextMode === 'discussion' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      讨论模式
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      独立回复
                    </>
                  )}
                </button>
                
                {settings.voiceEnabled && (
                  <span className="flex items-center gap-1 text-[#07C160]">
                    <Volume2 className="w-3 h-3" />
                    语音朗读开启
                  </span>
                )}
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {currentMeeting.messages.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>开始会议，输入你的问题或话题</p>
                </div>
              ) : (
                currentMeeting.messages.map((message, index) => {
                  const colors = message.role === 'user' 
                    ? { bg: 'bg-[#07C160]', border: 'border-[#07C160]', text: 'text-white', name: 'text-white' }
                    : getParticipantColors(message.characterId);
                  const participant = currentMeeting.participants.find(p => p.characterId === message.characterId);
                  const isSpeakingThis = speakingMessageId === message.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {/* 头像 */}
                      {message.role === 'user' ? (
                        <div className="w-10 h-10 rounded-lg bg-[#07C160] flex items-center justify-center text-white font-semibold shrink-0 shadow-sm">
                          主
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-sm border-2 ${colors.border}`}>
                          <img
                            src={participant?.character.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* 消息内容 */}
                      <div className={`max-w-[75%] ${message.role === 'user' ? 'text-right' : ''}`}>
                        {/* 名称和时间 */}
                        <div className="flex items-center gap-2 mb-1">
                          {message.role === 'user' ? (
                            <>
                              <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                              <span className="text-xs font-medium text-[#07C160]">主持人</span>
                            </>
                          ) : (
                            <>
                              <span className={`text-xs font-medium ${colors.name}`}>
                                {participant?.character.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                第{message.round}轮 · {formatTime(message.timestamp)}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* 消息气泡 */}
                        <div className="flex items-start gap-2">
                          {message.role !== 'user' && (
                            <div 
                              className={`w-2 h-2 mt-3 ${colors.bg}`}
                              style={{ clipPath: 'polygon(100% 50%, 0 0, 0 100%)' }}
                            />
                          )}
                          <div
                            className={`inline-block px-4 py-2.5 rounded-lg text-sm shadow-sm ${
                              message.role === 'user'
                                ? 'bg-[#07C160] text-white rounded-tr-none'
                                : `${colors.bg} ${colors.text} ${colors.border} border rounded-tl-none`
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-left">{message.content}</p>
                          </div>
                          {message.role === 'user' && (
                            <div 
                              className="w-2 h-2 mt-3 bg-[#07C160]"
                              style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }}
                            />
                          )}
                        </div>
                        
                        {/* 语音朗读按钮（仅角色消息） */}
                        {message.role !== 'user' && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => isSpeakingThis ? stopSpeaking() : speakMessage(message.content, message.id)}
                              className={`p-1 rounded-full transition-colors ${
                                isSpeakingThis 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                              }`}
                              title={isSpeakingThis ? '停止朗读' : '朗读消息'}
                            >
                              {isSpeakingThis ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="bg-white border-t border-gray-200 px-4 py-3">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2 py-3 text-gray-500">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-2 text-sm">正在收集各方意见...</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.target as HTMLFormElement).elements.namedItem('message') as HTMLInputElement;
                    if (input.value.trim()) {
                      handleSendMessage(input.value);
                      input.value = '';
                    }
                  }}
                  className="flex gap-2"
                >
                  {/* 语音输入按钮 */}
                  {settings.voiceInputEnabled && (
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={`p-2.5 rounded-lg transition-colors shrink-0 ${
                        isListening 
                          ? 'bg-red-500 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={isListening ? '停止录音' : '语音输入'}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                  
                  <input
                    ref={inputRef}
                    name="message"
                    type="text"
                    placeholder={isListening ? '正在听...' : '输入你的问题或话题...'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#07C160] text-white rounded-lg hover:bg-[#06AD56] transition-colors"
                  >
                    发送
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* 右侧设置面板 */}
          <div className="w-48 bg-white border-l border-gray-200 p-4 shrink-0">
            <h4 className="text-sm font-medium text-gray-700 mb-3">语音设置</h4>
            
            {/* 语音朗读开关 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-600">自动朗读</span>
              <button
                onClick={() => {
                  const newValue = !settings.voiceEnabled;
                  const newSettings = { ...settings, voiceEnabled: newValue };
                  setSettings(newSettings);
                  localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                  if (!newValue) stopSpeaking();
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  settings.voiceEnabled ? 'bg-[#07C160]' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  settings.voiceEnabled ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* 语音输入开关 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-600">语音输入</span>
              <button
                onClick={() => {
                  const newValue = !settings.voiceInputEnabled;
                  const newSettings = { ...settings, voiceInputEnabled: newValue };
                  setSettings(newSettings);
                  localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  settings.voiceInputEnabled ? 'bg-[#07C160]' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  settings.voiceInputEnabled ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>

            {settings.voiceEnabled && (
              <>
                {/* 声音选择 */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">声音选择</label>
                  <select
                    value={settings.voiceURI}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const newSettings = { ...settings, voiceURI: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#07C160] focus:border-[#07C160] bg-white"
                  >
                    <option value="">默认声音</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">音量 {Math.round(settings.voiceVolume * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.voiceVolume}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      const newSettings = { ...settings, voiceVolume: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">语速 {settings.voiceRate.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={settings.voiceRate}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      const newSettings = { ...settings, voiceRate: newValue };
                      setSettings(newSettings);
                      localStorage.setItem('ai_app_settings', JSON.stringify(newSettings));
                    }}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* 参与者图例 */}
            <h4 className="text-sm font-medium text-gray-700 mb-3 mt-6">参与者</h4>
            <div className="space-y-2">
              {currentMeeting.participants.map((p, index) => {
                const colors = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
                return (
                  <div key={p.characterId} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colors.bg} ${colors.border} border`} />
                    <span className="text-xs text-gray-600 truncate">{p.character.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
