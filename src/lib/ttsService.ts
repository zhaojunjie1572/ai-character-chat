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

// 最大文本长度限制（URL 安全长度，约 1800 字符以留有余量）
const MAX_TEXT_LENGTH = 1800;

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

/**
 * 智能分割文本为适合朗读的段落
 * 优先按句子分割，如果句子太长则按逗号、顿号分割
 */
export function splitTextForSpeech(text: string, maxLength: number = MAX_TEXT_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const segments: string[] = [];
  let currentSegment = '';

  // 按句子分割（句号、问号、感叹号、换行）
  const sentences = text.split(/([。！？\n]+)/);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    if (!sentence) continue;

    // 如果当前句子本身超过最大长度，需要进一步分割
    if (sentence.length > maxLength) {
      // 先保存当前累积的段落
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
        currentSegment = '';
      }

      // 按逗号、顿号、分号进一步分割长句子
      const subSentences = sentence.split(/([，、；]+)/);
      let tempSegment = '';

      for (const sub of subSentences) {
        if (!sub) continue;

        if ((tempSegment + sub).length > maxLength) {
          if (tempSegment.trim()) {
            segments.push(tempSegment.trim());
          }
          tempSegment = sub;
        } else {
          tempSegment += sub;
        }
      }

      if (tempSegment.trim()) {
        segments.push(tempSegment.trim());
      }
    } else {
      // 检查加入当前句子后是否超过最大长度
      if ((currentSegment + sentence).length > maxLength) {
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
        }
        currentSegment = sentence;
      } else {
        currentSegment += sentence;
      }
    }
  }

  // 保存最后一段
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter(s => s.length > 0);
}

/**
 * 合成单段语音
 */
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

/**
 * 长文本语音合成结果
 */
export interface LongSpeechResult {
  segments: string[];
  totalSegments: number;
  currentSegment: number;
  isPlaying: boolean;
  isPaused: boolean;
}

/**
 * 长文本语音合成控制器
 */
export interface SpeechController {
  play: () => void;
  pause: () => void;
  stop: () => void;
  onProgress?: (current: number, total: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 朗读长文本（Edge TTS 版本）
 */
export async function speakLongTextEdgeTTS(
  text: string,
  config: TtsConfig,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onProgress?: (current: number, total: number) => void;
    onEnded?: () => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<SpeechController> {
  if (!config.edgeTtsUrl) {
    throw new Error('Edge TTS URL 未配置');
  }

  const segments = splitTextForSpeech(text);
  const { rate = 1, pitch = 1, volume = 1 } = options;

  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;
  let currentAudio: HTMLAudioElement | null = null;
  let audioUrls: string[] = [];

  // 预合成所有音频段
  const preloadAudios = async () => {
    try {
      for (let i = 0; i < segments.length; i++) {
        if (!isPlaying && !isPaused) return; // 如果被停止则取消预加载

        const blob = await synthesizeSpeech(segments[i], config, { rate, pitch });
        const url = URL.createObjectURL(blob);
        audioUrls.push(url);
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('预加载音频失败'));
    }
  };

  const playNext = async () => {
    if (currentIndex >= segments.length || !isPlaying) {
      isPlaying = false;
      options.onEnded?.();
      return;
    }

    options.onProgress?.(currentIndex + 1, segments.length);

    try {
      // 如果该段音频还没预加载，先合成
      if (!audioUrls[currentIndex]) {
        const blob = await synthesizeSpeech(segments[currentIndex], config, { rate, pitch });
        audioUrls[currentIndex] = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrls[currentIndex]);
      currentAudio = audio;
      audio.volume = volume;

      audio.onended = () => {
        currentIndex++;
        if (isPlaying && !isPaused) {
          playNext();
        }
      };

      audio.onerror = () => {
        options.onError?.(new Error(`音频播放失败: 第 ${currentIndex + 1} 段`));
        currentIndex++;
        if (isPlaying && !isPaused) {
          playNext();
        }
      };

      await audio.play();
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('播放音频失败'));
      isPlaying = false;
    }
  };

  const controller: SpeechController = {
    play: () => {
      if (isPaused && currentAudio) {
        currentAudio.play();
        isPaused = false;
        isPlaying = true;
      } else if (!isPlaying) {
        isPlaying = true;
        isPaused = false;
        playNext();
        // 开始预加载剩余音频
        preloadAudios();
      }
    },
    pause: () => {
      isPaused = true;
      currentAudio?.pause();
    },
    stop: () => {
      isPlaying = false;
      isPaused = false;
      currentAudio?.pause();
      currentAudio = null;
      currentIndex = 0;
      // 清理所有音频 URL
      audioUrls.forEach(url => URL.revokeObjectURL(url));
      audioUrls = [];
    }
  };

  return controller;
}

/**
 * 朗读长文本（浏览器 TTS 版本）
 */
export function speakLongTextBrowser(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voiceURI?: string;
    onProgress?: (current: number, total: number) => void;
    onEnded?: () => void;
    onError?: (error: Error) => void;
  } = {}
): SpeechController {
  if (!window.speechSynthesis) {
    throw new Error('浏览器不支持语音合成');
  }

  const segments = splitTextForSpeech(text, 200); // 浏览器 TTS 可以处理更长的段落
  const { rate = 1, pitch = 1, volume = 1, voiceURI } = options;

  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;

  const playNext = () => {
    if (currentIndex >= segments.length || !isPlaying) {
      isPlaying = false;
      options.onEnded?.();
      return;
    }

    options.onProgress?.(currentIndex + 1, segments.length);

    const utterance = new SpeechSynthesisUtterance(segments[currentIndex]);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      currentIndex++;
      if (isPlaying && !isPaused) {
        playNext();
      }
    };

    utterance.onerror = (event) => {
      if (event.error !== 'canceled') {
        options.onError?.(new Error(`语音合成错误: ${event.error}`));
      }
      currentIndex++;
      if (isPlaying && !isPaused) {
        playNext();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const controller: SpeechController = {
    play: () => {
      if (isPaused) {
        window.speechSynthesis.resume();
        isPaused = false;
        isPlaying = true;
      } else if (!isPlaying) {
        isPlaying = true;
        isPaused = false;
        playNext();
      }
    },
    pause: () => {
      isPaused = true;
      window.speechSynthesis.pause();
    },
    stop: () => {
      isPlaying = false;
      isPaused = false;
      currentIndex = 0;
      window.speechSynthesis.cancel();
    }
  };

  return controller;
}
