'use client';

import { useState, useRef, useEffect } from 'react';
import { Character } from '@/types/character';
import { MeetingSession, MeetingParticipant, MeetingMessage } from '@/types/meeting';
import { meetingStorage } from '@/lib/meetingStorage';
import { apiService } from '@/lib/api';
import { X, Plus, Users, MessageCircle, Download, ChevronRight, ChevronLeft, Settings, Play, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface MeetingRoomProps {
  characters: Character[];
  onClose: () => void;
}

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

export function MeetingRoom({ characters, onClose }: MeetingRoomProps) {
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<MeetingSession | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMeetingList, setShowMeetingList] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');

  // 创建表单状态
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [maxLength, setMaxLength] = useState(300);
  const [maxRounds, setMaxRounds] = useState(3);
  const [contextMode, setContextMode] = useState<'independent' | 'discussion'>('independent');
  const [participantSettings, setParticipantSettings] = useState<Record<string, { maxLength: number; canSeeOthers: boolean }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMeetings();
    const savedSettings = localStorage.getItem('ai_app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({
        apiKey: parsed.apiKey || '',
        apiBaseURL: parsed.apiBaseURL || 'https://api.openai.com/v1',
        apiModel: parsed.apiModel || 'gpt-3.5-turbo',
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMeeting?.messages]);

  const loadMeetings = () => {
    const allMeetings = meetingStorage.getMeetings();
    setMeetings(allMeetings);
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `主持人说：${content.trim()}\n\n请给出你的专业意见（${participant.maxLength}字以内）：` },
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
              onClick={() => { setCurrentMeeting(null); setShowMeetingList(true); }}
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
                  {characters.map(character => (
                    <div key={character.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(character.id)}
                        onChange={() => toggleParticipant(character.id)}
                        className="w-4 h-4 text-[#07C160] rounded"
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
                  ))}
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
            {currentMeeting.participants.map(p => (
              <div key={p.characterId} className="mb-3 relative group">
                <img
                  src={p.character.avatar}
                  alt={p.character.name}
                  className="w-10 h-10 rounded-lg object-cover border-2 border-transparent hover:border-[#07C160] transition-colors"
                />
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                  {p.character.name}
                </div>
              </div>
            ))}
          </div>

          {/* 中间消息区域 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 会议信息 */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold text-gray-900">{currentMeeting.title}</h3>
              {currentMeeting.topic && (
                <p className="text-sm text-gray-500 mt-0.5">{currentMeeting.topic}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>第 {currentMeeting.currentRound}/{currentMeeting.maxRounds} 轮</span>
                <span>{currentMeeting.contextMode === 'discussion' ? '讨论模式' : '独立回复'}</span>
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
                currentMeeting.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {message.role === 'user' ? (
                      <div className="w-10 h-10 rounded-lg bg-[#07C160] flex items-center justify-center text-white font-semibold shrink-0">
                        主
                      </div>
                    ) : (
                      <img
                        src={currentMeeting.participants.find(p => p.characterId === message.characterId)?.character.avatar}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className={`max-w-[70%] ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div className="text-xs text-gray-500 mb-1">
                        {message.role === 'user' ? '主持人' : currentMeeting.participants.find(p => p.characterId === message.characterId)?.character.name}
                        <span className="ml-2">{formatTime(message.timestamp)}</span>
                        {message.role !== 'user' && (
                          <span className="ml-2">第{message.round}轮</span>
                        )}
                      </div>
                      <div
                        className={`inline-block px-4 py-2 rounded-lg text-sm ${
                          message.role === 'user'
                            ? 'bg-[#07C160] text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))
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
                  <input
                    name="message"
                    type="text"
                    placeholder="输入你的问题或话题..."
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
        </div>
      )}
    </div>
  );
}
