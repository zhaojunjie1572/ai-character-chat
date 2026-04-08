/**
 * 增强版API服务 - 支持多种API提供商格式
 * 兼容 OpenAI、Azure OpenAI、Claude、Gemini、Ollama 等
 */

import { Message } from '@/types/character';

// ==================== 类型定义 ====================

export type ApiProvider = 'openai' | 'azure' | 'claude' | 'gemini' | 'ollama' | 'local_proxy' | 'custom';

export interface ChatRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatResponse {
  content: string;
  error?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface APIConfig {
  provider: ApiProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

// ==================== 错误类 ====================

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = '网络连接失败') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = '请求超时') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ==================== 工具函数 ====================

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 检测API提供商
function detectProvider(baseURL: string, model: string): ApiProvider {
  const url = baseURL.toLowerCase();
  const modelLower = model.toLowerCase();

  if (url.includes('azure') || url.includes('microsoft')) return 'azure';
  if (url.includes('anthropic') || modelLower.includes('claude')) return 'claude';
  if (url.includes('google') || url.includes('gemini') || modelLower.includes('gemini')) return 'gemini';
  if (url.includes('ollama') || url.includes('localhost:11434')) return 'ollama';
  if (url.includes('openai')) return 'openai';

  return 'custom';
}

// 构建不同提供商的请求体
function buildRequestBody(provider: ApiProvider, request: ChatRequest, model: string): any {
  const baseBody = {
    model: request.model || model,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens ?? 2000,
    stream: request.stream ?? false,
  };

  switch (provider) {
    case 'claude':
      return {
        model: baseBody.model,
        messages: request.messages.filter(m => m.role !== 'system'),
        system: request.messages.find(m => m.role === 'system')?.content,
        temperature: baseBody.temperature,
        max_tokens: baseBody.max_tokens,
        stream: baseBody.stream,
      };

    case 'gemini':
      return {
        contents: request.messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: baseBody.temperature,
          maxOutputTokens: baseBody.max_tokens,
        },
      };

    case 'ollama':
      return {
        model: baseBody.model,
        messages: request.messages,
        stream: baseBody.stream,
        options: {
          temperature: baseBody.temperature,
          num_predict: baseBody.max_tokens,
        },
      };

    case 'azure':
      return {
        ...baseBody,
        messages: request.messages,
      };

    case 'local_proxy':
      // 本地 HTTP 反代服务使用 OpenAI 兼容格式
      // 去掉 models/ 前缀（如果存在）
      const modelName = baseBody.model.replace(/^models\//, '');
      return {
        ...baseBody,
        model: modelName,
        messages: request.messages,
        top_p: request.top_p ?? 1,
        frequency_penalty: request.frequency_penalty ?? 0,
        presence_penalty: request.presence_penalty ?? 0,
      };

    case 'openai':
    case 'custom':
    default:
      return {
        ...baseBody,
        messages: request.messages,
        top_p: request.top_p ?? 1,
        frequency_penalty: request.frequency_penalty ?? 0,
        presence_penalty: request.presence_penalty ?? 0,
      };
  }
}

// 构建请求头
function buildHeaders(provider: ApiProvider, apiKey: string, customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  switch (provider) {
    case 'azure':
      headers['api-key'] = apiKey;
      break;
    case 'gemini':
      // Gemini 使用 URL 参数传递 key
      break;
    case 'local_proxy':
      // 本地 HTTP 反代服务，如果提供了密码/密钥则使用
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      break;

    case 'openai':
    case 'claude':
    case 'ollama':
    case 'custom':
    default:
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      break;
  }

  return headers;
}

// 构建请求URL
function buildRequestURL(provider: ApiProvider, baseURL: string, model: string, apiKey: string): string {
  const normalizedURL = baseURL.replace(/\/$/, '');

  // 检查 URL 是否已经包含 chat/completions 或类似的完整端点路径
  const hasCompleteEndpoint = normalizedURL.includes('/chat/completions') || 
                              normalizedURL.includes('/completions') ||
                              normalizedURL.includes('/v1/chat') ||
                              normalizedURL.includes('/v1/completions');

  switch (provider) {
    case 'azure':
      return `${normalizedURL}/chat/completions?api-version=2024-02-01`;

    case 'gemini':
      return `${normalizedURL}/models/${model}:generateContent?key=${apiKey}`;

    case 'ollama':
      return `${normalizedURL}/api/chat`;

    case 'claude':
      return `${normalizedURL}/messages`;

    case 'local_proxy':
      // 本地 HTTP 反代服务使用 OpenAI 兼容的 /v1/chat/completions 端点
      // 如果 URL 已经包含 /v1，则不再添加
      if (hasCompleteEndpoint) {
        return normalizedURL;
      }
      if (normalizedURL.endsWith('/v1')) {
        return `${normalizedURL}/chat/completions`;
      }
      return `${normalizedURL}/v1/chat/completions`;

    case 'openai':
      // OpenAI 使用标准格式
      if (hasCompleteEndpoint) {
        return normalizedURL;
      }
      if (normalizedURL.endsWith('/v1')) {
        return `${normalizedURL}/chat/completions`;
      }
      return `${normalizedURL}/v1/chat/completions`;

    case 'custom':
    default:
      // 自定义提供商：如果用户已经提供了完整端点，直接使用
      // 否则，才添加 /v1/chat/completions 后缀
      if (hasCompleteEndpoint) {
        return normalizedURL;
      }
      if (normalizedURL.endsWith('/v1')) {
        return `${normalizedURL}/chat/completions`;
      }
      return `${normalizedURL}/v1/chat/completions`;
  }
}

