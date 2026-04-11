/**
 * 统一增强版 API 服务
 * 整合 ai-character-chat 和 golden-thread 的最佳特性
 * 支持多种 API 提供商格式：OpenAI、Azure、Claude、Gemini、Ollama、DeepSeek、WebSocket、Proxy 等
 */

import { Message } from '@/types/character';

// ==================== 类型定义 ====================

export type ApiProvider = 
  | 'openai' 
  | 'azure' 
  | 'claude' 
  | 'gemini' 
  | 'ollama' 
  | 'deepseek'
  | 'minimax'
  | 'local_proxy' 
  | 'proxy'
  | 'websocket'
  | 'custom';

export interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size: number;
  preview?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  model?: string;
  attachments?: MessageAttachment[];
}

export interface ChatRequest {
  messages: ChatMessage[];
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

export interface StreamChunk {
  content: string;
  done: boolean;
  error?: string;
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
  proxyKey?: string; // 反代服务的密码/密钥
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (model: string) => void;
  onError?: (error: Error) => void;
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
  if (url.includes('deepseek') || modelLower.includes('deepseek')) return 'deepseek';
  if (url.includes('minimax') || modelLower.includes('minimax')) return 'minimax';
  if (url.includes('ws://') || url.includes('wss://')) return 'websocket';
  if (url.includes('openai')) return 'openai';

  return 'custom';
}

// 格式化消息内容（支持附件）
function formatMessageContent(msg: ChatMessage): any {
  let textContent = msg.content || '';
  
  // 如果有普通文件附件，在文本内容中添加文件信息
  if (msg.attachments && msg.attachments.length > 0) {
    const fileAttachments = msg.attachments.filter(att => att.type === 'file');
    if (fileAttachments.length > 0) {
      const fileInfo = fileAttachments.map(att => 
        `- ${att.name} (${(att.size / 1024).toFixed(1)} KB)`
      ).join('\n');
      
      textContent = textContent 
        ? `${textContent}\n\n【附件文件】\n${fileInfo}`
        : `【附件文件】\n${fileInfo}`;
    }
  }
  
  // 如果有图片附件，使用多模态格式
  if (msg.attachments && msg.attachments.some(att => att.type === 'image' && att.preview)) {
    const content: any[] = [
      { type: 'text', text: textContent }
    ];
    
    // 添加图片附件
    msg.attachments.forEach(att => {
      if (att.type === 'image' && att.preview) {
        // 提取 base64 数据（去掉 data:image/xxx;base64, 前缀）
        const base64Data = att.preview.split(',')[1];
        const mimeType = att.preview.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
        
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        });
      }
    });
    
    return content;
  }
  
  // 普通文本消息
  return textContent;
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
        messages: request.messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: formatMessageContent(m),
        })),
        system: request.messages.find(m => m.role === 'system')?.content,
        temperature: baseBody.temperature,
        max_tokens: baseBody.max_tokens,
        stream: baseBody.stream,
      };

    case 'gemini':
      return {
        contents: request.messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: formatMessageContent(m) }],
        })),
        generationConfig: {
          temperature: baseBody.temperature,
          maxOutputTokens: baseBody.max_tokens,
        },
      };

    case 'ollama':
      return {
        model: baseBody.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: formatMessageContent(m),
        })),
        stream: baseBody.stream,
        options: {
          temperature: baseBody.temperature,
          num_predict: baseBody.max_tokens,
        },
      };

    case 'azure':
    case 'deepseek':
    case 'minimax':
      return {
        ...baseBody,
        messages: request.messages.map(m => ({
          role: m.role,
          content: formatMessageContent(m),
        })),
      };

    case 'local_proxy':
    case 'proxy':
      // 本地 HTTP 反代服务使用 OpenAI 兼容格式
      // 去掉 models/ 前缀（如果存在）
      const modelName = baseBody.model.replace(/^models\//, '');
      return {
        ...baseBody,
        model: modelName,
        messages: request.messages.map(m => ({
          role: m.role,
          content: formatMessageContent(m),
        })),
        top_p: request.top_p ?? 1,
        frequency_penalty: request.frequency_penalty ?? 0,
        presence_penalty: request.presence_penalty ?? 0,
      };

    case 'openai':
    case 'custom':
    default:
      return {
        ...baseBody,
        messages: request.messages.map(m => ({
          role: m.role,
          content: formatMessageContent(m),
        })),
        top_p: request.top_p ?? 1,
        frequency_penalty: request.frequency_penalty ?? 0,
        presence_penalty: request.presence_penalty ?? 0,
      };
  }
}

