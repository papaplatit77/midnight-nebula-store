require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const cors        = require('cors');
const fs          = require('fs');
const path        = require('path');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const ADMIN_ID   = Number(process.env.ADMIN_CHAT_ID);
const ADMIN_IDS  = new Set([
  ADMIN_ID,
  ...((process.env.EXTRA_ADMINS || '').split(',').map(s => Number(s.trim())).filter(Boolean)),
]);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://wakashop-snowy.vercel.app';
const PORT       = process.env.PORT || 3001;
const DB_FILE    = process.env.DB_FILE || path.join(__dirname, 'db.json');

// username или ссылка на аккаунт поддержки
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || null; // @yourname

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error('❌ BOT_TOKEN / ADMIN_CHAT_ID не заданы в .env');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Системная кнопка меню (Mini App) ─────────────────────────
async function setMenuButton() {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🛍 Магазин',
          web_app: { url: WEBAPP_URL },
        },
      }),
    });
    console.log('✅ Кнопка меню установлена');
  } catch (e) {
    console.error('❌ Ошибка установки кнопки меню:', e.message);
  }
}
setMenuButton();

// ── БД ───────────────────────────────────────────────────────
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: {}, bans: {}, orders: {} }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function saveUser(from) {
  const db = loadDB();
  if (!db.orders) db.orders = {};
  db.users[from.id] = {
    id:        from.id,
    username:  from.username   || null,
    firstName: from.first_name || '',
    lastName:  from.last_name  || '',
    joinedAt:  db.users[from.id]?.joinedAt || new Date().toISOString(),
    lastSeen:  new Date().toISOString(),
  };
  saveDB(db);
}
function isBanned(userId) { return !!loadDB().bans[userId]; }


function saveOrder(userId, order) {
  const db = loadDB();
  if (!db.orders) db.orders = {};
  if (!db.orders[userId]) db.orders[userId] = [];
  db.orders[userId].unshift({ ...order, id: Date.now(), date: new Date().toISOString() });
  // Хранить не более 50 заказов на пользователя
  if (db.orders[userId].length > 50) db.orders[userId] = db.orders[userId].slice(0, 50);
  saveDB(db);
}

// ── Состояния ────────────────────────────────────────────────
const waiting = {};   // { [chatId]: 'broadcast' | 'ban' | 'unban' }
const orderPage = {}; // { [chatId]: pageIndex }

// ── Bot ──────────────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const isAdmin = id => ADMIN_IDS.has(id);

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.code || err.message);
});
bot.on('error', (err) => {
  console.error('Bot error:', err.message);
});

