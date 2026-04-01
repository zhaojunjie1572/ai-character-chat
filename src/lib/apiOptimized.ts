/**
 * API服务优化版 - 兼容层
 * 基于 apiCompatible.ts 提供增强的API兼容性
 */

export {
  // 主服务和类
  CompatibleAPIService as APIService,
  apiService,
  createAPIService,

  // 类型定义
  type ApiProvider,
  type ChatRequest,
  type ChatResponse,
  type APIConfig,
  type StreamChunk,

  // 错误类
  APIError,
  NetworkError,
  TimeoutError,

  // 兼容旧版导出
  chat,
  chatStream,
} from './apiCompatible';
