/**
 * 新闻联播分集标题抓取
 * 来源: 央视电视栏目页 tv.cctv.com/lm/xwlb/day/YYYYMMDD.shtml (静态可解析)
 */
const axios = require('axios');

/**
 * 抓取指定日期(YYYYMMDD)的新闻联播条目
 */
async function fetchByDate(dateStr) {
  const url = `https://tv.cctv.com/lm/xwlb/day/${dateStr}.shtml`;
  const { data } = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  // 提取每条的链接与标题,去重,过滤"完整版《新闻联播》"总条目
  const re = /href="(https:\/\/tv\.cctv\.com\/[^"]+VIDE[^"]+\.shtml)"[^>]*title="([^"]{6,150})"/g;
  let m;
  const items = [];
  const seen = new Set();
  while ((m = re.exec(data))) {
    const title = m[2].trim();
    if (seen.has(title)) continue;
    seen.add(title);
    if (title.startsWith('《新闻联播》')) continue; // 整期完整版
    items.push({
      title: title.replace(/^\[视频\]/, '').trim(),
      link: m[1],
      source: '新闻联播'
    });
  }
  return items;
}

async function fetchXinwenLianbo() {
  try {
    const now = new Date();
    // 早报场景:优先取昨天日期(昨夜联播),今天日期作为备选
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const fmt = d =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    let items = [];
    let usedDate = fmt(yesterday);

    try {
      items = await fetchByDate(fmt(yesterday));
    } catch (e) {
      // 昨天失败则尝试今天
    }
    if (items.length === 0) {
      usedDate = fmt(now);
      items = await fetchByDate(fmt(now));
    }

    return {
      type: 'xinwenlianbo',
      name: '新闻联播',
      items: items.slice(0, 8),
      broadcastDate: usedDate,
      fetchedAt: now.toISOString()
    };
  } catch (error) {
    console.error('[新闻联播] 抓取失败:', error.message);
    return {
      type: 'xinwenlianbo',
      name: '新闻联播',
      items: [],
      error: error.message,
      fetchedAt: new Date().toISOString()
    };
  }
}

module.exports = { fetchXinwenLianbo };
