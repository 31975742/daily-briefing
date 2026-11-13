/**
 * 国际新闻抓取(英文源)
 * 主源: CNBC RSS (已验证可用)
 * 备源: BBC / Guardian / Al Jazeera RSS
 */
const axios = require('axios');
const xml2js = require('xml2js');

const SOURCES = [
  {
    name: 'CNBC',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114'
  },
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' }
];

async function parseFeed(source) {
  const { data } = await axios.get(source.url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });

  const result = await xml2js.parseStringPromise(data);
  const entries = result.rss?.channel?.[0]?.item || [];

  return entries.slice(0, 8).map(item => ({
    title: (item.title?.[0] || '').trim(),
    link: (item.link?.[0] || '').trim(),
    summary: item.description?.[0]
      ? item.description[0].replace(/<[^>]+>/g, '').substring(0, 150).trim()
      : '',
    source: source.name,
    language: 'en'
  })).filter(i => i.title);
}

async function fetchIntlNews() {
  const errors = [];

  for (const source of SOURCES) {
    try {
      const items = await parseFeed(source);
      if (items.length > 0) {
        return {
          type: 'intlnews',
          name: '国际新闻',
          items: items.slice(0, 8),
          provider: source.name,
          fetchedAt: new Date().toISOString()
        };
      }
    } catch (e) {
      errors.push(`${source.name}: ${e.response ? e.response.status : e.message}`);
    }
  }

  console.error('[国际新闻] 所有源均失败:', errors.join('; '));
  return {
    type: 'intlnews',
    name: '国际新闻',
    items: [],
    error: errors.join('; '),
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { fetchIntlNews };
