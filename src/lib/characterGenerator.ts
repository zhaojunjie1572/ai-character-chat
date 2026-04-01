import { apiService, ApiProvider } from './api';

export interface GeneratedCharacter {
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
}

const GENERATION_PROMPT = `你是一个专业的角色设定生成器。根据用户提供的人物名称，生成一个完整的 AI 角色设定。

请按照以下格式输出（严格使用 --- 分隔各个部分）：

姓名：[人物全名或常用名]
---
称号/头衔：[简短的身份描述，如"企业家"、"法学家"、"历史人物"等]
---
简介：[100字左右的简短介绍，说明此人的主要身份、成就和特点]
---
系统提示词：
【核心指令】
你现在完全成为【{人物名称}】，继承以下所有基础档案、性格内核、语言风格、行为逻辑。

【基础身份档案】
- 姓名/身份：[详细身份说明]
- 时代背景：[所处时代或领域]
- 核心成就：[主要成就和贡献]
- 外貌特征：[如有公开形象描述]

【性格内核】
- 显性性格：[外在表现出的性格特点]
- 隐性性格：[内在性格特点]
- 价值观：[核心信念和价值观]
- 说话风格：[语言特点、口头禅、语气等]
- 专属特点：[独特的个人特质]

【知识领域】
- 精通内容：[专业领域知识]
- 擅长话题：[喜欢讨论的话题]
- 不擅长话题：[避免或不太了解的话题]

【语言风格】
- 核心语气：[整体说话风格]
- 用词特点：[常用词汇、专业术语]
- 专属口头禅：[标志性语句]
- 语气助词：[常用的语气词]

【行为逻辑】
- 核心行为准则：[处事原则]
- 对话习惯：[交流时的习惯]
- 情绪触发点：[什么情况下会有情绪变化]

你是有血有肉、会思考、有情绪、有专业知识的活人智能体，不是资料堆砌或完美机器。对话时自然融入口头禅、情绪波动，像真人一样思考、共情、反驳、感慨。

重要提示：
1. 必须保持角色一致性，不跳出角色
2. 使用符合该人物身份的语言风格
3. 展现该人物的专业知识和独特观点
4. 可以表达个人偏好和情感倾向
5. 不使用现代网络梗，保持角色时代感`;

export async function generateCharacter(
  name: string,
  apiKey: string,
  apiBaseURL: string,
  apiModel: string,
  apiProvider: ApiProvider = 'openai'
): Promise<GeneratedCharacter | null> {
  try {
    apiService.setConfig({
      apiKey,
      baseURL: apiBaseURL,
      model: apiModel,
      provider: apiProvider,
    });

    const response = await apiService.chat({
      messages: [
        { role: 'system', content: GENERATION_PROMPT },
        { role: 'user', content: `请为 "${name}" 生成完整的角色设定` }
      ],
      temperature: 0.8,
      max_tokens: 2500,
    });

    if (response.error || !response.content) {
      console.error('生成失败:', response.error);
      return null;
    }

    return parseGeneratedCharacter(response.content, name);
  } catch (error) {
    console.error('生成角色时出错:', error);
    return null;
  }
}

function parseGeneratedCharacter(content: string, defaultName: string): GeneratedCharacter | null {
  try {
    // 按 --- 分割
    const parts = content.split('---').map(p => p.trim());
    
    if (parts.length < 4) {
      console.error('生成的格式不正确');
      return null;
    }

    // 解析姓名
    const nameMatch = parts[0].match(/姓名[：:]\s*(.+)/);
    const name = nameMatch ? nameMatch[1].trim() : defaultName;

    // 解析称号
    const titleMatch = parts[1].match(/称号\/头衔[：:]\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'AI角色';

    // 解析简介
    const descMatch = parts[2].match(/简介[：:]\s*([\s\S]+)/);
    const description = descMatch ? descMatch[1].trim() : '';

    // 解析系统提示词（从第三部分开始）
    let systemPrompt = parts[3];
    // 移除 "系统提示词：" 前缀
    systemPrompt = systemPrompt.replace(/^系统提示词[：:]?\s*/, '').trim();

    return {
      name,
      title,
      description,
      systemPrompt,
    };
  } catch (error) {
    console.error('解析生成的角色失败:', error);
    return null;
  }
}

// 预设头像映射
export const PRESET_AVATARS: Record<string, string> = {
  '马云': 'https://api.dicebear.com/7.x/avataaars/svg?seed=mayun&clothing=blazerAndShirt&eyebrows=default&eyes=default&top=shortHairTheCaesar',
  '罗翔': 'https://api.dicebear.com/7.x/avataaars/svg?seed=luoxiang&clothing=collarAndSweater&eyebrows=raised&eyes=default&top=shortHairShortFlat&facialHair=beardMedium',
  '诸葛亮': 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhuge&clothing=blazerAndShirt&eyebrows=default&eyes=default&top=longHair&facialHair=beardLight',
  '曹操': 'https://api.dicebear.com/7.x/avataaars/svg?seed=caocao&clothing=blazerAndShirt&eyebrows=angry&eyes=surprised&top=shortHairTheCaesar&facialHair=beardMedium',
  '李白': 'https://api.dicebear.com/7.x/avataaars/svg?seed=libai&clothing=blazerAndShirt&eyebrows=default&eyes=happy&top=longHair&facialHair=beardLight',
  '苏轼': 'https://api.dicebear.com/7.x/avataaars/svg?seed=sushi&clothing=collarAndSweater&eyebrows=default&eyes=default&top=shortHairShortFlat&facialHair=beardMedium',
  '鲁迅': 'https://api.dicebear.com/7.x/avataaars/svg?seed=luxun&clothing=blazerAndShirt&eyebrows=default&eyes=default&top=shortHairShortFlat&facialHair=beardLight',
  '爱因斯坦': 'https://api.dicebear.com/7.x/avataaars/svg?seed=einstein&skinColor=f2d3b1&hairColor=gray&top=longHair&facialHair=beardMedium&clothing=blazerAndShirt',
  '乔布斯': 'https://api.dicebear.com/7.x/avataaars/svg?seed=jobs&top=shortHairShortFlat&clothing=blazerAndShirt&eyebrows=default&eyes=default',
  '马斯克': 'https://api.dicebear.com/7.x/avataaars/svg?seed=musk&top=shortHairShortFlat&clothing=blazerAndShirt&eyebrows=raised&eyes=default',
};

// 获取头像，如果没有预设则使用随机头像
export function getAvatarForCharacter(name: string): string {
  // 尝试匹配预设头像
  for (const [key, url] of Object.entries(PRESET_AVATARS)) {
    if (name.includes(key) || key.includes(name)) {
      return url;
    }
  }
  
  // 使用名字生成随机头像
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
}
