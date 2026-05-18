// ── Белые списки ─────────────────────────────────────────────
const ALLOWED_CITIES = new Set([
  'Köln','Düsseldorf','Dortmund','Essen','Duisburg','Bochum','Wuppertal',
  'Bielefeld','Bonn','Münster','Mönchengladbach','Gelsenkirchen','Krefeld',
  'Aachen','Oberhausen','Hagen','Hamm','Solingen','Leverkusen','Neuss',
  'Paderborn','Mülheim an der Ruhr','Remscheid','Siegen','Moers','Witten',
  'Bergisch Gladbach','Recklinghausen','Bottrop','Iserlohn',
  'Berlin','Hamburg','München','Frankfurt am Main','Stuttgart',
  'Leipzig','Bremen','Hannover','Nürnberg','Dresden',
]);

const ALLOWED_DELIVERY = new Set(['meeting', 'mail']);
const ALLOWED_PAYMENT  = new Set(['card', 'cash']);

// ── Рейт-лимит: max 3 заказа с одного IP/userId за 10 минут ──
const LIMIT        = 3;
const WINDOW_MS    = 10 * 60 * 1000;
const rateLimitMap = new Map();

function isRateLimited(key) {
  const now  = Date.now();
  const hits = (rateLimitMap.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) return true;
  hits.push(now);
  rateLimitMap.set(key, hits);
  return false;
}

// ── HTML-экранирование ─────────────────────────────────────────
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

async function tgSend(token, chatId, text) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Bot not configured' });



  const { tgUsername, tgUserId, deliveryType, city, payment, items, total, courierId,
          courierName, mailOption, shippingCost,
          firstName, lastName, street, plz } = req.body;

  // ── Валидация ─────────────────────────────────────────────────
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Корзина пустая' });

  if (items.length > 30)
    return res.status(400).json({ error: 'Слишком много позиций' });

  if (deliveryType === 'meeting' && !ALLOWED_CITIES.has(city))
    return res.status(400).json({ error: 'Недопустимый город' });

  if (!ALLOWED_DELIVERY.has(deliveryType))
    return res.status(400).json({ error: 'Недопустимый способ доставки' });

  if (!ALLOWED_PAYMENT.has(payment))
    return res.status(400).json({ error: 'Недопустимый способ оплаты' });

  // Проверяем каждый товар — цена > 0, количество > 0, название не пустое
  for (const item of items) {
    if (!item.name || typeof item.name !== 'string' || item.name.length > 200)
      return res.status(400).json({ error: 'Некорректное название товара' });
    if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0)
      return res.status(400).json({ error: 'Некорректная цена товара' });
    if (!Number.isInteger(Number(item.qty)) || Number(item.qty) < 1 || Number(item.qty) > 99)
      return res.status(400).json({ error: 'Некорректное количество' });
  }

  // ── Рейт-лимит ────────────────────────────────────────────────
  const ip       = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const limitKey = tgUserId ? `uid:${tgUserId}` : `ip:${ip}`;
  if (isRateLimited(limitKey))
    return res.status(429).json({ error: 'Слишком много заказов. Подождите 10 минут.' });

  // ── Формируем сообщение ───────────────────────────────────────
  const mailTypeLabel = mailOption === 'track' ? '📦 С трек-номером (6,20 €)' : mailOption === 'notrack' ? '✉️ Без трек-номера (4,19 €)' : '';
  const deliveryLabel = deliveryType === 'meeting' ? '🤝 Личная встреча' : `📬 Почта (DHL/Hermes)`;
  const paymentLabel  = payment === 'card' ? '💳 Банковская карта' : '💵 Наличные';
  const itemsList     = items
    .map(i => `• ${esc(i.name)} × ${Number(i.qty)} — ${(Number(i.price) * Number(i.qty)).toFixed(2)} €`)
    .join('\n');

  const mailDetails = deliveryType === 'mail'
    ? `👤 <b>${esc(firstName)} ${esc(lastName)}</b>\n` +
      `🏠 ${esc(street)}, ${esc(plz)} ${esc(city)}\n` +
      (mailTypeLabel ? `📮 ${mailTypeLabel}\n` : '')
    : `📍 ${esc(city)}\n` +
      (courierName ? `🚗 Курьер: <b>${esc(courierName)}</b>\n` : '');

  const text =
    `🛒 <b>НОВЫЙ ЗАКАЗ — WAKASHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `✈️ ${esc(tgUsername) || 'неизвестен'}${tgUserId ? ` (id: ${tgUserId})` : ''}\n` +
    mailDetails +
    `🚚 ${deliveryLabel}\n` +
    `💰 ${paymentLabel}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💎 <b>Итого: ${esc(total)} €</b>`;

  // ── Отправка админу (всегда) ─────────────────────────────────
  const tgRes = await tgSend(TOKEN, CHAT_ID, text);
  if (!tgRes.ok) {
    const err = await tgRes.text();
    return res.status(500).json({ error: err });
  }

  // ── Подтверждение клиенту ─────────────────────────────────────
  if (tgUserId) {
    tgSend(TOKEN, tgUserId,
      `✅ <b>Заказ принят!</b>\n\n` +
      `📍 ${esc(city)} · ${deliveryLabel}\n` +
      `💰 ${paymentLabel}\n` +
      `💎 <b>${esc(total)} €</b>\n\n` +
      `⏳ Ожидайте — совсем скоро с вами свяжется курьер 🚚`
    ).catch(() => {});
  }

  // ── Сохранение заказа + уведомление курьеру через бота ──────
  const BOT_URL = process.env.BOT_API_URL || 'https://wakashop-production.up.railway.app';
  fetch(`${BOT_URL}/api/save-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tgUserId: tgUserId || null,
      tgUsername: tgUsername || 'неизвестен',
      name: deliveryType === 'mail' ? `${firstName} ${lastName}`.trim() : tgUsername,
      deliveryType,
      city,
      payment,
      items,
      total,
      status: 'new',
      courierId: courierId || null,
      courierName: courierName || null,
      ...(deliveryType === 'mail' && { firstName, lastName, address: `${street}, ${plz} ${city}` }),
    }),
  }).catch(() => {});

  return res.status(200).json({ ok: true });
}
