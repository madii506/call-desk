// GET /api/tweet?id=1234567890  → { id, author, name, avatar, text, views, likes, replies, reposts, created, url, exists, src }
// Source: FxTwitter (exposes view counts). Fallback: X syndication tweet-result (no views).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  let id = String(req.query.id || '').trim();
  const m = id.match(/status\/(\d{1,25})/); if (m) id = m[1];
  if (!/^\d{1,25}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const UA = { 'user-agent': 'Mozilla/5.0 (compatible; callbot/1.0)' };
  try {
    const r = await fetch(`https://api.fxtwitter.com/i/status/${id}`, { headers: UA });
    if (r.status === 404) return res.status(200).json({ id, exists: false, src: 'fxtwitter' });
    if (r.ok) {
      const j = await r.json(); const t = j.tweet;
      if (t && t.id) return res.status(200).json({
        id: t.id, author: t.author?.screen_name, name: t.author?.name,
        avatar: (t.author?.avatar_url || '').replace('_normal', '_400x400'),
        text: t.text, views: t.views ?? null, likes: t.likes ?? null, replies: t.replies ?? null, reposts: t.retweets ?? null,
        created: t.created_at, url: t.url, exists: true, src: 'fxtwitter'
      });
    }
  } catch (e) {}
  try {
    const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
    const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`, { headers: UA });
    if (r.ok) {
      const t = await r.json();
      if (t && t.id_str) return res.status(200).json({ id: t.id_str, author: t.user?.screen_name, name: t.user?.name,
        avatar: (t.user?.profile_image_url_https || '').replace('_normal', '_400x400'), text: t.text, views: null,
        likes: t.favorite_count ?? null, replies: t.conversation_count ?? null, reposts: null, created: t.created_at,
        url: `https://x.com/${t.user?.screen_name}/status/${t.id_str}`, exists: true, src: 'syndication' });
    }
    if (r.status === 404) return res.status(200).json({ id, exists: false, src: 'syndication' });
  } catch (e) {}
  return res.status(200).json({ id, exists: null, src: 'none' });
}
