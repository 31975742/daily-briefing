/**
 * Express 服务器
 * 提供简报页面访问 + 定时任务触发
 */
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const { generateBriefing } = require('./src/generator');

const app = express();
const PORT = process.env.PORT || 3000;
const BRIEFING_PASSWORD = process.env.BRIEFING_PASSWORD || '';

// 静态文件服务(data 目录)
app.use(express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'public')));

// API: 手动触发生成
app.post('/api/generate', async (req, res) => {
  try {
    console.log('[API] 手动触发生成...');
    const result = await generateBriefing();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] 生成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 获取最新数据(JSON)
app.get('/api/latest', async (req, res) => {
  try {
    const jsonPath = path.join(__dirname, 'data', 'latest.json');
    const data = await fs.readFile(jsonPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (error) {
    res.status(404).json({ error: '暂无数据,请先生成简报' });
  }
});

// 密码保护中间件
function passwordProtect(req, res, next) {
  if (!BRIEFING_PASSWORD) return next();
  
  const sessionAuth = req.session?.authenticated;
  if (sessionAuth) return next();
  
  const queryPass = req.query.password;
  if (queryPass === BRIEFING_PASSWORD) {
    req.session = req.session || {};
    req.session.authenticated = true;
    return next();
  }
  
  // 返回登录页面
  res.send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>访问验证</title>
<style>
body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f5f7fa}
.box{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);text-align:center;max-width:360px;width:90%}
h2{margin:0 0 8px;color:#1f2937}
p{color:#6b7280;font-size:14px;margin-bottom:20px}
input{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:15px;margin-bottom:12px;outline:none}
input:focus{border-color:#2563eb;box-shadow:0 0 0 3px #e0e7ff}
button{width:100%;padding:11px;background:#2563eb;color:#fff;border:0;border-radius:8px;font-size:15px;cursor:pointer;font-weight:500}
button:hover{background:#1d4ed8}
.error{color:#dc2626;font-size:13px;margin-top:8px}
</style>
</head>
<body>
<div class="box">
  <h2>🔐 需要密码</h2>
  <p>此简报页面已设置访问密码</p>
  <form method="get" action="/">
    <input type="password" name="password" placeholder="请输入访问密码" autofocus required>
    <button type="submit">进入</button>
  </form>
  ${req.query.password ? '<div class="error">密码错误,请重试</div>' : ''}
</div>
</body>
</html>`);
}

// 主页:重定向到简报
app.get('/', passwordProtect, async (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'data', 'index.html');
    await fs.access(indexPath);
    res.sendFile(indexPath);
  } catch (error) {
    res.send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>每日简报</title>
<style>
body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif;background:#f5f7fa;text-align:center;padding:20px}
.box{max-width:500px}
h1{color:#2563eb;margin-bottom:12px}
p{color:#6b7280;line-height:1.7;margin-bottom:20px}
button{padding:12px 28px;background:#2563eb;color:#fff;border:0;border-radius:8px;font-size:15px;cursor:pointer;font-weight:500}
button:hover{background:#1d4ed8}
</style>
</head>
<body>
<div class="box">
  <h1>📰 每日资讯简报</h1>
  <p>简报尚未生成或数据已过期。<br>点击下方按钮立即生成今日简报。</p>
  <button onclick="generate()">立即生成</button>
  <div id="status" style="margin-top:16px;font-size:14px;color:#6b7280"></div>
</div>
<script>
async function generate(){
  document.getElementById('status').textContent='正在生成中...';
  try{
    const res=await fetch('/api/generate',{method:'POST'});
    const data=await res.json();
    if(data.success){
      document.getElementById('status').innerHTML='✅ 生成成功!3秒后跳转...';
      setTimeout(()=>location.reload(),3000);
    }else{
      document.getElementById('status').innerHTML='❌ 生成失败: '+data.error;
    }
  }catch(e){
    document.getElementById('status').innerHTML='❌ 网络错误';
  }
}
</script>
</body>
</html>`);
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动定时任务:每天早上 8:00 自动生成
const CRON_EXPRESSION = '0 8 * * *'; // 每天 8:00
console.log(`[定时任务] 已设置: ${CRON_EXPRESSION} (每天早上8点)`);

cron.schedule(CRON_EXPRESSION, async () => {
  console.log(`[定时任务] 开始执行 (${new Date().toLocaleString('zh-CN')})`);
  try {
    await generateBriefing();
    console.log('[定时任务] 完成');
  } catch (error) {
    console.error('[定时任务] 失败:', error);
  }
}, {
  timezone: 'Asia/Shanghai'
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`💡 提示: 访问 / 查看简报, /api/generate 手动生成`);
});

module.exports = app;
