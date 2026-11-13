/**
 * 微博热搜抓取
 * 主源: 60s API (开源聚合接口,已验证可用) https://github.com/vikiboss/60s
 * 备源: 微博官方移动端接口
 */
const axios = require('axios');

async function fetchFrom60s() {
  const { data } = await axios.get('https://60s.viki.moe/v2/weibo', {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (data.code !== 200 || !Array.isArray(data.data)) {
    throw new Error('60s API 返回异常');
  }

  return data.data.slice(0, 15).map((item, idx) => ({
    title: item.title || '',
    rank: item.hot_index ? 0 : idx + 1,
    hotValue: item.hot_value || 0,
    link: item.link || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || '')}`,
    source: '微博热搜'
  })).filter(i => i.title);
}

async function fetchWeiboOfficial() {
  const { data } = await axios.get('https://weibo.com/ajax/side/hotSearch', {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  const items = [];
  if (data.data && data.data.realtime) {
    data.data.realtime
      .filter(x => !x.is_ad)
      .slice(0, 15)
      .forEach((item, idx) => {
        items.push({
          title: item.word,
          rank: idx + 1,
          hotValue: item.num || 0,
          link: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}`,
          source: '微博热搜'
        });
      });
  }
  return items;
}

async function fetchWeiboHot() {
  let items = [];
  let lastError = null;

  try {
    items = await fetchFrom60s();
  } catch (e) {
    lastError = e;
    console.error('[微博热搜] 60s API 失败,尝试官方接口:', e.message);
    try {
      items = await fetchWeiboOfficial();
    } catch (e2) {
      lastError = e2;
    }
  }

  if (items.length === 0) {
    return {
      type: 'weibohot',
      name: '微博热搜',
      items: [],
      error: lastError ? lastError.message : '无数据',
      fetchedAt: new Date().toISOString()
    };
  }

  // 按热度排序并重新编号
  items.sort((a, b) => (b.hotValue || 0) - (a.hotValue || 0));
  items.forEach((it, i) => { it.rank = i + 1; });

  return {
    type: 'weibohot',
    name: '微博热搜',
    items: items.slice(0, 10),
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { fetchWeiboHot };