// 解析响应
function parseResponse(provider: ApiProvider, data: any): ChatResponse {
  switch (provider) {
    case 'claude':
      return {
        content: data.content?.[0]?.text || '',
        usage: data.usage,
        model: data.model,
      };

    case 'gemini':
      return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount,
          completion_tokens: data.usageMetadata?.candidatesTokenCount,
          total_tokens: data.usageMetadata?.totalTokenCount,
        },
      };

    case 'ollama':
      return {
        content: data.message?.content || '',
      };

    case 'local_proxy':
      // 本地 HTTP 反代服务返回 OpenAI 兼容格式
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage,
        model: data.model,
      };

    case 'azure':
    case 'openai':
    case 'custom':
    default:
      // 尝试从多个可能的位置提取内容
      let content = data.choices?.[0]?.message?.content;
      
      // 如果 content 为 null/undefined，尝试其他字段
      if (!content) {
        content = data.choices?.[0]?.message?.reasoning_content;
      }
      if (!content && data.choices?.[0]?.message?.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls;
        try {
          content = toolCalls.map((tc: any) => {
            if (tc.function?.arguments) {
              return tc.function.arguments;
            }
            if (tc.function?.name) {
              return `调用函数: ${tc.function.name}`;
            }
            return JSON.stringify(tc);
          }).join('\n');
        } catch (e) {
          console.warn('Failed to extract tool_calls content:', e);
        }
      }
      
      return {
        content: content || '',
        usage: data.usage,
        model: data.model,
      };
  }
}

// 解析流式响应
function parseStreamChunk(provider: ApiProvider, line: string): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine === 'data: [DONE]') {
    return [{ content: '', done: true }];
  }

  if (!trimmedLine.startsWith('data: ')) return chunks;

  try {
    const data = JSON.parse(trimmedLine.slice(6));

    switch (provider) {
      case 'claude':
        chunks.push({
          content: data.delta?.text || '',
          done: false,
        });
        break;

      case 'ollama':
        chunks.push({
          content: data.message?.content || '',
          done: data.done || false,
        });
        break;

      case 'local_proxy':
        // 本地 HTTP 反代服务使用 OpenAI 兼容的流式格式
        chunks.push({
          content: data.choices?.[0]?.delta?.content || '',
          done: false,
        });
        break;

      case 'azure':
      case 'openai':
      case 'custom':
      default:
        chunks.push({
          content: data.choices?.[0]?.delta?.content || '',
          done: false,
        });
        break;
    }
  } catch (e) {
    // 忽略解析错误
  }

  return chunks;
}

// 检查错误是否可重试
function isRetryableError(error: any): boolean {
  if (error instanceof APIError) {
    return error.retryable || (error.status ? error.status >= 500 || error.status === 429 : false);
  }
  if (error instanceof NetworkError) return true;
  if (error instanceof TimeoutError) return true;
  if (error.name === 'AbortError') return false;
  return true;
}

// ==================== 主服务类 ====================

