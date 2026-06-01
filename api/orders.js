// GET /api/orders — список всех заказов для админки
// PATCH /api/orders/:id/status — обновить статус заказа
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Проверяем пароль администратора
  const password = req.headers['x-admin-password'];
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const BOT_URL = process.env.BOT_API_URL || 'https://wakashop-production.up.railway.app';
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${BOT_URL}/api/admin/orders`, {
        headers: { 'x-admin-secret': ADMIN_SECRET || '' },
      });
      if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
      const data = await r.json();
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const orderId = req.query.id;
      if (!orderId) return res.status(400).json({ error: 'id required' });
      const r = await fetch(`${BOT_URL}/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET || '' },
      });
      if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const orderId = req.query.id;
      if (!orderId) return res.status(400).json({ error: 'id required' });
      const { status, courierId, courierName, courierUsername } = req.body || {};

      if (courierId !== undefined || courierName !== undefined) {
        const r = await fetch(`${BOT_URL}/api/admin/orders/${orderId}/courier`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET || '' },
          body: JSON.stringify({ courierId, courierName, courierUsername }),
        });
        if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
        return res.status(200).json({ ok: true });
      }

      if (!status) return res.status(400).json({ error: 'status required' });
      const r = await fetch(`${BOT_URL}/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET || '' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) return res.status(502).json({ error: 'Bot API error' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
