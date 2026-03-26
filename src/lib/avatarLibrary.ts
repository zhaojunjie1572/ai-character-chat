// 扩展头像库 - 多种风格

export interface AvatarStyle {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
}

export const AVATAR_STYLES: AvatarStyle[] = [
  {
    id: 'avataaars',
    name: '卡通人物',
    icon: '👤',
    baseUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=',
  },
  {
    id: 'notionists',
    name: '简约线条',
    icon: '✏️',
    baseUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=',
  },
  {
    id: 'micah',
    name: '商务风格',
    icon: '💼',
    baseUrl: 'https://api.dicebear.com/7.x/micah/svg?seed=',
  },
  {
    id: 'adventurer',
    name: '冒险家',
    icon: '🏔️',
    baseUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=',
  },
  {
    id: 'fun-emoji',
    name: '趣味表情',
    icon: '😄',
    baseUrl: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=',
  },
  {
    id: 'lorelei',
    name: '手绘风格',
    icon: '🎨',
    baseUrl: 'https://api.dicebear.com/7.x/lorelei/svg?seed=',
  },
  {
    id: 'pixel-art',
    name: '像素艺术',
    icon: '👾',
    baseUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=',
  },
  {
    id: 'bottts',
    name: '机器人',
    icon: '🤖',
    baseUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=',
  },
];

// 预设种子名称，用于生成多样化的头像
const SEED_NAMES = [
  'alex', 'bob', 'carol', 'david', 'emma', 'frank', 'grace', 'henry',
  'iris', 'jack', 'kate', 'leo', 'mary', 'nick', 'olivia', 'peter',
  'queen', 'robert', 'sarah', 'tom', 'una', 'victor', 'wendy', 'xavier',
  'yolanda', 'zack', 'alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot',
];

// 生成指定风格的头像列表
export function generateAvatarsForStyle(styleId: string, count: number = 8): string[] {
  const style = AVATAR_STYLES.find(s => s.id === styleId);
  if (!style) return [];

  return SEED_NAMES.slice(0, count).map(seed => `${style.baseUrl}${seed}`);
}

// 获取所有风格的头像（用于展示）
export function getAllAvatars(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  AVATAR_STYLES.forEach(style => {
    result[style.id] = generateAvatarsForStyle(style.id, 6);
  });
  return result;
}

// 根据角色名称生成固定头像（确保同一角色始终获得相同头像）
export function getAvatarForCharacter(name: string, styleId: string = 'avataaars'): string {
  const style = AVATAR_STYLES.find(s => s.id === styleId) || AVATAR_STYLES[0];
  // 使用名称作为种子，确保一致性
  const seed = name.toLowerCase().replace(/\s+/g, '');
  return `${style.baseUrl}${seed}`;
}

// 颜色映射（用于首字母头像）
export function stringToColor(str: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#AF7AC5', '#5499C7', '#48C9B0', '#F4D03F',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// 获取首字母
export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}
