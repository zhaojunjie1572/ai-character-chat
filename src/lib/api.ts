/**
 * API服务统一入口
 * 基于 apiUnified.ts 提供增强的API兼容性
 * 支持 OpenAI、Azure OpenAI、Claude、Gemini、Ollama、DeepSeek、WebSocket、Proxy 等多种API提供商
 */

export {
  // 主服务和类
  UnifiedAPIService as APIService,
  apiService,
  createAPIService,

  // 类型定义
  type ApiProvider,
  type ChatRequest,
  type ChatResponse,
  type APIConfig,
  type StreamChunk,
  type ChatMessage,
  type MessageAttachment,
  type StreamCallbacks,

  // 错误类
  APIError,
  NetworkError,
  TimeoutError,

  // 兼容旧版导出
  chat,
  chatStream,
} from './apiUnified';
