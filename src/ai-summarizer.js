/**
 * AI 总结模块
 * 支持智谱 GLM / OpenAI 兼容接口,失败时自动降级到本地算法
 */
const axios = require('axios');

/**
 * 调用大模型 API 生成总结
 * 主模型被限流(429)/超时时,自动降级到备用模型
 */
async function callLLM(prompt, systemPrompt = '') {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

  if (!apiKey) {
    throw new Error('未配置 AI_API_KEY');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // 模型列表:主模型 + 备用模型(去重)
  const primary = process.env.AI_MODEL || 'glm-4-flash';
  const fallback = process.env.AI_FALLBACK_MODEL || 'glm-4-flash';
  const models = [...new Set([primary, fallback, 'glm-4-flash'])];

  let lastError = null;

  for (const model of models) {
    try {
      const { data } = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature: 0.3,
          max_tokens: 800
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );

      const content = data.choices?.[0]?.message?.content || '';
      if (content) {
        if (model !== primary) {
          console.log(`[AI] 主模型 ${primary} 不可用,已降级使用 ${model}`);
        }
        return content;
      }
      lastError = new Error(`${model} 返回空内容`);
    } catch (e) {
      lastError = e;
      const status = e.response?.status;
      // 仅对限流/超时/服务过载做降级,鉴权错误直接抛出
      if (status === 401 || status === 403) {
        throw new Error(`API Key 无效 (${status})`);
      }
      console.log(`[AI] 模型 ${model} 失败 (${status || e.message}),尝试下一个`);
    }
  }

  throw lastError || new Error('所有模型均不可用');
}

/**
 * 本地算法:TF-IDF + 关键句提取(兜底方案)
 */
function localSummarize(text, maxSentences = 3) {
  if (!text || text.length < 50) return text || '';
  
  // 简单分句
  const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 5);
  if (sentences.length <= maxSentences) return text;
  
  // 计算词频(简化版)
  const words = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  
  // 给每句话打分
  const scored = sentences.map((sent, idx) => {
    const sentWords = sent.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    let score = 0;
    sentWords.forEach(w => {
      score += freq[w] || 0;
    });
    // 位置加权:靠前的句子更重要
    if (idx < 3) score *= 1.5;
    return { text: sent.trim(), score, idx };
  });
  
  // 取分数最高的几句,按原序排列
  const top = scored.sort((a, b) => b.score - a.score).slice(0, maxSentences);
  top.sort((a, b) => a.idx - b.idx);
  
  return top.map(s => s.text).join('。') + '。';
}

/**
 * 为不同板块生成总结
 */
async function summarizeSection(sectionData) {
  const { type, name, items } = sectionData;
  
  // 新闻联播:提取要点
  if (type === 'xinwenlianbo' && items.length > 0) {
    const titles = items.map(i => i.title).join('\n');
    const prompt = `以下是今天新闻联播的主要标题,请用3-5条要点总结核心内容,每条不超过30字:\n\n${titles}`;
    
    const systemPrompt = '你是专业的新闻编辑,擅长从新闻标题中提炼核心要点。输出格式为编号列表。';
    
    try {
      const summary = await callLLM(prompt, systemPrompt);
      return { ...sectionData, summary, summaryType: 'ai' };
    } catch (e) {
      console.log('[AI] 新闻联播总结失败,使用本地算法');
      const summary = localSummarize(titles, 5);
      return { ...sectionData, summary, summaryType: 'local' };
    }
  }
  
  // A股:生成市场点评
  if (type === 'astock' && sectionData.indices && sectionData.indices.length > 0) {
    const indicesText = sectionData.indices.map(idx =>
      `${idx.name}: ${idx.current}点 (${idx.changePercent > 0 ? '+' : ''}${idx.changePercent}%)`
    ).join('\n');

    const prompt = `根据以下A股收盘数据,用一句话点评今日市场表现(20字以内):\n\n${indicesText}`;

    try {
      const comment = await callLLM(prompt, '你是资深股市分析师,擅长用精炼语言点评市场。');
      return { ...sectionData, summary: comment, summaryType: 'ai' };
    } catch (e) {
      const upCount = sectionData.indices.filter(i => i.isUp).length;
      const downCount = sectionData.indices.length - upCount;
      const comment = `三大指数${upCount}涨${downCount}跌,市场情绪${upCount >= 2 ? '偏暖' : upCount === 0 ? '偏弱' : '分化'}`;
      return { ...sectionData, summary: comment, summaryType: 'local' };
    }
  }
  
  // 科技新闻:提炼热点主题
  if (type === 'technews' && items.length > 0) {
    const titles = items.slice(0, 8).map(i => i.title).join('\n');
    const prompt = `以下是今天的科技新闻标题,请归纳出2-3个主要热点主题,每个主题用10字以内概括:\n\n${titles}`;
    
    try {
      const themes = await callLLM(prompt, '你是科技行业分析师,擅长从新闻中发现趋势和热点。');
      return { ...sectionData, summary: themes, summaryType: 'ai' };
    } catch (e) {
      const summary = `共${items.length}条科技新闻,涵盖多个领域`;
      return { ...sectionData, summary, summaryType: 'local' };
    }
  }
  
  // 微博热搜:分类整理
  if (type === 'weibohot' && items.length > 0) {
    const titles = items.map(i => i.title).join('\n');
    const prompt = `以下是微博热搜榜前10名,请按娱乐/社会/时政等类别分组,每组列出话题名称:\n\n${titles}`;
    
    try {
      const grouped = await callLLM(prompt, '你是社交媒体运营专家,擅长对话题进行分类整理。');
      return { ...sectionData, summary: grouped, summaryType: 'ai' };
    } catch (e) {
      const summary = `热搜TOP3: ${items.slice(0, 3).map(i => i.title).join('、')}`;
      return { ...sectionData, summary, summaryType: 'local' };
    }
  }
  
  // 国际新闻:中文摘要
  if (type === 'intlnews' && items.length > 0) {
    const titles = items.map(i => `[${i.source}] ${i.title}`).join('\n');
    const prompt = `以下是今天的国际新闻标题(英文),请用中文简要总结最重要的3条,每条20字以内:\n\n${titles}`;
    
    try {
      const summary = await callLLM(prompt, '你是国际新闻编辑,擅长将英文新闻翻译成精炼的中文摘要。');
      return { ...sectionData, summary, summaryType: 'ai' };
    } catch (e) {
      const summary = `共${items.length}条国际新闻,主要来自${items[0]?.source || '外媒'}`;
      return { ...sectionData, summary, summaryType: 'local' };
    }
  }
  
  return sectionData;
}

module.exports = { summarizeSection, callLLM, localSummarize };