export class CompatibleAPIService {
  private config: APIConfig;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<APIConfig>) {
    this.config = {
      provider: 'openai',
      apiKey: process.env.NEXT_PUBLIC_API_KEY || '',
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.NEXT_PUBLIC_API_MODEL || 'gpt-3.5-turbo',
      timeout: 60000,
      retryCount: 3,
      retryDelay: 1000,
      ...config,
    };

    // 自动检测提供商
    if (this.config.provider === 'openai' && this.config.baseURL) {
      this.config.provider = detectProvider(this.config.baseURL, this.config.model);
    }
  }

  setConfig(config: Partial<APIConfig>) {
    this.config = { ...this.config, ...config };
    if (config.baseURL && !config.provider) {
      this.config.provider = detectProvider(this.config.baseURL, this.config.model);
    }
  }

  getConfig(): APIConfig {
    return { ...this.config };
  }

  // 取消当前请求
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // 带重试的请求
  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.config.retryCount!
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && isRetryableError(error)) {
        const delayMs = this.config.retryDelay! * (this.config.retryCount! - retries + 1);
        console.warn(`请求失败，${delayMs}ms后重试...剩余重试次数: ${retries}`);
        await delay(delayMs);
        return this.requestWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  // 执行fetch请求
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal,
      });
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new TimeoutError();
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('网络连接失败，请检查网络或API地址');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 处理HTTP错误
  private async handleHTTPError(response: Response): Promise<never> {
    let errorMessage = `HTTP error! status: ${response.status}`;
    let errorCode: string | undefined;
    let retryable = false;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || error.error || errorMessage;
        errorCode = error.error?.code || error.code;
      } else {
        const text = await response.text();
        if (text) {
          errorMessage = `${errorMessage} - ${text.substring(0, 200)}`;
        }
      }
    } catch (parseError) {
      errorMessage = `请求失败 (${response.status}): ${response.statusText}`;
    }

    // 根据状态码判断是否可以重试
    retryable = response.status >= 500 || response.status === 429 || response.status === 408;

    throw new APIError(errorMessage, response.status, errorCode, retryable);
  }

  // 普通聊天请求
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 验证配置
    if (!this.config.apiKey && this.config.provider !== 'ollama') {
      return {
        content: '',
        error: 'API 密钥未设置，请先配置 API 密钥',
      };
    }

    if (!this.config.baseURL) {
      return {
        content: '',
        error: 'API 基础 URL 未设置',
      };
    }

    return this.requestWithRetry(async () => {
      const url = buildRequestURL(this.config.provider, this.config.baseURL, this.config.model, this.config.apiKey);
      const headers = buildHeaders(this.config.provider, this.config.apiKey, this.config.headers);
      const body = buildRequestBody(this.config.provider, request, this.config.model);

      // Gemini 使用 URL 参数传递 key，不需要 Authorization header
      let finalUrl = url;
      if (this.config.provider === 'gemini') {
        finalUrl = url; // key 已经在 URL 中
      }

      const response = await this.fetchWithTimeout(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.handleHTTPError(response);
      }

      const data = await response.json();
      return parseResponse(this.config.provider, data);
    }).catch((error) => {
      if (error instanceof APIError) {
        return {
          content: '',
          error: error.message,
        };
      }
      if (error instanceof TimeoutError) {
        return {
          content: '',
          error: '请求超时，请稍后重试',
        };
      }
      if (error instanceof NetworkError) {
        return {
          content: '',
          error: error.message,
        };
      }
      return {
        content: '',
        error: error instanceof Error ? error.message : '未知错误',
      };
    });
  }

  // 流式聊天
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.config.apiKey && this.config.provider !== 'ollama') {
      yield { content: '', done: true, error: 'API 密钥未设置' };
      return;
    }

    try {
      const url = buildRequestURL(this.config.provider, this.config.baseURL, this.config.model, this.config.apiKey);
      const headers = buildHeaders(this.config.provider, this.config.apiKey, this.config.headers);
      const body = buildRequestBody(this.config.provider, { ...request, stream: true }, this.config.model);

      // 为流式请求修改 body
      if (this.config.provider === 'ollama') {
        body.stream = true;
      }

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.handleHTTPError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            yield { content: '', done: true };
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const chunks = parseStreamChunk(this.config.provider, line);
            for (const chunk of chunks) {
              yield chunk;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof APIError) {
        yield { content: '', done: true, error: error.message };
      } else if (error instanceof TimeoutError) {
        yield { content: '', done: true, error: '请求超时' };
      } else if (error instanceof NetworkError) {
        yield { content: '', done: true, error: error.message };
      } else {
        yield { content: '', done: true, error: error instanceof Error ? error.message : '未知错误' };
      }
    }
  }

  // 健康检查
  async healthCheck(): Promise<{ ok: boolean; message: string; latency?: number }> {
    const startTime = Date.now();

    try {
      const testRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      };

      const result = await this.chat(testRequest);
      const latency = Date.now() - startTime;

      if (result.error) {
        return { ok: false, message: result.error, latency };
      }

      return { ok: true, message: '连接正常', latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        ok: false,
        message: error instanceof Error ? error.message : '健康检查失败',
        latency,
      };
    }
  }

  // 获取模型列表（如果API支持）
  async getModels(): Promise<{ id: string; name: string }[]> {
    if (this.config.provider === 'ollama') {
      try {
        const response = await this.fetchWithTimeout(
          `${this.config.baseURL.replace(/\/$/, '')}/api/tags`,
          { method: 'GET' }
        );

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return data.models?.map((m: any) => ({
          id: m.name,
          name: m.name,
        })) || [];
      } catch {
        return [];
      }
    }

    // OpenAI 兼容格式
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseURL.replace(/\/$/, '')}/models`,
        {
          method: 'GET',
          headers: buildHeaders(this.config.provider, this.config.apiKey, this.config.headers),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.data?.map((m: any) => ({
        id: m.id,
        name: m.id,
      })) || [];
    } catch {
      return [];
    }
  }
}

// 创建默认实例
export const apiService = new CompatibleAPIService();

// 导出工厂函数
export function createAPIService(config: Partial<APIConfig>): CompatibleAPIService {
  return new CompatibleAPIService(config);
}

// 导出兼容层 - 保持与旧版API兼容
export const chat = (request: ChatRequest) => apiService.chat(request);
export const chatStream = (request: ChatRequest) => apiService.chatStream(request);
