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
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://site-beige-sigma-46.vercel.app';
const PORT       = process.env.PORT || 3001;
const DB_FILE    = path.join(__dirname, 'db.json');

// username или ссылка на аккаунт поддержки
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || null; // @yourname

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error('❌ BOT_TOKEN / ADMIN_CHAT_ID не заданы в .env');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  ],
  resize_keyboard: true,
  is_persistent: true,
};

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
      `🛒 <b>WAKASHOP — NRW</b>\n\n` +
      `Мы — команда из Северного Рейна-Вестфалии, которая с 2023 года поставляет только оригинальную вейп-продукцию.\n\n` +
      `<b>Почему выбирают нас:</b>\n` +
      `✅ 100% оригинальные товары\n` +
      `⚡ Быстрая доставка по всей Германии\n` +
      `🤝 Личные встречи в NRW\n` +
      `💬 Живая поддержка 7 дней в неделю\n` +
      `📦 DHL / Hermes доставка\n\n` +
      `<b>Ассортимент:</b> одноразки, поды, жидкости, расходники\n\n` +
      `<i>Только для лиц 18+. Никотин вызывает зависимость.</i>`,
      { parse_mode: 'HTML', reply_markup: USER_KB }
    );
  }

  if (msgText === '📦 Опт') {
    const supportLink = SUPPORT_USERNAME
      ? `@${SUPPORT_USERNAME.replace(/^@/, '')}`
      : 'администратору';
    return bot.sendMessage(chatId,
      `📦 <b>Оптовые поставки — WAKASHOP</b>\n\n` +
      `Работаем с оптовыми клиентами по всей Германии.\n\n` +
      `<b>Условия опта:</b>\n` +
      `• Минимальный заказ от <b>50 штук</b>\n` +
      `• Скидки от 15% при заказе от 100 шт\n` +
      `• Скидки от 25% при заказе от 300 шт\n` +
      `• Доставка по всей Германии (DHL/Hermes)\n` +
      `• Постоянным клиентам — индивидуальные условия\n\n` +
      `<b>Ассортимент:</b> Elf Bar, Vozol, Chaser, Lost Mary и другие бренды\n\n` +
      `📩 Для обсуждения условий напишите ${supportLink}`,
      {
        parse_mode: 'HTML',
        reply_markup: SUPPORT_USERNAME ? {
          inline_keyboard: [[{ text: '✉️ Написать по опту', url: `https://t.me/${SUPPORT_USERNAME.replace(/^@/, '')}` }]],
        } : USER_KB,
      }
    );
  }

  if (msgText === '🆘 Поддержка') {
    const supportLink = SUPPORT_USERNAME
      ? `Напишите нам: @${SUPPORT_USERNAME.replace(/^@/, '')}`
      : `Напишите администратору — он ответит в ближайшее время.`;
    return bot.sendMessage(chatId,
      `🆘 <b>Поддержка Wakashop</b>\n\n${supportLink}\n\n` +
      `<i>Время работы: ежедневно с 10:00 до 22:00</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: SUPPORT_USERNAME ? {
          inline_keyboard: [[{ text: '✉️ Написать в поддержку', url: `https://t.me/${SUPPORT_USERNAME.replace(/^@/, '')}` }]],
        } : USER_KB,
      }
    );
  }
});

// ── Callback (пагинация заказов) ─────────────────────────────
bot.on('callback_query', async (query) => {
  bot.answerCallbackQuery(query.id);

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
app.use(express.json({ limit: '1mb' }));

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

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log(`✅ Wakashop bot запущен | порт ${PORT}`);
});
