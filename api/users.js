// GET /api/users — список пользователей для админки
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const password = req.headers['x-admin-password'];
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' });

  const BOT_URL = process.env.BOT_API_URL || 'https://wakashop-production.up.railway.app';
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  try {
    const r = await fetch(`${BOT_URL}/api/admin/users`, {
      headers: { 'x-admin-secret': ADMIN_SECRET || '' },
    });
    if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
