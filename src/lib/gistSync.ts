import { Character, ChatSession, CharacterGroup } from '@/types/character';

export interface GistConfig {
  token: string;
  gistId: string;
}

export interface SyncData {
  characters: Character[];
  chatSessions: Record<string, ChatSession>;
  characterGroups: CharacterGroup[];
  settings: Record<string, any>;
  version: string;
  lastSync: number;
}

const GIST_FILENAME = 'san-da-tong-data.json';
const DATA_VERSION = '2.0';

export class GistSyncService {
  private token: string = '';
  private gistId: string = '';

  setConfig(token: string, gistId: string = '') {
    this.token = token;
    this.gistId = gistId;
  }

  async createGist(data: SyncData): Promise<string> {
    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          description: '三达通 - 角色和配置同步数据',
          public: false,
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GitHub API 错误:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('GitHub Token 无效或已过期，请检查 Token 是否正确');
        } else if (response.status === 403) {
          throw new Error('GitHub Token 没有 Gist 权限，请在 Token 设置中勾选 gist 权限');
        } else {
          throw new Error(errorData.message || `创建 Gist 失败 (${response.status})`);
        }
      }

      const gist = await response.json();
      return gist.id;
    } catch (error: any) {
      console.error('创建 Gist 失败:', error);
      throw error;
    }
  }

  async updateGist(data: SyncData): Promise<void> {
    if (!this.gistId) {
      throw new Error('没有 Gist ID');
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          description: '三达通 - 角色和配置同步数据',
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GitHub API 错误:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('GitHub Token 无效或已过期');
        } else if (response.status === 404) {
          throw new Error('Gist 不存在，请清空 Gist ID 后重新同步');
        } else if (response.status === 403) {
          throw new Error('没有权限更新此 Gist，请检查 Token 权限或清空 Gist ID');
        } else {
          throw new Error(errorData.message || `更新 Gist 失败 (${response.status})`);
        }
      }
    } catch (error: any) {
      console.error('更新 Gist 失败:', error);
      throw error;
    }
  }

  async fetchGist(): Promise<SyncData | null> {
    if (!this.gistId) {
      throw new Error('没有 Gist ID');
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GitHub API 错误:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('GitHub Token 无效或已过期');
        } else if (response.status === 404) {
          throw new Error('Gist 不存在，请清空 Gist ID 后重新同步');
        } else {
          throw new Error(errorData.message || `获取 Gist 失败 (${response.status})`);
        }
      }

      const gist = await response.json();
      const file = gist.files[GIST_FILENAME];
      
      if (!file) {
        throw new Error('Gist 中没有找到数据文件');
      }

      const content = await fetch(file.raw_url).then(r => r.text());
      return JSON.parse(content);
    } catch (error: any) {
      console.error('获取 Gist 失败:', error);
      throw error;
    }
  }

  async listGists(): Promise<Array<{ id: string; description: string; updated_at: string }>> {
    try {
      const response = await fetch('https://api.github.com/gists', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GitHub API 错误:', response.status, errorData);
        throw new Error(errorData.message || `获取 Gist 列表失败 (${response.status})`);
      }

      const gists = await response.json();
      return gists.map((gist: any) => ({
        id: gist.id,
        description: gist.description || '无描述',
        updated_at: gist.updated_at,
      }));
    } catch (error: any) {
      console.error('获取 Gist 列表失败:', error);
      throw error;
    }
  }

  prepareSyncData(
    characters: Character[],
    chatSessions: Record<string, ChatSession>,
    characterGroups: CharacterGroup[],
    settings: Record<string, any>
  ): SyncData {
    return {
      characters,
      chatSessions,
      characterGroups,
      settings: {
        ...settings,
        apiKey: settings.apiKey ? '***encrypted***' : '',
        gistToken: settings.gistToken ? '***encrypted***' : '',
      },
      version: DATA_VERSION,
      lastSync: Date.now(),
    };
  }

  exportFullData(
    characters: Character[],
    chatSessions: Record<string, ChatSession>,
    characterGroups: CharacterGroup[],
    settings: Record<string, any>
  ): string {
    const data: SyncData = {
      characters,
      chatSessions,
      characterGroups,
      settings,
      version: DATA_VERSION,
      lastSync: Date.now(),
    };
    return JSON.stringify(data, null, 2);
  }

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
