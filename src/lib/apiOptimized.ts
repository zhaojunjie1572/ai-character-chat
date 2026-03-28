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

class APIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'APIError';
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class APIService {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private retryCount: number = 3;
  private timeout: number = 60000;

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

  setRetryConfig(retryCount: number, timeout: number) {
    this.retryCount = retryCount;
    this.timeout = timeout;
  }

  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.retryCount
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.isRetryable(error)) {
        console.warn(`请求失败，${this.retryCount - retries + 1}秒后重试...`);
        await delay(1000 * (this.retryCount - retries + 1));
        return this.requestWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryable(error: any): boolean {
    if (error instanceof APIError) {
      return error.status ? error.status >= 500 || error.status === 429 : false;
    }
    return error.name !== 'AbortError';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await this.requestWithRetry(async () => {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
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
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const error = await response.json();
            errorMessage = error.error?.message || errorMessage;
          } catch {
            // 忽略解析错误
          }
          throw new APIError(errorMessage, response.status);
        }

        const data = await response.json();
        return {
          content: data.choices[0]?.message?.content || '',
        };
      });
    } catch (error) {
      if (error instanceof APIError) {
        return {
          content: '',
          error: error.message,
        };
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          content: '',
          error: '请求超时，请稍后重试',
        };
      }
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || errorMessage;
        } catch {
          // 忽略解析错误
        }
        throw new APIError(errorMessage, response.status);
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
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const apiService = new APIService();
