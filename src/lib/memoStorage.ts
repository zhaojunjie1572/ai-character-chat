export interface MemoItem {
  id: string;
  content: string;
  characterName: string;
  characterAvatar?: string;
  timestamp: number;
  tags?: string[];
}

const MEMOS_KEY = 'ai_memos';

export const memoStorage = {
  // 获取所有备忘录
  getMemos: (): MemoItem[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(MEMOS_KEY);
    return data ? JSON.parse(data) : [];
  },

  // 保存备忘录列表
  saveMemos: (memos: MemoItem[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  },

  // 添加备忘录
  addMemo: (content: string, characterName: string, characterAvatar?: string): MemoItem => {
    const memos = memoStorage.getMemos();
    const newMemo: MemoItem = {
      id: Date.now().toString(),
      content,
      characterName,
      characterAvatar,
      timestamp: Date.now(),
    };
    memos.unshift(newMemo);
    memoStorage.saveMemos(memos);
    return newMemo;
  },

  // 删除备忘录
  deleteMemo: (id: string): void => {
    const memos = memoStorage.getMemos().filter(m => m.id !== id);
    memoStorage.saveMemos(memos);
  },

  // 更新备忘录
  updateMemo: (id: string, updates: Partial<MemoItem>): void => {
    const memos = memoStorage.getMemos();
    const index = memos.findIndex(m => m.id === id);
    if (index >= 0) {
      memos[index] = { ...memos[index], ...updates };
      memoStorage.saveMemos(memos);
    }
  },

  // 搜索备忘录
  searchMemos: (keyword: string): MemoItem[] => {
    const memos = memoStorage.getMemos();
    if (!keyword.trim()) return memos;
    const lowerKeyword = keyword.toLowerCase();
    return memos.filter(m => 
      m.content.toLowerCase().includes(lowerKeyword) ||
      m.characterName.toLowerCase().includes(lowerKeyword)
    );
  },
};
