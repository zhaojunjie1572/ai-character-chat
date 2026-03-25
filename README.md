# AI角色对话应用

一个可以创建多个AI角色并进行智能对话的应用。每个角色都有独立的头像、设定和聊天记录。

## 功能特性

- 🎭 **创建无限角色**：每个角色都有独立的头像、名称、描述和系统提示词
- 💬 **智能对话**：接入大语言模型API，角色会根据设定扮演不同 personality
- 🖼️ **头像支持**：提供预设头像，也支持上传自定义头像
- 💾 **本地存储**：角色数据和聊天记录保存在浏览器本地
- ⚙️ **灵活配置**：支持 OpenAI、Azure、Claude 等兼容 API
- 📱 **响应式设计**：适配桌面和移动设备

## 技术栈

- Next.js 14 + TypeScript
- Tailwind CSS
- LocalStorage 数据持久化

## 快速开始

### 1. 安装依赖

```bash
cd ai-character-chat
npm install
```

### 2. 配置环境变量（可选）

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，添加你的 API 密钥：

```env
NEXT_PUBLIC_API_KEY=your_api_key_here
NEXT_PUBLIC_API_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_API_MODEL=gpt-3.5-turbo
```

> 也可以在应用内通过设置按钮配置 API

### 3. 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
```

构建输出在 `dist` 目录，可直接部署到 Zeabur、Vercel 等平台。

## 部署到 Zeabur

1. 将代码推送到 GitHub
2. 在 Zeabur 创建新项目，选择 GitHub 仓库
3. 选择 Next.js 模板，一键部署

## 使用说明

### 创建角色

1. 点击"创建角色"按钮
2. 选择或上传头像
3. 填写角色名称、称号、简介
4. 编写详细的系统提示词（角色设定）
5. 点击"创建角色"

> 提示：点击"加载诸葛亮模板"可以快速创建一个诸葛亮角色

### 开始对话

1. 点击角色卡片上的对话按钮（蓝色圆形按钮）
2. 首次使用需要设置 API 密钥（点击右上角的设置图标）
3. 输入消息，按 Enter 发送
4. 角色会根据设定的 personality 回复

### API 支持

支持所有兼容 OpenAI API 格式的服务：

- OpenAI (GPT-3.5, GPT-4)
- Azure OpenAI
- Claude (通过代理)
- 其他第三方 API 服务

配置示例：
- **OpenAI**: `https://api.openai.com/v1`, `gpt-3.5-turbo`
- **Azure**: `https://your-resource.openai.azure.com/openai/deployments/your-deployment`, `gpt-35-turbo`

## 角色设定示例

### 诸葛亮

```
【核心指令】
你现在完全成为【诸葛亮】...
（详细设定请参考项目中的模板）
```

### 自定义角色

可以创建任何类型的角色：
- 历史人物（曹操、关羽、拿破仑等）
- 虚拟角色（动漫人物、游戏角色等）
- 专业助手（程序员、医生、老师等）
- 原创角色（根据你的想象创造）

## 数据存储

- 角色数据：存储在浏览器的 LocalStorage
- 聊天记录：每个角色独立的聊天记录
- 注意：清除浏览器数据会丢失所有信息

## 开发计划

- [ ] 聊天记录导出/导入
- [ ] 角色分享功能
- [ ] 更多头像选项
- [ ] 语音输入/输出
- [ ] 多语言支持

## License

MIT