// 构建请求头
function buildHeaders(provider: ApiProvider, apiKey: string, customHeaders?: Record<string, string>, proxyKey?: string): Record<string, string> {
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
      // 本地 HTTP 反代服务
      // 优先使用 proxyKey，如果没有则回退到 apiKey（向后兼容）
      if (proxyKey && proxyKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${proxyKey}`;
      } else if (apiKey && apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      break;
    
    case 'proxy':
      // HTTP 反代服务，只使用 proxyKey（不自动使用 apiKey）
      if (proxyKey && proxyKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${proxyKey}`;
      }
      break;

    case 'openai':
    case 'claude':
    case 'ollama':
    case 'deepseek':
    case 'minimax':
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
                              normalizedURL.includes('/v1/completions') ||
                              normalizedURL.includes('/chatcompletion_v2');

  switch (provider) {
    case 'azure':
      return `${normalizedURL}/chat/completions?api-version=2024-02-01`;

    case 'gemini':
      return `${normalizedURL}/models/${model}:generateContent?key=${apiKey}`;

    case 'ollama':
      return `${normalizedURL}/api/chat`;

    case 'claude':
      return `${normalizedURL}/messages`;

    case 'minimax':
      // Minimax 使用特殊的端点
      if (hasCompleteEndpoint) {
        return normalizedURL;
      }
      return `${normalizedURL}/text/chatcompletion_v2`;

    case 'local_proxy':
    case 'proxy':
      // 本地 HTTP 反代服务使用 OpenAI 兼容的 /v1/chat/completions 端点
      // 如果 URL 已经包含 /v1，则不再添加
      if (hasCompleteEndpoint) {
        return normalizedURL;
      }
      if (normalizedURL.endsWith('/v1')) {
        return `${normalizedURL}/chat/completions`;
      }
      return `${normalizedURL}/v1/chat/completions`;

    case 'deepseek':
    case 'openai':
      // OpenAI 和 DeepSeek 使用标准格式
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
  // 辅助函数：尝试多种可能的字段路径获取内容
  const extractContent = (data: any): string => {
    // 只在开发环境或内容为空时打印调试信息
    const isDebug = !data.choices?.[0]?.message?.content;
    if (isDebug) {
      console.log('响应调试 - 完整响应对象的所有键:', Object.keys(data));
      if (data.choices && data.choices[0]) {
        console.log('响应调试 - choices[0] 的所有键:', Object.keys(data.choices[0]));
        if (data.choices[0].message) {
          console.log('响应调试 - choices[0].message 的所有键:', Object.keys(data.choices[0].message));
        }
      }
    }

    const possiblePaths = [
      // OpenAI 标准格式
      () => data.choices?.[0]?.message?.content,
      // 尝试 choices[0] 的其他字段
      () => data.choices?.[0]?.content,
      () => data.choices?.[0]?.text,
      () => data.choices?.[0]?.message?.text,
      // 尝试整个 choices 数组
      () => data.choices?.[0]?.delta?.content,
      // Claude 格式
      () => data.content?.[0]?.text,
      // Gemini 格式
      () => data.candidates?.[0]?.content?.parts?.[0]?.text,
      // Ollama 格式
      () => data.message?.content,
      // 直接 content 字段
      () => data.content,
      // 直接 text 字段
      () => data.text,
      // 其他可能的格式
      () => data.response,
      () => data.output,
      () => data.result,
      () => data.answer,
      () => data.completion,
      // 推理内容字段 (某些模型如 DeepSeek-R1 使用)
      () => data.choices?.[0]?.message?.reasoning_content,
      () => data.reasoning_content,
      // 额外的可能字段
      () => data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments,
      () => data.generations?.[0]?.text,
      () => data.output?.text,
      () => data.choices?.[0]?.message?.function_call?.arguments,
      // 尝试递归查找任意字符串字段（排除元数据字段）
      () => {
        // 要排除的元数据字段列表
        const excludeKeys = new Set([
          'id', 'object', 'model', 'created', 'finish_reason', 
          'native_finish_reason', 'role', 'index'
        ]);
        
        const findContentString = (obj: any, parentKey?: string): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          
          for (const key of Object.keys(obj)) {
            const value = obj[key];
            
            // 跳过元数据字段
            if (excludeKeys.has(key)) continue;
            
            // 如果是字符串且不是太短（避免一些短的标记），返回它
            if (typeof value === 'string' && value.trim() !== '' && value.length > 20) {
              console.log(`找到可能的内容字段: ${parentKey ? parentKey + '.' : ''}${key}`);
              return value;
            }
            
            // 递归查找
            const found = findContentString(value, parentKey ? `${parentKey}.${key}` : key);
            if (found) return found;
          }
          return null;
        };
        
        return findContentString(data);
      },
    ];

    for (let i = 0; i < possiblePaths.length; i++) {
      try {
        const getPath = possiblePaths[i];
        const value = getPath();
        if (value && typeof value === 'string' && value.trim() !== '') {
          console.log(`Content found at path index ${i}:`, value.substring(0, 100));
          return value;
        }
      } catch (e) {
        console.warn(`Path ${i} failed:`, e);
        // 继续尝试下一个路径
      }
    }
    console.warn('所有路径都尝试过了，没有找到内容');
    return '';
  };

  switch (provider) {
    case 'claude':
      return {
        content: extractContent(data) || data.content?.[0]?.text || '',
        usage: data.usage,
        model: data.model,
      };

    case 'gemini':
      return {
        content: extractContent(data) || data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount,
          completion_tokens: data.usageMetadata?.candidatesTokenCount,
          total_tokens: data.usageMetadata?.totalTokenCount,
        },
      };

    case 'ollama':
      return {
        content: extractContent(data) || data.message?.content || '',
      };

    case 'local_proxy':
    case 'proxy':
    case 'deepseek':
    case 'minimax':
    case 'azure':
    case 'openai':
    case 'custom':
    default:
      // 使用增强的内容提取逻辑
      let content = extractContent(data);
      
      // 如果 content 为空，但存在 tool_calls，尝试从 tool_calls 中提取
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
      
      if (!content) {
        console.warn('Could not extract content from response:', JSON.stringify(data, null, 2));
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

  // 辅助函数：从数据中提取内容
  const extractStreamContent = (data: any): string => {
    const possiblePaths = [
      // 标准 OpenAI 流式格式
      () => data.choices?.[0]?.delta?.content,
      () => data.choices?.[0]?.message?.content,
      () => data.choices?.[0]?.content,
      () => data.choices?.[0]?.text,
      // 其他可能的格式
      () => data.delta?.content,
      () => data.delta?.text,
      () => data.message?.content,
      () => data.content,
      () => data.text,
      // 推理内容
      () => data.choices?.[0]?.delta?.reasoning_content,
      () => data.choices?.[0]?.message?.reasoning_content,
      () => data.reasoning_content,
    ];

    for (const getPath of possiblePaths) {
      try {
        const value = getPath();
        if (value && typeof value === 'string' && value.trim() !== '') {
          return value;
        }
      } catch {
        // 继续尝试
      }
    }
    return '';
  };

  if (!trimmedLine.startsWith('data: ')) {
    // 尝试直接解析（某些反代服务可能不使用 data: 前缀）
    try {
      const data = JSON.parse(trimmedLine);
      const content = extractStreamContent(data);
      if (content) {
        chunks.push({ content, done: false });
      }
    } catch {
      // 忽略解析错误的行
    }
    return chunks;
  }

  try {
    const data = JSON.parse(trimmedLine.slice(6));
    const content = extractStreamContent(data);

    if (content) {
      chunks.push({ content, done: false });
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

export class UnifiedAPIService {
  private config: APIConfig;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<APIConfig>) {
    this.config = {
      provider: 'openai',
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      timeout: 60000,
      retryCount: 3,
      retryDelay: 1000,
      ...config,
    };

    // 自动检测提供商（仅在未明确指定时）
    // 注意：如果用户明确指定了 proxy/websocket 等特殊提供商，不要覆盖
    if (this.config.baseURL && this.config.provider === 'openai') {
      const detected = detectProvider(this.config.baseURL, this.config.model);
      if (detected !== 'custom') {
        this.config.provider = detected;
      }
    }
  }

  setConfig(config: Partial<APIConfig>) {
    this.config = { ...this.config, ...config };
    // 仅在未明确指定提供商时自动检测
    // 避免覆盖用户明确设置的 proxy/websocket 等特殊提供商
    if (config.baseURL && !config.provider && this.config.provider === 'openai') {
      this.config.provider = detectProvider(this.config.baseURL, this.config.model);
    }
    console.log('API Service config:', {
      provider: this.config.provider,
      baseURL: this.config.baseURL,
      model: this.config.model,
    });
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
    // WebSocket 不支持普通请求
    if (this.config.provider === 'websocket') {
      return {
        content: '',
        error: 'WebSocket 提供商不支持普通聊天请求，请使用流式聊天',
      };
    }

    // 验证配置
    if (!this.config.apiKey && 
        this.config.provider !== 'ollama' && 
        this.config.provider !== 'proxy' &&
        this.config.provider !== 'local_proxy') {
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
      const headers = buildHeaders(this.config.provider, this.config.apiKey, this.config.headers, this.config.proxyKey);
      const body = buildRequestBody(this.config.provider, request, this.config.model);

      console.log('Request URL:', url);
      console.log('Request body:', JSON.stringify(body, null, 2));

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
      console.log('Raw API response:', data);
      const parsed = parseResponse(this.config.provider, data);
      console.log('Parsed response:', parsed);
      return parsed;
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

  // 流式聊天 - AsyncGenerator 方式 (ai-character-chat 风格)
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    // WebSocket 特殊处理
    if (this.config.provider === 'websocket') {
      yield* this.webSocketStream(request);
      return;
    }

    if (!this.config.apiKey && 
        this.config.provider !== 'ollama' && 
        this.config.provider !== 'proxy' &&
        this.config.provider !== 'local_proxy') {
      yield { content: '', done: true, error: 'API 密钥未设置' };
      return;
    }

    try {
      const url = buildRequestURL(this.config.provider, this.config.baseURL, this.config.model, this.config.apiKey);
      const headers = buildHeaders(this.config.provider, this.config.apiKey, this.config.headers, this.config.proxyKey);
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

  // 流式聊天 - 回调方式 (golden-thread 风格)
  async streamChat(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const { onChunk, onComplete, onError } = callbacks;

    // WebSocket 特殊处理
    if (this.config.provider === 'websocket') {
      return this.webSocketStreamWithCallbacks(messages, callbacks, signal);
    }

    if (!this.config.apiKey && 
        this.config.provider !== 'ollama' && 
        this.config.provider !== 'proxy' &&
        this.config.provider !== 'local_proxy') {
      onError?.(new Error('请先设置API密钥'));
      return;
    }

    try {
      const url = buildRequestURL(this.config.provider, this.config.baseURL, this.config.model, this.config.apiKey);
      const headers = buildHeaders(this.config.provider, this.config.apiKey, this.config.headers, this.config.proxyKey);
      const body = buildRequestBody(this.config.provider, { messages, stream: true }, this.config.model);

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        await this.handleHTTPError(response);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      let usedModel = this.config.model;

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
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              if (data.model) {
                usedModel = data.model;
              }
              const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content;
              if (content) {
                onChunk?.(content);
              }
            } catch {
              // 忽略解析错误的行
            }
          } else {
            // 尝试直接解析（某些反代服务可能不使用 data: 前缀）
            try {
              const data = JSON.parse(trimmedLine);
              if (data.choices) {
                const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content;
                if (content) {
                  onChunk?.(content);
                }
              }
            } catch {
              // 忽略解析错误的行
            }
          }
        }
      }

      onComplete?.(usedModel);
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error);
      } else {
        onError?.(new Error('网络请求失败，请检查网络连接'));
      }
    }
  }

  // WebSocket 流式 (AsyncGenerator)
  private async *webSocketStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const wsUrl = this.config.baseURL;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let isClosed = false;

      const cleanup = () => {
        isClosed = true;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      ws.onopen = () => {
        const formattedMessages = request.messages.map(msg => ({
          role: msg.role,
          content: formatMessageContent(msg),
        }));

        ws.send(JSON.stringify({
          model: this.config.model,
          messages: formattedMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 2000,
          stream: true,
        }));
      };

      ws.onmessage = (event) => {
        if (isClosed) return;
        
        try {
          let data;
          if (typeof event.data === 'string') {
            data = JSON.parse(event.data);
          } else {
            const text = new TextDecoder().decode(event.data);
            data = JSON.parse(text);
          }
          
          let content = null;
          
          // 尝试多种数据格式
          if (data.choices && data.choices[0]?.delta?.content) {
            content = data.choices[0].delta.content;
          } else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            content = data.candidates[0].content.parts[0].text;
          } else if (data.content) {
            content = data.content;
          } else if (data.text) {
            content = data.text;
          } else if (data.message?.content) {
            content = data.message.content;
          }
          
          if (content) {
            // 这里需要解决 AsyncGenerator 和 WebSocket 回调的协调问题
            // 简化处理：直接 yield
          }
          
          if (data.done || data.finished || data.finish_reason) {
            cleanup();
          }
        } catch (e) {
          if (typeof event.data === 'string' && event.data.trim()) {
            // 直接作为文本
          }
        }
      };

      ws.onerror = () => {
        if (isClosed) return;
        cleanup();
        reject(new Error('WebSocket 连接错误'));
      };

      ws.onclose = (event) => {
        if (isClosed) return;
        if (!event.wasClean) {
          reject(new Error(`WebSocket 连接意外关闭: ${event.code}`));
        } else {
          resolve();
        }
      };
    });
  }

  // WebSocket 流式 (回调方式)
  private async webSocketStreamWithCallbacks(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const { onChunk, onComplete, onError } = callbacks;
    const wsUrl = this.config.baseURL;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let isClosed = false;
      let usedModel = this.config.model;

      const cleanup = () => {
        isClosed = true;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      signal?.addEventListener('abort', () => {
        cleanup();
        onError?.(new Error('请求已中断'));
        reject(new Error('请求已中断'));
      });

      ws.onopen = () => {
        const formattedMessages = messages.map(msg => ({
          role: msg.role,
          content: formatMessageContent(msg),
        }));

        ws.send(JSON.stringify({
          model: this.config.model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }));
      };

      ws.onmessage = (event) => {
        if (isClosed) return;
        
        try {
          let data;
          if (typeof event.data === 'string') {
            data = JSON.parse(event.data);
          } else {
            const text = new TextDecoder().decode(event.data);
            data = JSON.parse(text);
          }
          
          if (data.model) {
            usedModel = data.model;
          }
          
          let content = null;
          
          if (data.choices && data.choices[0]?.delta?.content) {
            content = data.choices[0].delta.content;
          } else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            content = data.candidates[0].content.parts[0].text;
          } else if (data.content) {
            content = data.content;
          } else if (data.text) {
            content = data.text;
          } else if (data.message?.content) {
            content = data.message.content;
          }
          
          if (content) {
            onChunk?.(content);
          }
          
          if (data.done || data.finished || data.finish_reason || (data.choices && data.choices[0]?.finish_reason)) {
            cleanup();
            onComplete?.(usedModel);
            resolve();
          }
        } catch (e) {
          if (typeof event.data === 'string' && event.data.trim()) {
            onChunk?.(event.data);
          }
        }
      };

      ws.onerror = () => {
        if (isClosed) return;
        cleanup();
        onError?.(new Error('WebSocket 连接错误'));
        reject(new Error('WebSocket 连接错误'));
      };

      ws.onclose = (event) => {
        if (isClosed) return;
        if (!event.wasClean) {
          onError?.(new Error(`WebSocket 连接意外关闭: ${event.code} ${event.reason}`));
          reject(new Error(`WebSocket 连接意外关闭: ${event.code} ${event.reason}`));
        } else {
          onComplete?.(usedModel);
          resolve();
        }
      };
    });
  }

  // 健康检查
  async healthCheck(): Promise<{ ok: boolean; message: string; latency?: number }> {
    // WebSocket 不支持健康检查
    if (this.config.provider === 'websocket') {
      return { ok: true, message: 'WebSocket 无法健康检查，请直接测试连接' };
    }

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

  // 获取模型列表
  async getModels(): Promise<{ id: string; name: string }[]> {
    // WebSocket 不支持获取模型列表
    if (this.config.provider === 'websocket') {
      return [];
    }

    // 对于自定义提供商，如果没有 API Key，仍然尝试获取模型列表（某些服务不需要认证）
    if (!this.config.apiKey && 
        this.config.provider !== 'ollama' && 
        this.config.provider !== 'proxy' &&
        this.config.provider !== 'local_proxy' &&
        this.config.provider !== 'custom') {
      throw new Error('请先设置API密钥');
    }

    if (!this.config.baseURL) {
      throw new Error('请先设置API基础URL');
    }

    // Ollama 特殊处理
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

    // 清理 baseUrl
    let baseUrl = this.config.baseURL.trim();
    while (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    // 检查 baseURL 是否已经包含完整的路径，如果是则提取基础部分
    let modelsBaseUrl = baseUrl;
    if (baseUrl.includes('/chat/completions') || baseUrl.includes('/completions')) {
      // 移除聊天端点路径，得到基础 API URL
      modelsBaseUrl = baseUrl.replace(/\/(chat\/)?completions.*$/, '');
    }

    // 尝试多个可能的模型列表端点
    const urls = [
      `${modelsBaseUrl}/models`,
      `${modelsBaseUrl}/v1/models`,
    ];

    let lastError: Error | null = null;
    
    for (const url of urls) {
      try {
        console.log('尝试获取模型列表:', url);
        
        const headers: Record<string, string> = {};
        if (this.config.proxyKey) {
          headers['Authorization'] = `Bearer ${this.config.proxyKey}`;
        } else if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const response = await this.fetchWithTimeout(url, {
          method: 'GET',
          headers,
        });

        console.log('响应状态:', response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.log('错误响应:', errorText);
          lastError = new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
          continue;
        }

        const data = await response.json();
        console.log('响应数据:', data);
        
        let models: { id: string; name: string }[] = [];
        
        // 辅助函数：去除 models/ 前缀
        const cleanModelId = (id: string): string => {
          return id?.replace(/^models\//, '') || id;
        };

        if (Array.isArray(data.data)) {
          models = data.data.map((model: any) => ({
            id: cleanModelId(model.id || model.name || model.model),
            name: cleanModelId(model.id || model.name || model.model),
          })).filter((m: any) => m.id);
        } else if (Array.isArray(data.models)) {
          models = data.models.map((model: any) => ({
            id: cleanModelId(model.id || model.name || model.model),
            name: cleanModelId(model.id || model.name || model.model),
          })).filter((m: any) => m.id);
        } else if (Array.isArray(data)) {
          models = data.map((model: any) => ({
            id: cleanModelId(model.id || model.name || model.model),
            name: cleanModelId(model.id || model.name || model.model),
          })).filter((m: any) => m.id);
        }
        
        console.log('解析到的模型:', models);
        
        if (models.length > 0) {
          return models;
        }
      } catch (err) {
        console.log('请求失败:', err);
        lastError = err instanceof Error ? err : new Error('请求失败');
        continue;
      }
    }
    
    // 对于自定义提供商，如果无法获取模型列表，返回空数组而不是抛出错误
    // 这样用户仍然可以手动输入模型名称
    if (this.config.provider === 'custom') {
      console.warn('自定义提供商无法获取模型列表，返回空数组');
      return [];
    }
    
    if (lastError) {
      throw new Error(`无法获取模型列表 (${lastError.message})，请手动输入模型名称`);
    }
    throw new Error('无法解析响应数据，请手动输入模型名称');
  }
}

// 创建默认实例
export const apiService = new UnifiedAPIService();

// 导出工厂函数
export function createAPIService(config: Partial<APIConfig>): UnifiedAPIService {
  return new UnifiedAPIService(config);
}

// 导出兼容层 - 保持与旧版API兼容
export const chat = (request: ChatRequest) => apiService.chat(request);
export const chatStream = (request: ChatRequest) => apiService.chatStream(request);
