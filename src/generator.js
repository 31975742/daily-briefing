/**
 * 数据采集与简报生成主流程
 */
require('dotenv').config();
const { fetchXinwenLianbo } = require('./fetchers/xinwenlianbo');
const { fetchAStock } = require('./fetchers/astock');
const { fetchTechNews } = require('./fetchers/technews');
const { fetchWeiboHot } = require('./fetchers/weibohot');
const { fetchIntlNews } = require('./fetchers/intlnews');
const { summarizeSection } = require('./ai-summarizer');
const fs = require('fs').promises;
const path = require('path');

/**
 * 并行抓取所有数据源
 */
async function fetchAllData() {
  console.log('[采集] 开始抓取数据...');
  
  const [xinwenlianbo, astock, technews, weibohot, intlnews] = await Promise.allSettled([
    fetchXinwenLianbo(),
    fetchAStock(),
    fetchTechNews(),
    fetchWeiboHot(),
    fetchIntlNews()
  ]);
  
  const results = [
    xinwenlianbo.status === 'fulfilled' ? xinwenlianbo.value : { type: 'xinwenlianbo', name: '新闻联播', items: [], error: xinwenlianbo.reason?.message },
    astock.status === 'fulfilled' ? astock.value : { type: 'astock', name: 'A股大盘', indices: [], hotSectors: [], error: astock.reason?.message },
    technews.status === 'fulfilled' ? technews.value : { type: 'technews', name: '科技新闻', items: [], error: technews.reason?.message },
    weibohot.status === 'fulfilled' ? weibohot.value : { type: 'weibohot', name: '微博热搜', items: [], error: weibohot.reason?.message },
    intlnews.status === 'fulfilled' ? intlnews.value : { type: 'intlnews', name: '国际新闻', items: [], error: intlnews.reason?.message }
  ];
  
  console.log(`[采集] 完成,成功 ${results.filter(r => !r.error).length}/${results.length} 个数据源`);
  return results;
}

/**
 * 对每个板块进行 AI 总结
 */
async function summarizeAll(sections) {
  console.log('[总结] 开始 AI 总结...');
  
  const summarized = [];
  for (const section of sections) {
    try {
      const result = await summarizeSection(section);
      summarized.push(result);
    } catch (e) {
      console.error(`[总结] ${section.name} 失败:`, e.message);
      summarized.push({ ...section, summary: '总结生成失败', summaryType: 'error' });
    }
  }
  
  console.log('[总结] 完成');
  return summarized;
}

/**
 * 生成 HTML 简报页面
 */
