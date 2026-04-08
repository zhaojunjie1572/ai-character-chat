import { MeetingSession, MeetingMessage, MeetingParticipant } from '@/types/meeting';
import { Character } from '@/types/character';
import { v4 as uuidv4 } from 'uuid';

const MEETINGS_KEY = 'ai_meetings';
const CURRENT_MEETING_KEY = 'ai_current_meeting';

export const meetingStorage = {
  // 获取所有会议室
  getMeetings: (): MeetingSession[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(MEETINGS_KEY);
    return data ? JSON.parse(data) : [];
  },

  // 保存会议室列表
  saveMeetings: (meetings: MeetingSession[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
  },

  // 获取指定会议室
  getMeeting: (meetingId: string): MeetingSession | null => {
    const meetings = meetingStorage.getMeetings();
    return meetings.find(m => m.id === meetingId) || null;
  },

  // 创建新会议室
  createMeeting: (
    title: string,
    topic: string,
    participants: MeetingParticipant[],
    maxRounds: number = 3,
    contextMode: 'independent' | 'discussion' = 'independent'
  ): MeetingSession => {
    const meeting: MeetingSession = {
      id: uuidv4(),
      title,
      topic,
      participants: participants.sort((a, b) => a.order - b.order),
      messages: [],
      currentRound: 1,
      maxRounds,
      isActive: true,
      contextMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const meetings = meetingStorage.getMeetings();
    meetings.unshift(meeting);
    meetingStorage.saveMeetings(meetings);
    meetingStorage.setCurrentMeeting(meeting.id);

    return meeting;
  },

  // 更新会议室
  updateMeeting: (meeting: MeetingSession): void => {
    const meetings = meetingStorage.getMeetings();
    const index = meetings.findIndex(m => m.id === meeting.id);
    if (index >= 0) {
      meetings[index] = { ...meeting, updatedAt: Date.now() };
      meetingStorage.saveMeetings(meetings);
    }
  },

  // 删除会议室
  deleteMeeting: (meetingId: string): void => {
    const meetings = meetingStorage.getMeetings().filter(m => m.id !== meetingId);
    meetingStorage.saveMeetings(meetings);
    
    // 如果删除的是当前会议室，清除当前会议室
    const currentId = meetingStorage.getCurrentMeetingId();
    if (currentId === meetingId) {
      localStorage.removeItem(CURRENT_MEETING_KEY);
    }
  },

  // 获取当前会议室ID
  getCurrentMeetingId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_MEETING_KEY);
  },

  // 设置当前会议室
  setCurrentMeeting: (meetingId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CURRENT_MEETING_KEY, meetingId);
  },

  // 添加消息到会议室
  addMessage: (meetingId: string, message: Omit<MeetingMessage, 'id' | 'timestamp'>): string => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    const newMessage: MeetingMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    meeting.messages.push(newMessage);
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);

    return newMessage.id;
  },

  // 更新消息内容（用于流式响应）
  updateMessageContent: (meetingId: string, messageId: string, content: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    const messageIndex = meeting.messages.findIndex(m => m.id === messageId);
    if (messageIndex >= 0) {
      meeting.messages[messageIndex].content = content;
      meeting.updatedAt = Date.now();
      meetingStorage.updateMeeting(meeting);
    }
  },

  // 删除单条消息
  deleteMessage: (meetingId: string, messageId: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    meeting.messages = meeting.messages.filter(m => m.id !== messageId);
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);
  },

  // 清空所有消息
  clearAllMessages: (meetingId: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    meeting.messages = [];
    meeting.currentRound = 1;
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);
  },

  // 进入下一轮
  nextRound: (meetingId: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    if (meeting.currentRound < meeting.maxRounds) {
      meeting.currentRound++;
      meeting.updatedAt = Date.now();
      meetingStorage.updateMeeting(meeting);
    }
  },

  // 结束会议室
  endMeeting: (meetingId: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    meeting.isActive = false;
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);
  },

  // 添加参与者到会议室
  addParticipant: (meetingId: string, character: Character): MeetingParticipant => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    const newParticipant: MeetingParticipant = {
      characterId: character.id,
      character,
      order: meeting.participants.length,
      maxLength: 300,
      canSeeOthers: meeting.contextMode === 'discussion',
      isActive: true,
    };

    meeting.participants.push(newParticipant);
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);

    return newParticipant;
  },

  // 从会议室移除参与者
  removeParticipant: (meetingId: string, characterId: string): void => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    meeting.participants = meeting.participants.filter(p => p.characterId !== characterId);
    // 重新排序
    meeting.participants.forEach((p, index) => {
      p.order = index;
    });
    meeting.updatedAt = Date.now();
    meetingStorage.updateMeeting(meeting);
  },

  // 获取会议室的上下文消息（用于构建prompt）
  getContextMessages: (meetingId: string, currentParticipantId: string, contextMode: 'independent' | 'discussion'): string => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) return '';

    if (contextMode === 'independent') {
      // 独立模式：只返回主持人的消息
      const hostMessages = meeting.messages.filter(m => m.role === 'user');
      return hostMessages.map(m => `主持人：${m.content}`).join('\n');
    } else {
      // 讨论模式：返回所有消息
      return meeting.messages.map(m => {
        if (m.role === 'user') {
          return `主持人：${m.content}`;
        } else {
          const participant = meeting.participants.find(p => p.characterId === m.characterId);
          const name = participant?.character.name || '参与者';
          return `${name}：${m.content}`;
        }
      }).join('\n');
    }
  },

  // 导出会议室记录
  exportMeeting: (meetingId: string): string => {
    const meeting = meetingStorage.getMeeting(meetingId);
    if (!meeting) throw new Error('会议室不存在');

    let exportText = `# ${meeting.title}\n\n`;
    exportText += `主题：${meeting.topic}\n`;
    exportText += `时间：${new Date(meeting.createdAt).toLocaleString()}\n`;
    exportText += `参与者：${meeting.participants.map(p => p.character.name).join('、')}\n\n`;
    exportText += `---\n\n`;

    meeting.messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        exportText += `【主持人】\n${msg.content}\n\n`;
      } else {
        const participant = meeting.participants.find(p => p.characterId === msg.characterId);
        const name = participant?.character.name || '参与者';
        exportText += `【${name}】（第${msg.round}轮）\n${msg.content}\n\n`;
      }
    });

    exportText += `---\n\n会议结束`;
    return exportText;
  },
};
