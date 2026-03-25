import { Character } from '@/types/character';

export interface GistConfig {
  token: string;
  gistId: string;
}

export interface SyncData {
  characters: Character[];
  settings: Record<string, any>;
  version: string;
  lastSync: number;
}

const GIST_FILENAME = 'ai-character-chat-data.json';
const DATA_VERSION = '1.0';

export class GistSyncService {
  private token: string = '';
  private gistId: string = '';

  setConfig(token: string, gistId: string = '') {
    this.token = token;
    this.gistId = gistId;
  }

  // 创建新的 Gist
  async createGist(data: SyncData): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          description: 'AI Character Chat - 角色和配置同步数据',
          public: false,
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '创建 Gist 失败');
      }

      const gist = await response.json();
      return gist.id;
    } catch (error) {
      console.error('创建 Gist 失败:', error);
      return null;
    }
  }

  // 更新现有 Gist
  async updateGist(data: SyncData): Promise<boolean> {
    if (!this.gistId) {
      console.error('没有 Gist ID');
      return false;
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          description: 'AI Character Chat - 角色和配置同步数据',
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '更新 Gist 失败');
      }

      return true;
    } catch (error) {
      console.error('更新 Gist 失败:', error);
      return false;
    }
  }

  // 从 Gist 获取数据
  async fetchGist(): Promise<SyncData | null> {
    if (!this.gistId) {
      console.error('没有 Gist ID');
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取 Gist 失败');
      }

      const gist = await response.json();
      const file = gist.files[GIST_FILENAME];
      
      if (!file) {
        throw new Error('Gist 中没有找到数据文件');
      }

      const content = await fetch(file.raw_url).then(r => r.text());
      return JSON.parse(content);
    } catch (error) {
      console.error('获取 Gist 失败:', error);
      return null;
    }
  }

  // 获取用户的所有 Gists
  async listGists(): Promise<Array<{ id: string; description: string; updated_at: string }>> {
    try {
      const response = await fetch('https://api.github.com/gists', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取 Gist 列表失败');
      }

      const gists = await response.json();
      return gists.map((gist: any) => ({
        id: gist.id,
        description: gist.description || '无描述',
        updated_at: gist.updated_at,
      }));
    } catch (error) {
      console.error('获取 Gist 列表失败:', error);
      return [];
    }
  }

  // 准备同步数据
  prepareSyncData(characters: Character[], settings: Record<string, any>): SyncData {
    return {
      characters,
      settings: {
        ...settings,
        // 不同步敏感信息
        apiKey: settings.apiKey ? '***encrypted***' : '',
      },
      version: DATA_VERSION,
      lastSync: Date.now(),
    };
  }

  // 导出完整数据（包含敏感信息）
  exportFullData(characters: Character[], settings: Record<string, any>): string {
    const data: SyncData = {
      characters,
      settings,
      version: DATA_VERSION,
      lastSync: Date.now(),
    };
    return JSON.stringify(data, null, 2);
  }

  // 导入数据
  importData(jsonString: string): SyncData | null {
    try {
      const data = JSON.parse(jsonString);
      if (!data.characters || !Array.isArray(data.characters)) {
        throw new Error('数据格式不正确');
      }
      return data as SyncData;
    } catch (error) {
      console.error('导入数据失败:', error);
      return null;
    }
  }
}

export const gistSyncService = new GistSyncService();
