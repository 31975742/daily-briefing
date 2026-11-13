/**
 * A股大盘数据抓取
 * 主源: 东方财富 push2 API (已验证可用)
 * 备源: 腾讯行情 qt.gtimg.cn
 */
const axios = require('axios');

async function fetchEastMoney() {
  // 上证指数 1.000001 / 深证成指 0.399001 / 创业板指 0.399006
  const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006&fields=f2,f3,f4,f12,f14';
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/' }
  });

  if (!data.data || !data.data.diff) throw new Error('东财接口返回格式异常');

  return data.data.diff.map(item => ({
    name: item.f14,
    symbol: item.f12,
    current: parseFloat(item.f2) || 0,
    change: parseFloat(item.f4) || 0,
    changePercent: parseFloat(item.f3) || 0,
    isUp: (parseFloat(item.f3) || 0) >= 0
  }));
}

async function fetchTencentBackup() {
  // v_sh000001="1~上证指数~000001~当前~昨收~开盘~成交量~...~涨跌~涨跌%"
  const { data } = await axios.get('https://qt.gtimg.cn/q=sh000001,sz399001,sz399006', { timeout: 10000 });
  const lines = data.split(';').filter(l => l.includes('~'));
  return lines.map(line => {
    const p = line.split('~');
    const current = parseFloat(p[3]) || 0;
    const prevClose = parseFloat(p[4]) || 0;
    const changePercent = prevClose > 0 ? ((current - prevClose) / prevClose) * 100 : 0;
    return {
      name: p[1],
      symbol: p[2],
      current,
      change: current - prevClose,
      changePercent: parseFloat(changePercent.toFixed(2)),
      isUp: changePercent >= 0
    };
  });
}

async function fetchHotSectors() {
  try {
    // 东财行业板块涨幅榜
    const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2+f:!50&fields=f3,f14';
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/' }
    });
    if (data.data && data.data.diff) {
      return data.data.diff.slice(0, 5).map(item => ({
        name: item.f14,
        changePercent: parseFloat(item.f3) || 0
      }));
    }
  } catch (e) {
    console.error('[A股板块] 获取失败:', e.message);
  }
  return [];
}

async function fetchAStock() {
  let indices = [];
  let lastError = null;

  try {
    indices = await fetchEastMoney();
  } catch (e) {
    lastError = e;
    console.error('[A股] 东财接口失败,尝试腾讯备源:', e.message);
    try {
      indices = await fetchTencentBackup();
    } catch (e2) {
      lastError = e2;
    }
  }

  if (indices.length === 0) {
    return {
      type: 'astock',
      name: 'A股大盘',
      indices: [],
      hotSectors: [],
      error: lastError ? lastError.message : '无数据',
      fetchedAt: new Date().toISOString()
    };
  }

  const hotSectors = await fetchHotSectors();

  return {
    type: 'astock',
    name: 'A股大盘',
    indices,
    hotSectors,
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { fetchAStock };
