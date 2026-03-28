// TTS 服务配置
export type TtsEngine = 'browser' | 'edge-tts';

export interface TtsConfig {
  engine: TtsEngine;
  edgeTtsUrl?: string;
  edgeTtsVoice?: string;
}

// Edge TTS 声音列表
export const EDGE_TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', desc: '温柔女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', desc: '标准女声', gender: 'female' as const },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', desc: '甜美女声', gender: 'female' as const },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', desc: '活泼女声', gender: 'female' as const },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', desc: '知性女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', desc: '清新女声', gender: 'female' as const },
  { id: 'zh-CN-XiaoyouNeural', name: '晓悠', desc: '自然女声', gender: 'female' as const },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', desc: '优雅女声', gender: 'female' as const },
  { id: 'zh-CN-YunxiNeural', name: '云希', desc: '标准男声', gender: 'male' as const },
  { id: 'zh-CN-YunyangNeural', name: '云扬', desc: '沉稳男声', gender: 'male' as const },
  { id: 'zh-CN-YunfengNeural', name: '云锋', desc: '洪亮男声', gender: 'male' as const },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', desc: '磁性男声', gender: 'male' as const },
];

const STORAGE_KEY = 'ai-character-tts-config';

export function getDefaultConfig(): TtsConfig {
  return {
    engine: 'browser'
  };
}

export function saveTtsConfig(config: TtsConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('保存 TTS 配置失败', error);
  }
}

export function loadTtsConfig(): TtsConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('加载 TTS 配置失败', error);
  }
  return getDefaultConfig();
}

export async function synthesizeSpeech(
  text: string,
  config: TtsConfig,
  options: { rate?: number; pitch?: number } = {}
): Promise<Blob> {
  if (config.engine === 'browser') {
    throw new Error('浏览器 TTS 不需要调用云服务');
  }

  if (config.engine === 'edge-tts') {
    if (!config.edgeTtsUrl) {
      throw new Error('Edge TTS URL 未配置');
    }

    const rate = Math.round(((options.rate || 1) - 1) * 100);
    const pitch = Math.round(((options.pitch || 1) - 1) * 100);

    const params = new URLSearchParams({
      text: text,
      voice: config.edgeTtsVoice || 'zh-CN-XiaoxiaoNeural',
      rate: rate.toString(),
      pitch: pitch.toString()
    });

    const response = await fetch(`${config.edgeTtsUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Edge TTS 请求失败: ${response.status}`);
    }

    return response.blob();
  }

  throw new Error('未配置 TTS 服务');
}
