import { Character, Message } from './character';

// 会议室参与者
export interface MeetingParticipant {
  characterId: string;
  character: Character;
  order: number; // 发言顺序
  maxLength: number; // 最大字数限制
  canSeeOthers: boolean; // 是否能看到其他参与者的发言
  isActive: boolean; // 是否参与当前轮次
}

// 会议室消息
export interface MeetingMessage extends Message {
  meetingId: string;
  round: number; // 第几轮讨论
  participantOrder: number; // 参与者顺序
}

// 会议室会话
export interface MeetingSession {
  id: string;
  title: string;
  topic: string; // 会议主题
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  currentRound: number;
  maxRounds: number; // 最大讨论轮数
  isActive: boolean;
  contextMode: 'independent' | 'discussion'; // independent: 独立回复, discussion: 讨论模式
  createdAt: number;
  updatedAt: number;
}

// 会议配置
export interface MeetingConfig {
  title: string;
  topic: string;
  participantIds: string[];
  maxLength: number; // 默认字数限制
  maxRounds: number;
  contextMode: 'independent' | 'discussion';
}
