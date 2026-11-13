/**
 * 科技新闻抓取
 * 数据源: 36氪 + IT之家 + 快科技 (均为已验证可用的 RSS)
 */
const axios = require('axios');
const xml2js = require('xml2js');

const SOURCES = [
  { name: '36氪', url: 'https://www.36kr.com/feed' },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
  { name: '快科技', url: 'https://rss.mydrivers.com/rss.aspx?Tid=1' }
];

async function parseRSS(source) {
  try {
    const { data } = await axios.get(source.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const result = await xml2js.parseStringPromise(data);
    const channel = result.rss?.channel?.[0];
    const entries = channel?.item || [];

    return entries.slice(0, 8).map(item => {
      const title = (item.title?.[0] || '').trim();
      const link = (item.link?.[0] || item.guid?.[0] || '').trim();
      const description = item.description?.[0] || '';
      return {
        title,
        link,
        summary: description
          ? description.replace(/<[^>]+>/g, '').substring(0, 120).trim()
          : '',
        source: source.name
      };
    }).filter(i => i.title);
  } catch (e) {
    console.error(`[科技新闻:${source.name}] 抓取失败:`, e.message);
    return [];
  }
}

async function fetchTechNews() {
  // 三个源并行抓取
  const results = await Promise.all(SOURCES.map(parseRSS));
  const allItems = results.flat();

  // 按标题去重
  const uniqueItems = [];
  const seenTitles = new Set();
  for (const item of allItems) {
    const normalized = item.title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
    if (!seenTitles.has(normalized)) {
      seenTitles.add(normalized);
      uniqueItems.push(item);
    }
  }

  return {
    type: 'technews',
    name: '科技新闻',
    items: uniqueItems.slice(0, 12),
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { fetchTechNews };
