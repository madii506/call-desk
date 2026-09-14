// GET /api/price?sym=TSLA[&at=1757500000]  → { sym, yahoo, name, price, currency, atPrice, at, change, src }
// Stocks and majors via Yahoo Finance chart (no key). Crypto tickers get "-USD". Memecoins fall back to Dexscreener search (no history → atPrice null).
const CRYPTO = new Set(['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','TRX','TON','SHIB','PEPE','SUI','APT','ARB','OP','LTC','BCH','UNI','AAVE','HYPE','WIF','BONK','NEAR','ATOM','INJ','TIA','SEI','JUP','ENA','ONDO','RENDER','FET','TAO','KAS','XLM','HBAR','ALGO','FIL','ICP','ETC','MKR','LDO','CRV','PENDLE','VIRTUAL','FARTCOIN','TRUMP','PENGU','POPCAT','MOODENG','GOAT','PNUT','ACT','AI16Z','BERA','IP','KAITO','S']);
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const sym = String(req.query.sym || '').replace(/^\$/, '').toUpperCase().trim();
  const at = Number(req.query.at || 0) || null;
  if (!/^[A-Z0-9.\-]{1,12}$/.test(sym)) return res.status(400).json({ error: 'bad symbol' });
  const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', accept: 'application/json' };
  const tryYahoo = async (y) => {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=3mo&interval=1d`, { headers: UA });
    if (!r.ok) return null; const j = await r.json(); const c = j.chart?.result?.[0]; if (!c || !c.meta) return null;
    const ts = c.timestamp || []; const cl = c.indicators?.quote?.[0]?.close || [];
    let atPrice = null;
    if (at && ts.length) { let best = -1; for (let i = 0; i < ts.length; i++) if (ts[i] <= at && cl[i] != null) best = i; if (best < 0) for (let i = 0; i < ts.length; i++) if (cl[i] != null) { best = i; break; } atPrice = best >= 0 ? cl[best] : null; }
    const price = c.meta.regularMarketPrice ?? null;
    return { sym, yahoo: y, name: c.meta.longName || c.meta.shortName || y, price, currency: c.meta.currency || 'USD', atPrice, at,
      change: (atPrice && price) ? +(((price / atPrice) - 1) * 100).toFixed(2) : null, exchange: c.meta.exchangeName || null, src: 'yahoo' };
  };
  try {
    const order = CRYPTO.has(sym) ? [`${sym}-USD`, sym] : [sym, `${sym}-USD`];
    for (const y of order) { const out = await tryYahoo(y); if (out && out.price != null) return res.status(200).json(out); }
  } catch (e) {}
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`, { headers: { accept: 'application/json' } });
    if (r.ok) { const j = await r.json(); const ps = (j.pairs || []).filter(p => (p.baseToken?.symbol || '').toUpperCase() === sym).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      const p = ps[0]; if (p) return res.status(200).json({ sym, yahoo: null, name: p.baseToken?.name, price: +p.priceUsd, currency: 'USD', atPrice: null, at, change: null, chain: p.chainId, chart: p.url, src: 'dexscreener' }); }
  } catch (e) {}
  return res.status(200).json({ sym, price: null, exists: false, src: 'none' });
}
