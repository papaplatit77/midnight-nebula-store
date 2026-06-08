const BOT_URL = process.env.BOT_API_URL || 'https://midnight-nebula-store-production.up.railway.app';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${BOT_URL}/api/couriers`);
      if (r.ok) {
        const data = await r.json();
        return res.status(200).json(data);
      }
    } catch (_) {}
    // Fallback к env var если бот недоступен
    try {
      const couriers = JSON.parse(process.env.COURIERS_JSON || '[]');
      return res.status(200).json(couriers);
    } catch {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    const password = req.headers['x-admin-password'];
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD)
      return res.status(401).json({ error: 'Unauthorized' });

    try {
      const r = await fetch(`${BOT_URL}/api/couriers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET || '',
        },
        body: JSON.stringify(req.body),
      });
      if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).end();
}