function generateHTML(data, dateStr) {
  const now = new Date();
  const dateDisplay = dateStr || now.toLocaleDateString('zh-CN', { 
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
  });
  
  // 构建各板块 HTML
  const sectionsHTML = data.map(section => {
    if (section.type === 'astock') {
      return renderAStock(section);
    } else if (section.items && section.items.length > 0) {
      return renderListSection(section);
    } else {
      return renderEmptySection(section);
    }
  }).join('\n');
  
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>每日简报 - ${dateDisplay}</title>
<style>
:root{--bg:#f5f7fa;--surface:#fff;--border:#e5e7eb;--text:#1f2937;--muted:#6b7280;--accent:#2563eb;--red:#dc2626;--green:#059669;--amber:#d97706}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:15px}
.container{max-width:800px;margin:0 auto;padding:24px 20px 60px}
header{text-align:center;margin-bottom:32px;padding:28px 0;border-bottom:2px solid var(--accent)}
header h1{font-size:26px;font-weight:700;color:var(--accent);margin-bottom:6px}
header .date{font-size:14px;color:var(--muted)}
header .meta{font-size:12px;color:var(--muted);margin-top:8px}
.section{background:var(--surface);border-radius:12px;padding:22px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.section h2{font-size:18px;font-weight:600;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.section h2 .icon{font-size:20px}
.summary-box{background:#f0f7ff;border-left:3px solid var(--accent);padding:12px 14px;margin-bottom:14px;border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.7;color:#1e40af}
.summary-box.local{background:#fef3c7;border-left-color:var(--amber);color:#92400e}
.item{padding:10px 0;border-bottom:1px solid #f3f4f6}
.item:last-child{border-bottom:none}
.item-title{font-size:14.5px;font-weight:500;margin-bottom:4px}
.item-title a{color:var(--text);text-decoration:none}
.item-title a:hover{color:var(--accent)}
.item-meta{font-size:12px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.stock-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:16px}
.stock-card{background:#fafbfc;border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center}
.stock-name{font-size:13px;color:var(--muted);margin-bottom:6px}
.stock-value{font-size:22px;font-weight:700;margin-bottom:4px}
.stock-value.up{color:var(--red)}
.stock-value.down{color:var(--green)}
.stock-change{font-size:13px}
.stock-change.up{color:var(--red)}
.stock-change.down{color:var(--green)}
.sectors{font-size:13px;color:var(--muted)}
.sectors strong{color:var(--text)}
.empty{text-align:center;padding:30px;color:var(--muted);font-size:13px}
footer{text-align:center;padding:24px 0;font-size:12px;color:var(--muted);border-top:1px solid var(--border);margin-top:32px}
.view-toggle{text-align:center;margin-bottom:20px}
.view-toggle button{background:var(--surface);border:1px solid var(--border);padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;margin:0 4px}
.view-toggle button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.text-view{display:none;background:var(--surface);border-radius:12px;padding:24px;font-family:"Courier New",monospace;font-size:13.5px;line-height:1.8;white-space:pre-wrap}
.text-view.show{display:block}
.html-view.hide{display:none}
@media(max-width:600px){
  .container{padding:16px 14px 40px}
  header h1{font-size:22px}
  .section{padding:18px 16px}
  .stock-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>📰 每日资讯简报</h1>
    <div class="date">${dateDisplay}</div>
    <div class="meta">生成时间: ${now.toLocaleString('zh-CN')} | 数据来源: 央视网、东方财富、36氪/IT之家、微博热搜、${data.find(s => s.type === 'intlnews')?.provider || '外媒'}</div>
  </header>
  
  <div class="view-toggle">
    <button class="active" onclick="switchView('html')">精美视图</button>
    <button onclick="switchView('text')">纯文本</button>
    <button onclick="copyText()">复制文本</button>
  </div>
  
  <div class="html-view" id="htmlView">
    ${sectionsHTML}
  </div>
  
  <div class="text-view" id="textView">
${generateMarkdown(data, dateDisplay)}
  </div>
  
  <footer>
    由 Daily Briefing 自动生成 · 每天早上 8:00 更新<br>
    <a href="?format=json" style="color:var(--accent)">查看原始数据 (JSON)</a>
  </footer>
</div>

<script>
function switchView(mode){
  document.querySelectorAll('.view-toggle button').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  if(mode==='text'){
    document.getElementById('htmlView').classList.add('hide');
    document.getElementById('textView').classList.add('show');
  }else{
    document.getElementById('htmlView').classList.remove('hide');
    document.getElementById('textView').classList.remove('show');
  }
}
function copyText(){
  const text=document.getElementById('textView').innerText;
  navigator.clipboard.writeText(text).then(()=>alert('已复制到剪贴板'));
}
</script>
</body>
</html>`;
}

/**
 * 渲染 A 股板块
 */
function renderAStock(section) {
  const { indices, hotSectors, summary, summaryType } = section;
  
  let html = `<div class="section">
    <h2><span class="icon">📈</span>${section.name}</h2>`;
  
  if (summary) {
    html += `<div class="summary-box ${summaryType === 'local' ? 'local' : ''}"><strong>市场点评:</strong> ${summary}</div>`;
  }
  
  if (indices && indices.length > 0) {
    html += '<div class="stock-grid">';
    indices.forEach(idx => {
      const isUp = idx.changePercent >= 0;
      html += `
        <div class="stock-card">
          <div class="stock-name">${idx.name}</div>
          <div class="stock-value ${isUp ? 'up' : 'down'}">${idx.current.toFixed(2)}</div>
          <div class="stock-change ${isUp ? 'up' : 'down'}">
            ${isUp ? '▲' : '▼'} ${Math.abs(idx.changePercent).toFixed(2)}% (${idx.change > 0 ? '+' : ''}${parseFloat(idx.change).toFixed(2)})
          </div>
        </div>`;
    });
    html += '</div>';
  }
  
  if (hotSectors && hotSectors.length > 0) {
    html += '<div class="sectors"><strong>热点板块:</strong> ';
    html += hotSectors.map(s => `${s.name} (${s.changePercent > 0 ? '+' : ''}${s.changePercent}%)`).join('、');
    html += '</div>';
  }
  
  if (!indices || indices.length === 0) {
    html += '<div class="empty">暂无数据 (可能为非交易时间)</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * 渲染列表型板块
 */
function renderListSection(section) {
  const { name, items, summary, summaryType } = section;
  const icons = {
    xinwenlianbo: '📺',
    technews: '💻',
    weibohot: '🔥',
    intlnews: '🌍'
  };
  
  let html = `<div class="section">
    <h2><span class="icon">${icons[section.type] || '📋'}</span>${name}</h2>`;
  
  if (summary) {
    html += `<div class="summary-box ${summaryType === 'local' ? 'local' : ''}">${summary}</div>`;
  }
  
  items.slice(0, 10).forEach((item, idx) => {
    const title = item.title || '';
    const link = item.link || '#';
    const source = item.source || '';
    
    html += `
      <div class="item">
        <div class="item-title">
          <a href="${link}" target="_blank" rel="noopener">${idx + 1}. ${title}</a>
        </div>
        <div class="item-meta">
          <span>${source}</span>
          ${item.hotValue ? `<span>🔥 ${formatNumber(item.hotValue)}</span>` : ''}
        </div>
      </div>`;
  });
  
  if (items.length === 0) {
    html += '<div class="empty">暂无数据</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * 渲染空板块
 */
function renderEmptySection(section) {
  return `<div class="section">
    <h2><span class="icon">⚠️</span>${section.name}</h2>
    <div class="empty">数据获取失败或暂无内容</div>
  </div>`;
}

/**
 * 生成 Markdown 纯文本版
 */
function generateMarkdown(data, dateDisplay) {
  let md = `# 📰 每日资讯简报\n\n**日期**: ${dateDisplay}\n**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
  
  data.forEach(section => {
    md += `## ${section.name}\n\n`;
    
    if (section.summary) {
      md += `> ${section.summary}\n\n`;
    }
    
    if (section.type === 'astock' && section.indices) {
      section.indices.forEach(idx => {
        const arrow = idx.changePercent >= 0 ? '🔺' : '🔻';
        md += `- **${idx.name}**: ${idx.current.toFixed(2)} 点 ${arrow} ${Math.abs(idx.changePercent).toFixed(2)}%\n`;
      });
      if (section.hotSectors && section.hotSectors.length > 0) {
        md += `\n**热点板块**: ${section.hotSectors.map(s => s.name).join('、')}\n`;
      }
    } else if (section.items) {
      section.items.slice(0, 10).forEach((item, idx) => {
        md += `${idx + 1}. ${item.title}`;
        if (item.link) md += ` - ${item.link}`;
        md += '\n';
      });
    }
    
    md += '\n---\n\n';
  });
  
  md += `_由 Daily Briefing 自动生成_`;
  return md;
}

/**
 * 格式化数字(热度值)
 */
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
}

/**
 * 主流程:采集 → 总结 → 生成文件
 */
async function generateBriefing() {
  const dateStr = new Date().toISOString().split('T')[0];
  const dataDir = path.join(__dirname, '../data');
  
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (e) {
    // 目录已存在
  }
  
  // 1. 采集
  const rawData = await fetchAllData();
  
  // 2. 总结
  const summarizedData = await summarizeAll(rawData);
  
  // 3. 生成 HTML
  const html = generateHTML(summarizedData, dateStr);
  
  // 4. 保存文件
  const htmlPath = path.join(dataDir, 'index.html');
  const jsonPath = path.join(dataDir, 'latest.json');
  
  await fs.writeFile(htmlPath, html, 'utf-8');
  await fs.writeFile(jsonPath, JSON.stringify({ date: dateStr, data: summarizedData }, null, 2), 'utf-8');
  
  console.log(`[生成] 简报已保存: ${htmlPath}`);
  return { htmlPath, jsonPath, date: dateStr };
}

module.exports = { generateBriefing, generateHTML, generateMarkdown };
