import { Message } from '@/types/character';

export interface ChatRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  error?: string;
}

export class APIService {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.openai.com/v1';
    this.model = process.env.NEXT_PUBLIC_API_MODEL || 'gpt-3.5-turbo';
  }

  setConfig(apiKey: string, baseURL?: string, model?: string) {
    this.apiKey = apiKey;
    if (baseURL) this.baseURL = baseURL;
    if (model) this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 检查 API Key
    if (!this.apiKey || this.apiKey.trim() === '') {
      return {
        content: '',
        error: 'API 密钥未设置，请先配置 API 密钥',
      };
    }

    // 检查 baseURL
    if (!this.baseURL || this.baseURL.trim() === '') {
      return {
        content: '',
        error: 'API 基础 URL 未设置',
      };
    }

    // 确保 baseURL 不以斜杠结尾
    const baseURL = this.baseURL.replace(/\/$/, '');

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model || this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 2000,
          stream: request.stream ?? false,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        // 尝试解析错误响应
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error?.message || error.message || errorMessage;
          } else {
            // 如果不是 JSON，尝试获取文本
            const text = await response.text();
            if (text) {
              errorMessage = `${errorMessage} - ${text.substring(0, 200)}`;
            }
          }
        } catch (parseError) {
          // 解析错误时，使用状态码
          errorMessage = `请求失败 (${response.status}): ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // 检查响应格式
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('API 返回格式错误：缺少 choices 字段');
      }

      return {
        content: data.choices[0]?.message?.content || '',
      };
    } catch (error) {
      // 网络错误处理
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          content: '',
          error: '网络连接失败，请检查网络或 API 地址是否正确',
        };
      }

      return {
        content: '',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // 流式聊天（用于实时显示回复）
  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('API 密钥未设置');
    }

    const baseURL = this.baseURL.replace(/\/$/, '');

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } else {
          const text = await response.text();
          if (text) {
            errorMessage = `${errorMessage} - ${text.substring(0, 200)}`;
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiService = new APIService();
