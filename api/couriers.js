export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const couriers = JSON.parse(process.env.COURIERS_JSON || '[]');
    return res.status(200).json(couriers);
  } catch {
    return res.status(200).json([]);
  }
}
