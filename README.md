# 📰 每日资讯简报 (Daily Briefing)

自动抓取新闻联播、A股、科技新闻、微博热搜、国际新闻,每天早上 8 点生成 AI 总结简报。

## 功能特性

- ✅ **5大信息源**: 新闻联播 / A股大盘 / 科技新闻 / 微博热搜 / 国际新闻(Reuters)
- 🤖 **AI 智能总结**: 接入智谱 GLM(免费额度),失败时自动降级本地算法
- 🎨 **双视图模式**: HTML 精美页面 + 纯文本 Markdown,一键切换
- ⏰ **定时推送**: 每天早 8 点自动生成,周末不休
- 🔗 **公开访问**: 无需注册,分享链接即可查看
- 🔐 **可选密码保护**: 环境变量设置统一访问密码

## 快速开始

### 本地运行

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env,填入 AI API Key(可选,不填则使用本地算法)
# AI_API_KEY=your_zhipu_key_here

# 3. 安装依赖
npm install

# 4. 启动服务器
npm start

# 5. 访问 http://localhost:3000
```

### 手动生成简报

```bash
npm run generate
```

## 部署到 Railway(推荐)

### 步骤 1: 准备 GitHub 仓库

```bash
# 在项目根目录执行
git init
git add .
git commit -m "Initial commit"
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

### 步骤 2: 连接 Railway

1. 访问 [railway.app](https://railway.app)
2. 用 GitHub 账号登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你刚推送的仓库

### 步骤 3: 配置环境变量

在 Railway 项目面板的 "Variables" 标签页添加:

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `AI_API_KEY` | `你的智谱API Key` | [免费注册](https://open.bigmodel.cn/)获取 |
| `AI_MODEL` | `glm-4.7-flash` | 主模型(免费) |
| `AI_FALLBACK_MODEL` | `glm-4-flash` | 备用模型,主模型限流时自动降级 |
| `AI_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | API 地址 |
| `BRIEFING_PASSWORD` | `你的密码` | 留空则公开访问 |
| `PORT` | `3000` | 端口号(默认即可) |

### 步骤 4: 获取访问链接

Railway 会自动分配一个域名,类似:
```
https://daily-briefing-xxx.up.railway.app
```

把这个链接分享给任何人,他们就能看到每日简报!

## 获取智谱 AI Key(免费)

1. 访问 [智谱开放平台](https://open.bigmodel.cn/)
2. 注册账号并完成实名认证
3. 进入控制台 → API Keys → 创建新 Key
4. 新用户赠送 100 万 token 免费额度

将 Key 填入 `.env` 或 Railway 环境变量的 `AI_API_KEY` 字段。

**不填 Key 也能运行**,系统会自动使用本地算法提取关键句,只是总结质量稍弱。

## 数据源说明

| 信息源 | 采集方式 | 更新频率 |
|--------|---------|---------|
| 新闻联播 | 央视网文字稿 | 每日 19:30 后 |
| A股大盘 | 新浪财经 API | 交易日实时 |
| 科技新闻 | 36氪 + 虎嗅 RSS | 实时 |
| 微博热搜 | 微博移动端接口 | 实时 |
| 国际新闻 | Reuters RSS | 实时 |

## 自定义与扩展

### 添加新的信息源

1. 在 `src/fetchers/` 下创建新的抓取模块
2. 在 `src/generator.js` 的 `fetchAllData()` 中引入
3. 在 `generateHTML()` 中添加渲染逻辑

### 修改推送时间

编辑 `server.js` 中的 CRON 表达式:
```javascript
const CRON_EXPRESSION = '0 8 * * *'; // 改为其他时间,如 '0 20 * * *' 为晚上8点
```

CRON 格式参考: [cron.guru](https://cron.guru/)

### 调整 AI 模型

修改 `.env`:
```
AI_MODEL=gpt-4o-mini        # 改用 OpenAI
AI_BASE_URL=https://api.openai.com/v1
```

## 技术栈

- **后端**: Node.js + Express
- **定时任务**: node-cron
- **网页抓取**: axios + cheerio + xml2js
- **AI 总结**: 智谱 GLM / OpenAI 兼容接口
- **部署**: Railway

## License

MIT
