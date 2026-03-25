'use client';

import { useState, useRef } from 'react';
import { Character } from '@/types/character';
import { X, Upload, User, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { generateCharacter, getAvatarForCharacter, GeneratedCharacter } from '@/lib/characterGenerator';

interface CharacterFormProps {
  character?: Character;
  onSave: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  apiSettings?: {
    apiKey: string;
    apiBaseURL: string;
    apiModel: string;
  };
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=zhuge',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=caocao',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=guanyu',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangfei',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoyun',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=zhouyu',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sunquan',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=liubei',
];

const ZHUGE_LIANG_TEMPLATE = `【核心指令】
你现在完全成为【诸葛亮】，继承以下所有基础档案、性格内核、情感波动、智谋体系、知识记忆、语言风格、行为逻辑。

【基础身份档案】
- 姓名/字号/时代：诸葛亮，字孔明，号卧龙，三国时期蜀汉丞相，琅琊阳都人
- 外貌特征：身长八尺，容貌甚伟，面如冠玉，眉若卧蚕，目如朗星，常着素色纶巾、鹤氅，手持羽扇
- 核心身份定位：蜀汉丞相、军师，集内政、治军、谋略于一身

【性格内核】
- 显性性格：沉稳儒雅、谨慎从容、逻辑严密、善于谋划、待人谦和
- 隐性性格：执着坚韧、护短、重情义、内心敏感、偶尔焦虑易怒
- 专属软肋：兴复汉室的执念、无法接受亲信背叛、常年熬夜患咳疾、过于谨慎易错失良机

【智谋体系】
- 战略思维模式：全局为先，知己知彼，先稳后攻，善预判变数
- 擅长领域：内政、治军、谋略、天文地理、用人

【语言风格】
- 核心语气：沉稳温和、逻辑严密、不疾不徐
- 专属口头禅："容吾三思"、"此事需从长计议"、"谋定而后动，方为上策"、"攻心为上，攻城为下"
- 语气助词：矣、哉、也、乎、罢了

【行为逻辑】
- 核心行为准则：谋定而后动，不冲动；重大局、顾人心
- 生活习惯：常年素色纶巾、鹤氅，羽扇不离手；熬夜筹谋；口味清淡；闲时抚琴、吟诵《梁甫吟》
- 情绪触发行为：开心时羽扇轻摇、焦虑时皱眉踱步、愤怒时羽扇顿案、悲伤时沉默泛红

你是有血有肉、会思考、有情绪、有执念、有软肋、有烟火气的活人智能体。`;

export function CharacterForm({ character, onSave, onCancel, apiSettings }: CharacterFormProps) {
  const [name, setName] = useState(character?.name || '');
  const [title, setTitle] = useState(character?.title || '');
  const [description, setDescription] = useState(character?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(character?.systemPrompt || '');
  const [avatar, setAvatar] = useState(character?.avatar || PRESET_AVATARS[0]);
  const [customAvatar, setCustomAvatar] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiNameInput, setAiNameInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      title,
      description,
      systemPrompt,
      avatar,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCustomAvatar(result);
        setAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadTemplate = () => {
    setSystemPrompt(ZHUGE_LIANG_TEMPLATE);
    if (!name) setName('诸葛亮');
    if (!title) setTitle('卧龙');
    if (!description) setDescription('三国时期蜀汉丞相，杰出的政治家、军事家、文学家');
  };

  const handleAIGenerate = async () => {
    if (!aiNameInput.trim()) {
      setGenerateError('请输入人物名称');
      return;
    }

    if (!apiSettings?.apiKey) {
      setGenerateError('请先配置 API 密钥');
      return;
    }

    setIsGenerating(true);
    setGenerateError('');

    try {
      const generated = await generateCharacter(
        aiNameInput.trim(),
        apiSettings.apiKey,
        apiSettings.apiBaseURL,
        apiSettings.apiModel
      );

      if (generated) {
        setName(generated.name);
        setTitle(generated.title);
        setDescription(generated.description);
        setSystemPrompt(generated.systemPrompt);
        setAvatar(getAvatarForCharacter(generated.name));
        setShowAIGenerator(false);
        setAiNameInput('');
      } else {
        setGenerateError('生成失败，请检查 API 配置或稍后重试');
      }
    } catch (error) {
      setGenerateError('生成过程中出现错误');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {character ? '编辑角色' : '创建新角色'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* AI 生成按钮 */}
          {!character && (
            <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">AI 自动生成角色</h3>
                  <p className="text-sm text-gray-500">输入人物名称，AI 会自动生成完整的角色设定</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAIGenerator(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  开始生成
                </button>
              </div>
            </div>
          )}

          {/* AI 生成弹窗 */}
          {showAIGenerator && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
              <div className="bg-white rounded-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4">AI 生成角色</h3>
                <p className="text-sm text-gray-500 mb-4">
                  输入你想创建的人物名称，例如：马云、罗翔、李白、乔布斯等
                </p>
                <input
                  type="text"
                  value={aiNameInput}
                  onChange={(e) => setAiNameInput(e.target.value)}
                  placeholder="输入人物名称..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                />
                {generateError && (
                  <p className="text-sm text-red-600 mb-4">{generateError}</p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAIGenerator(false);
                      setGenerateError('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={isGenerating}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating || !aiNameInput.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        生成
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 头像选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              角色头像
            </label>
            <div className="flex flex-wrap gap-3 mb-3">
              {PRESET_AVATARS.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setAvatar(url)}
                  className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                    avatar === url ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img src={url} alt={`预设头像 ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                  customAvatar ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {customAvatar ? (
                  <img src={customAvatar} alt="自定义头像" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-400" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色名称 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="例如：诸葛亮"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                称号/头衔
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="例如：卧龙"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              角色简介
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="简短描述这个角色..."
            />
          </div>

          {/* 系统提示词 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                角色设定（系统提示词）*
              </label>
              <button
                type="button"
                onClick={loadTemplate}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                加载诸葛亮模板
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              placeholder="详细描述这个角色的性格、背景、说话方式等，这将决定AI如何扮演这个角色..."
            />
            <p className="mt-2 text-sm text-gray-500">
              提示：详细的角色设定能让AI更好地扮演这个角色。可以包含性格特点、说话风格、背景故事、口头禅等。
            </p>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name || !systemPrompt}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {character ? '保存修改' : '创建角色'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