// ── Клавиатуры ────────────────────────────────────────────────
const ADMIN_KB = {
  keyboard: [
    [{ text: '📢 Рассылка'  }, { text: '👥 Статистика' }],
    [{ text: '🚫 Забанить'  }, { text: '✅ Разбанить'  }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const USER_KB = {
  keyboard: [
    [{ text: '🛍 Мои заказы' }, { text: 'ℹ️ О нас'   }],
    [{ text: '🆘 Поддержка'  }, { text: '📦 Опт'     }],
    [{ text: '🏙 Города: Курьеры' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// ── Курьеры ───────────────────────────────────────────────────
function getCouriers() {
  try {
    const db = loadDB();
    if (Array.isArray(db.couriers) && db.couriers.length > 0) return db.couriers;
    // Fallback к env var для обратной совместимости
    return JSON.parse(process.env.COURIERS_JSON || '[]');
  } catch { return []; }
}

function buildCitiesKeyboard() {
  const couriers = getCouriers();
  if (!couriers.length) return null;
  const cities = [...new Set(couriers.flatMap(c => c.cities || []))];
  if (!cities.length) return null;
  const rows = [];
  for (let i = 0; i < cities.length; i += 2) {
    const row = [{ text: cities[i], callback_data: `city_${cities[i]}` }];
    if (cities[i + 1]) row.push({ text: cities[i + 1], callback_data: `city_${cities[i + 1]}` });
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ── /start ────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const { id, first_name } = msg.from;
  if (isBanned(id)) return bot.sendMessage(id, '🚫 Вы заблокированы.');
  saveUser(msg.from);
  if (isAdmin(id)) return sendAdminMenu(id);

  bot.sendMessage(id,
    `👋 Привет, <b>${first_name || 'друг'}</b>!\n\n` +
    `Добро пожаловать в <b>Wakashop</b> — лучший вейп-магазин NRW 🇩🇪\n\n` +
    `Чтобы оформить заказ — нажмите кнопку <b>ОФОРМИТЬ ЗАКАЗ</b> в левом нижнем углу.\n\n` +
    `<i>Только оригинальная продукция · Доставка по всей Германии · 18+</i>`,
    { parse_mode: 'HTML', reply_markup: USER_KB }
  );
});

// ── /admin ────────────────────────────────────────────────────
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;
  delete waiting[msg.chat.id];
  sendAdminMenu(msg.chat.id);
});

function sendAdminMenu(chatId) {
  const db = loadDB();
  const totalOrders = Object.values(db.orders || {}).reduce((s, arr) => s + arr.length, 0);
  bot.sendMessage(chatId,
    `🛠 <b>Панель администратора — WAKASHOP</b>\n\n` +
    `👥 Пользователей: <b>${Object.keys(db.users).length}</b>\n` +
    `📦 Заказов: <b>${totalOrders}</b>\n` +
    `🚫 Забанено: <b>${Object.keys(db.bans).length}</b>`,
    { parse_mode: 'HTML', reply_markup: ADMIN_KB }
  );
}

// ── Пагинация заказов ─────────────────────────────────────────
const PAGE_SIZE = 5;

function buildOrdersPage(userId, page) {
  const db     = loadDB();
  const orders = db.orders?.[userId] || [];
  if (!orders.length) return { text: '📭 У вас пока нет заказов.\n\nНажмите кнопку внизу чтобы сделать первый!', kb: null };

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const p          = Math.max(0, Math.min(page, totalPages - 1));
  const slice      = orders.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);

  const lines = slice.map((o, i) => {
    const num    = p * PAGE_SIZE + i + 1;
    const date   = new Date(o.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const time   = new Date(o.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const deliv  = o.deliveryType === 'meeting' ? '🤝' : '📬';
    const pay    = o.payment === 'card' ? '💳' : '💵';
    const items  = (o.items || []).map(i => `  • ${i.name} ×${i.qty}`).join('\n');
    return `<b>#${num}</b> · ${date} ${time}\n📍 ${o.city} ${deliv} ${pay}\n${items}\n💎 <b>${o.total} €</b>`;
  });

  const text = `🛍 <b>Мои заказы</b> (стр. ${p + 1}/${totalPages}):\n\n` + lines.join('\n\n─────────\n\n');

  // Кнопки пагинации
  const nav = [];
  if (p > 0)              nav.push({ text: '← Назад',   callback_data: `orders_${userId}_${p - 1}` });
  if (p < totalPages - 1) nav.push({ text: 'Вперёд →',  callback_data: `orders_${userId}_${p + 1}` });

  const kb = nav.length ? { inline_keyboard: [nav] } : null;
  return { text, kb };
}

// ── Все сообщения ─────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId  = msg.chat.id;
  const msgText = (msg.text || '').trim();

  if (msgText.startsWith('/')) return;

  // ══ ADMIN ══
  if (isAdmin(chatId)) {
    // Ожидание ввода
    if (waiting[chatId]) {
      const mode = waiting[chatId];
      delete waiting[chatId];
      const db = loadDB();

      if (mode === 'broadcast') {
        if (!msgText) return bot.sendMessage(chatId, '❌ Пустое сообщение.', { reply_markup: ADMIN_KB });
        const users = Object.values(db.users);
        bot.sendMessage(chatId, `📤 Рассылка по ${users.length} пользователям...`, { reply_markup: ADMIN_KB });
        let ok = 0, fail = 0;
        for (const u of users) {
          if (db.bans[u.id]) { fail++; continue; }
          try { await bot.sendMessage(u.id, msgText, { parse_mode: 'HTML' }); ok++; }
          catch { fail++; }
          await sleep(50);
        }
        return bot.sendMessage(chatId,
          `✅ <b>Рассылка завершена</b>\n📨 Отправлено: <b>${ok}</b>\n❌ Не доставлено: <b>${fail}</b>`,
          { parse_mode: 'HTML', reply_markup: ADMIN_KB }
        );
      }

      if (mode === 'ban' || mode === 'unban') {
        const input  = msgText.replace(/^@/, '').toLowerCase();
        const target = Object.values(db.users).find(u =>
          (u.username && u.username.toLowerCase() === input) || String(u.id) === input
        );
        if (!target) {
          return bot.sendMessage(chatId, `❌ Пользователь <code>@${input}</code> не найден.`, { parse_mode: 'HTML', reply_markup: ADMIN_KB });
        }
        const name = target.username ? `@${target.username}` : `id:${target.id}`;
        if (mode === 'ban') {
          db.bans[target.id] = { bannedAt: new Date().toISOString(), username: target.username };
          saveDB(db);
          bot.sendMessage(target.id, '🚫 Вы заблокированы в Wakashop.').catch(() => {});
          return bot.sendMessage(chatId, `🚫 <b>${name}</b> забанен.`, { parse_mode: 'HTML', reply_markup: ADMIN_KB });
        } else {
          if (!db.bans[target.id]) {
            return bot.sendMessage(chatId, `ℹ️ <b>${name}</b> не был заблокирован.`, { parse_mode: 'HTML', reply_markup: ADMIN_KB });
          }
          delete db.bans[target.id];
          saveDB(db);
          bot.sendMessage(target.id, '✅ Вы разблокированы. Напишите /start.').catch(() => {});
          return bot.sendMessage(chatId, `✅ <b>${name}</b> разбанен.`, { parse_mode: 'HTML', reply_markup: ADMIN_KB });
        }
      }
      return;
    }

    // Кнопки
    if (msgText === '📢 Рассылка') { waiting[chatId] = 'broadcast'; return bot.sendMessage(chatId, '📢 Отправьте текст рассылки (HTML).\n\n<i>Отмена — /admin</i>', { parse_mode: 'HTML', reply_markup: ADMIN_KB }); }
    if (msgText === '👥 Статистика') {
      const db = loadDB();
      const users = Object.values(db.users);
      if (!users.length) return bot.sendMessage(chatId, '👥 Нет пользователей.', { reply_markup: ADMIN_KB });
      const totalOrders = Object.values(db.orders || {}).reduce((s, a) => s + a.length, 0);
      const lines = users.map((u, i) => {
        const uname  = u.username ? `@${u.username}` : `id:${u.id}`;
        const name   = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
        const banned = db.bans[u.id] ? ' 🚫' : '';
        const ords   = (db.orders?.[u.id] || []).length;
        return `${i + 1}. ${uname} — ${name}${banned} · заказов: ${ords}`;
      });
      for (let i = 0; i < lines.length; i += 40) {
        await bot.sendMessage(chatId,
          (i === 0 ? `👥 <b>Пользователи (${users.length}), заказов всего: ${totalOrders}</b>\n\n` : '') + lines.slice(i, i + 40).join('\n'),
          { parse_mode: 'HTML', reply_markup: ADMIN_KB }
        );
      }
      return;
    }
    if (msgText === '🚫 Забанить')  { waiting[chatId] = 'ban';   return bot.sendMessage(chatId, '🚫 Отправьте @username или ID.\n\n<i>Отмена — /admin</i>', { parse_mode: 'HTML', reply_markup: ADMIN_KB }); }
    if (msgText === '✅ Разбанить') { waiting[chatId] = 'unban'; return bot.sendMessage(chatId, '✅ Отправьте @username или ID.\n\n<i>Отмена — /admin</i>', { parse_mode: 'HTML', reply_markup: ADMIN_KB }); }

    return;
  }

  // ══ USER ══
  if (isBanned(chatId)) return bot.sendMessage(chatId, '🚫 Вы заблокированы.');

  if (msgText === '🛍 Мои заказы') {
    orderPage[chatId] = 0;
    const { text, kb } = buildOrdersPage(chatId, 0);
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: kb || USER_KB });
  }

  if (msgText === 'ℹ️ О нас') {
    return bot.sendMessage(chatId,
      `🛒 <b>WAKASHOP</b> — один из быстрорастущих магазинов в Германии с актуальным ассортиментом и надёжным сервисом.\n\n` +
      `<b>Что у нас найдёте:</b>\n` +
      `• жидкости и pod-системы\n` +
      `• одноразовые устройства и картриджи\n` +
      `• популярные новинки и постоянное обновление товаров\n\n` +
      `<b>Почему выбирают нас:</b>\n` +
      `• понятные условия и адекватные цены\n` +
      `• быстрая и стабильная доставка\n` +
      `• выгодные предложения для опта и перепродажи\n` +
      `• живая поддержка и оперативная связь\n\n` +
      `📍 <b>Особенно востребованы в регионах:</b> Nordrhein-Westfalen, Niedersachsen.\n\n` +
      `<i>Только для лиц 18+. Никотин вызывает зависимость.</i>`,
      { parse_mode: 'HTML', reply_markup: USER_KB }
    );
  }

  if (msgText === '📦 Опт') {
    return bot.sendMessage(chatId,
      `📦 <b>ОПТ</b>\n\n` +
      `Для оптовых заказов и обсуждения условий сотрудничества\n` +
      `пожалуйста, свяжитесь с нашим менеджером:\n\n` +
      `@Manager_NRW_1`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: 'https://t.me/Manager_NRW_1' }]],
        },
      }
    );
  }

  if (msgText === '🏙 Города: Курьеры') {
    const kb = buildCitiesKeyboard();
    if (!kb) {
      return bot.sendMessage(chatId,
        `🏙 <b>Курьеры по городам</b>\n\nПока курьеры не добавлены. Напишите в поддержку для уточнения.`,
        { parse_mode: 'HTML', reply_markup: USER_KB }
      );
    }
    return bot.sendMessage(chatId,
      `🏙 <b>Выберите ваш город:</b>\n\n<i>Курьер свяжется с вами и поможет оформить заказ напрямую.</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (msgText === '🆘 Поддержка') {
    return bot.sendMessage(chatId,
      `🛟 <b>Поддержка</b>\n\n` +
      `Если у вас есть вопросы или пожелания,\n` +
      `свяжитесь с нашим менеджером — мы всегда готовы помочь:\n\n` +
      `@Manager_NRW_1`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: 'https://t.me/Manager_NRW_1' }]],
        },
      }
    );
  }
});

// ── Callback (пагинация заказов + выбор города) ──────────────
bot.on('callback_query', async (query) => {
  bot.answerCallbackQuery(query.id);

  // Выбор города — показать курьеров
  if (query.data.startsWith('city_')) {
    const city = query.data.slice(5);
    const couriers = getCouriers().filter(c => (c.cities || []).includes(city));
    if (!couriers.length) {
      return bot.sendMessage(query.message.chat.id,
        `😔 В городе <b>${city}</b> пока нет курьеров.`,
        { parse_mode: 'HTML', reply_markup: USER_KB }
      );
    }
    const lines = couriers.map((c, i) => {
      const name = c.name ? `<b>${c.name}</b>` : `<b>Курьер ${i + 1}</b>`;
      const contact = c.username
        ? `@${c.username.replace(/^@/, '')}`
        : c.chatId ? `<code>${c.chatId}</code>` : '—';
      return `${name} — ${contact}`;
    });
    const inlineKb = couriers
      .filter(c => c.username)
      .map(c => [{ text: `✉️ Написать ${c.name || 'курьеру'}`, url: `https://t.me/${c.username.replace(/^@/, '')}` }]);

    return bot.sendMessage(query.message.chat.id,
      `🏙 <b>Курьеры в городе ${city}:</b>\n\n${lines.join('\n\n')}\n\n<i>Напишите напрямую — курьер поможет с заказом.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: inlineKb.length ? { inline_keyboard: inlineKb } : USER_KB,
      }
    );
  }

  const match = query.data.match(/^orders_(\d+)_(\d+)$/);
  if (!match) return;

  const userId = Number(match[1]);
  const page   = Number(match[2]);

  // Только владелец может листать свои заказы
  if (query.from.id !== userId) return;

  const { text, kb } = buildOrdersPage(userId, page);
  bot.editMessageText(text, {
    chat_id:    query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: kb || undefined,
  }).catch(() => {});
});

// ── Express API ───────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Курьеры (API) ─────────────────────────────────────────────
app.get('/api/couriers', (req, res) => {
  res.json(getCouriers());
});

app.post('/api/couriers', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { couriers } = req.body;
  if (!Array.isArray(couriers)) return res.status(400).json({ error: 'couriers must be array' });
  const db = loadDB();
  db.couriers = couriers;
  saveDB(db);
  res.json({ ok: true });
});

// ── Продукты ──────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const db = loadDB();
  res.json(db.products || []);
});

app.post('/api/products', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { products } = req.body;
  if (!Array.isArray(products)) return res.status(400).json({ error: 'products must be array' });
  const db = loadDB();
  db.products = products;
  saveDB(db);
  res.json({ ok: true });
});

// Сохранение заказа (вызывается из Vercel function)
app.post('/api/save-order', (req, res) => {
  const { tgUserId, ...order } = req.body;
  if (!tgUserId) return res.status(400).json({ error: 'No userId' });
  saveOrder(tgUserId, order);
  res.json({ ok: true });
});

// Основной обработчик заказа (для локального использования)
app.post('/api/order', async (req, res) => {
  const { tgUsername, tgUserId, deliveryType, city, payment, items, total } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Корзина пустая' });
  if (tgUserId && isBanned(tgUserId)) return res.status(403).json({ error: 'Заблокировано' });

  const deliveryLabel = deliveryType === 'meeting' ? '🤝 Личная встреча' : '📬 Почта (DHL/Hermes)';
  const paymentLabel  = payment === 'card' ? '💳 Банковская карта' : '💵 Наличные';
  const itemsList     = items.map(i => `• ${i.name} × ${i.qty} — ${(i.price * i.qty).toFixed(2)} €`).join('\n');

  const orderText =
    `🛒 <b>НОВЫЙ ЗАКАЗ — WAKASHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${tgUsername || 'неизвестен'}${tgUserId ? ` (id: ${tgUserId})` : ''}\n` +
    `📍 ${city}\n🚚 ${deliveryLabel}\n💰 ${paymentLabel}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n💎 <b>Итого: ${total} €</b>`;

  try {
    await bot.sendMessage(ADMIN_ID, orderText, { parse_mode: 'HTML' });
    if (tgUserId) {
      saveOrder(tgUserId, { tgUsername, deliveryType, city, payment, items, total });
      bot.sendMessage(tgUserId,
        `✅ <b>Заказ принят!</b>\n\nСкоро свяжемся с вами.\n📍 ${city}\n🚚 ${deliveryLabel}\n💰 ${paymentLabel}\n💎 <b>${total} €</b>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ error: 'Не удалось отправить заказ' });
  }
});

// Получить всех пользователей для админки
app.get('/api/admin/users', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const db = loadDB();
  const users = Object.values(db.users || {}).map(u => ({
    ...u,
    banned: !!db.bans[u.id],
    orderCount: (db.orders?.[u.id] || []).length,
    totalSpent: (db.orders?.[u.id] || []).reduce((s, o) => s + (parseFloat(o.total) || 0), 0),
  }));
  users.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  res.json(users);
});

// Получить все заказы для админки (защищённый endpoint)
app.get('/api/admin/orders', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const db = loadDB();
  const allOrders = Object.entries(db.orders || {}).flatMap(([userId, orders]) =>
    orders.map(o => ({ ...o, tgUserId: Number(userId) }))
  );
  allOrders.sort((a, b) => b.id - a.id);
  res.json(allOrders);
});

// Обновить статус заказа
app.patch('/api/admin/orders/:orderId/status', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { orderId } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  const db = loadDB();
  let found = false;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      db.orders[userId][idx].status = status;
      found = true;
      break;
    }
  }
  if (!found) return res.status(404).json({ error: 'Order not found' });
  saveDB(db);
  res.json({ ok: true });
});

// Удалить заказ
app.delete('/api/admin/orders/:orderId', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { orderId } = req.params;
  const db = loadDB();
  let found = false;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      db.orders[userId].splice(idx, 1);
      found = true;
      break;
    }
  }
  if (!found) return res.status(404).json({ error: 'Order not found' });
  saveDB(db);
  res.json({ ok: true });
});

// Удалить пользователя
app.delete('/api/admin/users/:userId', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const db = loadDB();
  delete db.users[userId];
  delete db.orders[userId];
  delete db.bans[userId];
  saveDB(db);
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log(`✅ Wakashop bot запущен | порт ${PORT}`);
});
