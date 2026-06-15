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
const WEBAPP_URL     = process.env.WEBAPP_URL || 'https://midnight-nebula-snowy.vercel.app';
const PORT           = process.env.PORT || 3001;
const DB_FILE        = process.env.DB_FILE || path.join(__dirname, 'db.json');
const LOG_CHANNEL_ID = process.env.TELEGRAM_LOG_CHAT_ID || null;

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
  const id = Date.now();
  db.orders[userId].unshift({ ...order, id, date: new Date().toISOString() });
  if (db.orders[userId].length > 50) db.orders[userId] = db.orders[userId].slice(0, 50);
  saveDB(db);
  return id;
}

function findOrderById(orderId) {
  const db = loadDB();
  for (const [userId, orders] of Object.entries(db.orders || {})) {
    const idx = orders.findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) return { order: orders[idx], userId: Number(userId), idx };
  }
  return null;
}

function getCourierByChatId(chatId) {
  return getCouriers().find(c => String(c.chatId) === String(chatId)) || null;
}

// сессии "добавить товар": { [courierId_orderId]: { [productId]: qty } }
const addItemSessions = {};
// ожидание ввода даты для статистики: { [adminChatId]: courierId }
const waitingCourierDate = {};

// ── Управление складом курьера ────────────────────────────────
function adjustCourierStock(courierId, items, delta) {
  // delta: -1 списать, +1 вернуть
  const db  = loadDB();
  const idx = (db.couriers || []).findIndex(c => String(c.chatId) === String(courierId));
  if (idx === -1) return null;
  if (!db.couriers[idx].stock) db.couriers[idx].stock = {};
  const changes = [];
  for (const item of items) {
    const pid    = String(item.id || item.name);
    const before = db.couriers[idx].stock[pid] || 0;
    const after  = before + delta * Number(item.qty || 1);
    db.couriers[idx].stock[pid] = after;
    changes.push({ name: item.name, qty: Number(item.qty || 1), before, after });
  }
  saveDB(db);
  return changes;
}

function getCourierStockLine(courierId) {
  const db      = loadDB();
  const courier = (db.couriers || []).find(c => String(c.chatId) === String(courierId));
  if (!courier || !courier.stock) return '';
  const products = db.products || [];
  const lines = Object.entries(courier.stock)
    .filter(([, qty]) => qty !== 0)
    .map(([pid, qty]) => {
      const p = products.find(p => String(p.id) === pid);
      const name = p ? p.name : pid;
      return `  • ${name}: <b>${qty}</b>`;
    });
  return lines.length ? '\n📦 Остаток на складе:\n' + lines.join('\n') : '';
}

function buildAddItemKeyboard(courierId, orderId, session, products) {
  const rows = products.map(p => {
    const qty = session[p.id] || 0;
    return [
      { text: `${p.name}`, callback_data: `ai:info:${orderId}` },
      { text: qty > 0 ? `−` : `·`, callback_data: qty > 0 ? `ai:rem:${orderId}:${courierId}:${p.id}` : `ai:noop` },
      { text: qty > 0 ? `${qty}` : `0`, callback_data: `ai:noop` },
      { text: `+`, callback_data: `ai:add:${orderId}:${courierId}:${p.id}` },
    ];
  });
  rows.push([
    { text: '✅ Подтвердить', callback_data: `ai:ok:${orderId}:${courierId}` },
    { text: '❌ Отмена',      callback_data: `ai:cancel:${orderId}:${courierId}` },
  ]);
  return { inline_keyboard: rows };
}

// ── Состояния ────────────────────────────────────────────────
const waiting = {};   // { [chatId]: 'broadcast' | 'ban' | 'unban' }
const orderPage = {}; // { [chatId]: pageIndex }
let shopPhotoFileId = null; // кешируем file_id после первой отправки

// ── Bot ──────────────────────────────────────────────────────
// Сначала сбрасываем webhook через API, потом стартуем polling
fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`)
  .then(r => r.json())
  .then(d => console.log('deleteWebhook:', d.ok ? 'ok' : d.description))
  .catch(err => console.error('deleteWebhook error:', err.message));

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
    [{ text: '📊 По курьерам' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const USER_KB = {
  keyboard: [
    [{ text: '🛒 Заказать' }],
    [{ text: '🏙 Города: Курьеры' }, { text: 'ℹ️ О нас' }],
    [{ text: '🆘 Поддержка' }],
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
bot.onText(/\/start/, async (msg) => {
  try {
    const { id, first_name } = msg.from;
    console.log(`/start from ${id} (${msg.from.username || 'no username'})`);
    if (isBanned(id)) return bot.sendMessage(id, '🚫 Вы заблокированы.');
    saveUser(msg.from);
    if (isAdmin(id)) return sendAdminMenu(id);

    await bot.sendMessage(id,
      `👋 Привет, <b>${first_name || 'друг'}</b>!\n\n` +
      `Добро пожаловать в <b>Midnight Nebula</b> — лучший вейп-магазин NRW 🇩🇪\n\n` +
      `Используйте кнопки ниже:\n` +
      `🛒 <b>Заказать</b> — открыть магазин и оформить заказ\n` +
      `🏙 <b>Города: Курьеры</b> — найти курьера в вашем городе\n` +
      `ℹ️ <b>О нас</b> — информация о магазине\n` +
      `🆘 <b>Поддержка</b> — связаться с менеджером\n\n` +
      `<i>Только оригинальная продукция · Доставка по всей Германии · 18+</i>`,
      { parse_mode: 'HTML', reply_markup: USER_KB }
    );
  } catch (err) {
    console.error('/start error:', err.message);
  }
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
    `🛠 <b>Панель администратора — MIDNIGHT NEBULA</b>\n\n` +
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

// ── /ping ─────────────────────────────────────────────────────
bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, '🏓 pong');
});

// ── Все сообщения ─────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId  = msg.chat.id;
  const msgText = (msg.text || '').trim();

  console.log(`MSG [${chatId}] ${msg.from?.username || 'no_user'}: "${msgText}"`);

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
          bot.sendMessage(target.id, '🚫 Вы заблокированы в Midnight Nebula.').catch(() => {});
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

    // Ввод даты для статистики курьера
    if (waitingCourierDate[chatId]) {
      const courierId = waitingCourierDate[chatId];
      delete waitingCourierDate[chatId];
      const match = msgText.match(/^(\d{1,2})\.(\d{2})$/);
      if (!match) return bot.sendMessage(chatId, '❌ Неверный формат. Введите дату как <b>ДД.ММ</b>, например <b>15.05</b>', { parse_mode: 'HTML', reply_markup: ADMIN_KB });
      const day   = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year  = new Date().getFullYear();
      const fromDate = new Date(year, month, day, 0, 0, 0, 0);
      if (isNaN(fromDate.getTime())) return bot.sendMessage(chatId, '❌ Неверная дата.', { reply_markup: ADMIN_KB });
      const fromTs = fromDate.getTime();
      return bot.sendMessage(chatId, '🔍 Ищу заказы...', { reply_markup: ADMIN_KB }).then(() =>
        bot.emit('callback_query', { id: '', from: { id: chatId }, message: { chat: { id: chatId } }, data: `cs:list:${courierId}:${fromTs}:0` })
      );
    }

    if (msgText === '📊 По курьерам') {
      const couriers = getCouriers();
      if (!couriers.length) return bot.sendMessage(chatId, '📊 Курьеры не добавлены.', { reply_markup: ADMIN_KB });
      const kb = {
        inline_keyboard: couriers.map(c => ([{
          text: `🚗 ${c.name || c.username || `id:${c.chatId}`}`,
          callback_data: `cs:courier:${c.chatId}`,
        }])),
      };
      return bot.sendMessage(chatId, '📊 <b>Выберите курьера:</b>', { parse_mode: 'HTML', reply_markup: kb });
    }

    return;
  }

  // ══ USER ══
  if (isBanned(chatId)) return bot.sendMessage(chatId, '🚫 Вы заблокированы.');

  if (msgText === '🛒 Заказать') {
    const caption =
      `🛍 <b>MIDNIGHT NEBULA</b>\n\n` +
      `Добро пожаловать в наш магазин!\n\n` +
      `• Жидкости и pod-системы\n` +
      `• Одноразовые устройства и картриджи\n` +
      `• Быстрая доставка по всей Германии\n\n` +
      `Нажмите кнопку ниже, чтобы перейти в магазин и оформить заказ 👇`;
    const shopKb = {
      inline_keyboard: [[{ text: '🛒 Перейти в магазин', url: WEBAPP_URL }]],
    };
    const photo = shopPhotoFileId || fs.createReadStream(path.join(__dirname, 'hero.png'));
    return bot.sendPhoto(chatId, photo, { caption, parse_mode: 'HTML', reply_markup: shopKb })
      .then(sent => { if (!shopPhotoFileId) shopPhotoFileId = sent.photo.at(-1).file_id; })
      .catch(() => bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: shopKb }));
  }

  if (msgText === '🛍 Мои заказы') {
    orderPage[chatId] = 0;
    const { text, kb } = buildOrdersPage(chatId, 0);
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: kb || USER_KB });
  }

  if (msgText === 'ℹ️ О нас') {
    return bot.sendMessage(chatId,
      `🛒 <b>MIDNIGHT NEBULA</b> — один из быстрорастущих магазинов в Германии с актуальным ассортиментом и надёжным сервисом.\n\n` +
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
      `@midnight_nebula_manager`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: 'https://t.me/midnight_nebula_manager' }]],
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
      `@midnight_nebula_manager`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: 'https://t.me/midnight_nebula_manager' }]],
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

  // ── Статистика по курьеру (админ) ────────────────────────────
  if (query.data.startsWith('cs:')) {
    if (!isAdmin(query.from.id)) return;
    const parts  = query.data.split(':');
    const action = parts[1];

    // cs:courier:COURIERID — выбрали курьера, просим ввести дату
    if (action === 'courier') {
      const courierId    = parts[2];
      const courier      = getCourierByChatId(courierId);
      const courierLabel = courier?.name || courier?.username || `id:${courierId}`;
      waitingCourierDate[query.message.chat.id] = courierId;
      return bot.editMessageText(
        `🚗 <b>${courierLabel}</b>\n\nВведите дату начала в формате <b>ДД.ММ</b>\n<i>Например: 15.05</i>\n\nПокажу все выполненные заказы с 00:00 этого дня по сегодня.`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' }
      ).catch(() => {});
    }

    // cs:list:COURIERID:FROMTS:PAGE — список заказов кнопками (FROMTS = timestamp начала)
    if (action === 'list') {
      const courierId    = parts[2];
      const fromTs       = Number(parts[3]);
      const page         = Number(parts[4] || 0);
      const PAGE_SIZE    = 8;
      const courier      = getCourierByChatId(courierId);
      const courierLabel = courier?.name || courier?.username || `id:${courierId}`;
      const db           = loadDB();
      const fromDate     = fromTs ? new Date(fromTs) : null;

      const allCompleted = Object.values(db.orders || {}).flat().filter(o => {
        if (o.status !== 'completed') return false;
        if (String(o.courierId) !== String(courierId)) return false;
        if (fromDate && new Date(o.completedAt || o.date) < fromDate) return false;
        return true;
      }).sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date));

      const totalSum = allCompleted.reduce((s, o) => s + parseFloat(o.total || 0), 0);
      const slice    = allCompleted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const dateLabel = fromDate
        ? `с ${fromDate.toLocaleDateString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' })}`
        : 'всё время';

      if (!allCompleted.length) {
        return bot.sendMessage(query.message.chat.id,
          `🚗 <b>${courierLabel}</b> · ${dateLabel}\n\nВыполненных заказов нет.`,
          { parse_mode: 'HTML', reply_markup: ADMIN_KB }
        );
      }

      const orderButtons = slice.map(o => {
        const t    = new Date(o.completedAt || o.date).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const nick = o.tgUsername ? `@${o.tgUsername.replace(/^@/, '')}` : '—';
        return [{ text: `📍${o.city || '—'} · ${nick} · ${o.total}€ · ${t}`, callback_data: `cs:order:${o.id}:${courierId}:${fromTs}:${page}` }];
      });

      const nav = [];
      if (page > 0)                                      nav.push({ text: '← Назад',   callback_data: `cs:list:${courierId}:${fromTs}:${page - 1}` });
      if ((page + 1) * PAGE_SIZE < allCompleted.length)  nav.push({ text: 'Вперёд →',  callback_data: `cs:list:${courierId}:${fromTs}:${page + 1}` });

      const kb = { inline_keyboard: [
        ...orderButtons,
        ...(nav.length ? [nav] : []),
      ]};

      return bot.sendMessage(query.message.chat.id,
        `🚗 <b>${courierLabel}</b> · ${dateLabel}\n📦 Заказов: <b>${allCompleted.length}</b> · 💎 <b>${totalSum.toFixed(2)} €</b>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }

    // cs:order:ORDERID:COURIERID:FROMTS:PAGE — детальный вид заказа
    if (action === 'order') {
      const orderId   = parts[2];
      const courierId = parts[3];
      const fromTs    = parts[4];
      const page      = parts[5] || 0;
      const found     = findOrderById(orderId);

      if (!found) return bot.answerCallbackQuery(query.id, { text: 'Заказ не найден' });
      const o = found.order;
      const itemsList = (o.items || []).map(i => `• ${i.name} × ${i.qty} — ${(Number(i.price) * Number(i.qty)).toFixed(2)} €`).join('\n');
      const completedTime = new Date(o.completedAt || o.date).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

      const text =
        `✅ <b>Выполнен</b> · ${completedTime}\n` +
        `👤 ${o.tgUsername || `id:${found.userId}`}\n` +
        `📍 ${o.city || '—'} · ${o.deliveryType === 'meeting' ? '🤝 Встреча' : '📬 Почта'}\n` +
        `💰 ${o.payment === 'card' ? '💳 Карта' : '💵 Наличные'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        itemsList + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 <b>${o.total} €</b>`;

      const kb = { inline_keyboard: [[{ text: '← К списку', callback_data: `cs:list:${courierId}:${fromTs}:${page}` }]] };
      return bot.editMessageText(text, {
        chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML', reply_markup: kb
      }).catch(() => {});
    }

    return;
  }

  // ── Добавить товар к заказу (курьер) ─────────────────────────
  if (query.data.startsWith('ai:')) {
    const parts = query.data.split(':');
    const action = parts[1];

    if (action === 'noop') return;
    if (action === 'info') return;

    const orderId   = parts[2];
    const ownerUser = parts[3]; // tgUserId клиента
    const sessionKey = `${query.from.id}_${orderId}`;

    const courier = getCourierByChatId(query.from.id);
    if (!courier) return bot.answerCallbackQuery(query.id, { text: '⛔ Не найден как курьер' });

    const db      = loadDB();
    const allProds = db.products || [];
    const stockIds = courier.productIds && courier.productIds.length ? courier.productIds : allProds.map(p => p.id);
    const stock    = allProds.filter(p => stockIds.includes(p.id) && p.inStock !== false);

    if (action === 'open') {
      addItemSessions[sessionKey] = {};
      const kb = buildAddItemKeyboard(query.from.id, orderId, {}, stock);
      return bot.sendMessage(query.message.chat.id,
        `➕ <b>Добавить товар к заказу</b>\n\nВыберите товары из вашего склада:`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }

    if (action === 'add' || action === 'rem') {
      const productId = parts[4];
      if (!addItemSessions[sessionKey]) addItemSessions[sessionKey] = {};
      const sess = addItemSessions[sessionKey];
      if (action === 'add') {
        sess[productId] = (sess[productId] || 0) + 1;
      } else {
        sess[productId] = Math.max(0, (sess[productId] || 0) - 1);
        if (sess[productId] === 0) delete sess[productId];
      }
      const kb = buildAddItemKeyboard(query.from.id, orderId, sess, stock);
      return bot.editMessageReplyMarkup(kb, {
        chat_id:    query.message.chat.id,
        message_id: query.message.message_id,
      }).catch(() => {});
    }

    if (action === 'cancel') {
      delete addItemSessions[sessionKey];
      return bot.editMessageText('❌ Отменено.', {
        chat_id:    query.message.chat.id,
        message_id: query.message.message_id,
      }).catch(() => {});
    }

    if (action === 'ok') {
      const sess = addItemSessions[sessionKey] || {};
      if (!Object.keys(sess).length) {
        return bot.answerCallbackQuery(query.id, { text: 'Ничего не выбрано' });
      }

      const found = findOrderById(orderId);
      if (!found) {
        return bot.answerCallbackQuery(query.id, { text: '⚠️ Заказ не найден' });
      }

      // Добавляем товары к заказу
      const addedItems = [];
      for (const [productId, qty] of Object.entries(sess)) {
        if (qty <= 0) continue;
        const prod = allProds.find(p => String(p.id) === String(productId));
        if (!prod) continue;
        const existing = found.order.items.find(i => String(i.id) === String(productId));
        if (existing) {
          existing.qty += qty;
        } else {
          found.order.items.push({ id: prod.id, name: prod.name, price: prod.price, qty });
        }
        addedItems.push(`• ${prod.name} × ${qty}`);
      }

      // Пересчитываем итог
      found.order.total = found.order.items
        .reduce((s, i) => s + Number(i.price) * Number(i.qty), 0)
        .toFixed(2);

      // Сохраняем
      const dbWrite = loadDB();
      const idx = dbWrite.orders[found.userId].findIndex(o => String(o.id) === String(orderId));
      if (idx !== -1) {
        dbWrite.orders[found.userId][idx] = found.order;
        saveDB(dbWrite);
      }

      delete addItemSessions[sessionKey];

      // Списываем добавленные товары со склада курьера
      const addedForStock = Object.entries(sess).map(([productId, qty]) => {
        const prod = allProds.find(p => String(p.id) === String(productId));
        return prod ? { id: productId, name: prod.name, qty } : null;
      }).filter(Boolean);
      const stockChanges = adjustCourierStock(query.from.id, addedForStock, -1);
      const stockLine    = getCourierStockLine(query.from.id);

      const logText =
        `📝 <b>Курьер добавил товары к заказу</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Клиент: ${found.order.tgUsername || `id:${found.userId}`}\n` +
        `🚗 Курьер: ${courier.name || query.from.first_name}\n` +
        `📍 Город: ${found.order.city || '—'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        addedItems.join('\n') + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 <b>Новый итог: ${found.order.total} €</b>` +
        stockLine;

      bot.sendMessage(ADMIN_ID, logText, { parse_mode: 'HTML' }).catch(() => {});

      return bot.editMessageText(
        `✅ <b>Товары добавлены!</b>\n\n${addedItems.join('\n')}\n\n💎 Новый итог: <b>${found.order.total} €</b>`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' }
      ).catch(() => {});
    }

    return;
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
  const { tgUserId, courierId, courierName, courierUsername, orderText, ...order } = req.body;

  const orderId = tgUserId ? saveOrder(tgUserId, { ...order, courierId: courierId || null, courierName: courierName || null }) : null;

  const deliveryLabel = order.deliveryType === 'meeting' ? '🤝 Личная встреча' : '📬 Почта';
  const paymentLabel  = order.payment === 'card' ? '💳 Карта' : '💵 Наличные';
  const itemsList = (order.items || [])
    .map(i => `• ${i.name} × ${i.qty} — ${(Number(i.price) * Number(i.qty)).toFixed(2)} €`)
    .join('\n');

  // Списываем товары со склада курьера
  if (courierId && order.items?.length) {
    const stockChanges = adjustCourierStock(courierId, order.items, -1);
    if (stockChanges) {
      const stockLine = getCourierStockLine(courierId);
      const courierName_ = courierName || `id:${courierId}`;
      // Предупреждение если что-то ушло в минус
      const negative = stockChanges.filter(c => c.after < 0);
      if (negative.length) {
        const warnText = `⚠️ <b>Склад курьера ${courierName_} ушёл в минус!</b>\n` +
          negative.map(c => `• ${c.name}: было ${c.before}, стало <b>${c.after}</b>`).join('\n');
        bot.sendMessage(ADMIN_ID, warnText, { parse_mode: 'HTML' }).catch(() => {});
      }
      if (LOG_CHANNEL_ID) {
        bot.sendMessage(LOG_CHANNEL_ID,
          `📦 <b>Списано со склада</b> · 🚗 ${courierName_}\n` +
          stockChanges.map(c => `• ${c.name} × ${c.qty} (было: ${c.before} → стало: ${c.after})`).join('\n') +
          stockLine,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
  }

  // Уведомляем курьера через бота
  if (courierId) {
    const stockLine  = getCourierStockLine(courierId);
    const courierText =
      `📦 <b>НОВЫЙ ЗАКАЗ — ${order.city || '—'}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${order.tgUsername || 'неизвестен'}${tgUserId ? ` (id: ${tgUserId})` : ''}\n` +
      `🚚 ${deliveryLabel}\n` +
      `💰 ${paymentLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${itemsList}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💎 <b>Итого: ${order.total} €</b>` +
      stockLine;

    const courierKb = orderId ? {
      inline_keyboard: [[{
        text: '➕ Добавить товар',
        callback_data: `ai:open:${orderId}:${tgUserId || 0}`,
      }]],
    } : undefined;

    bot.sendMessage(courierId, courierText, { parse_mode: 'HTML', reply_markup: courierKb })
      .catch(err => console.error(`Не удалось отправить курьеру ${courierId}:`, err.message));
  }

  // Отправляем пользователю подтверждение с кнопкой открыть чат с курьером
  if (tgUserId) {
    const recipient = courierUsername
      ? courierUsername.replace(/^@/, '')
      : 'midnight_nebula_manager';

    const msgText = order.deliveryType === 'meeting'
      ? `✅ <b>Заказ оформлен!</b>\n\n📍 ${order.city} · ${deliveryLabel}\n💰 ${paymentLabel}\n💎 <b>${order.total} €</b>\n\nНажмите кнопку ниже — откроется чат с курьером с готовым текстом заказа. Просто нажмите «Отправить».`
      : `✅ <b>Заказ оформлен!</b>\n\n📬 Почта · ${paymentLabel}\n💎 <b>${order.total} €</b>\n\nМенеджер свяжется с вами в ближайшее время.`;

    const text = orderText || (
      `📦 ЗАКАЗ MIDNIGHT NEBULA\n` +
      `Доставка: ${deliveryLabel}\n` +
      `Город: ${order.city || '—'}\n` +
      `Оплата: ${paymentLabel}\n` +
      `───────────────\n` +
      itemsList + `\n───────────────\n` +
      `Итого: ${order.total} €`
    );

    const inlineKb = order.deliveryType === 'meeting' ? {
      inline_keyboard: [[{
        text: '✉️ Написать курьеру',
        url: `https://t.me/${recipient}?text=${encodeURIComponent(text)}`,
      }]],
    } : undefined;

    bot.sendMessage(tgUserId, msgText, { parse_mode: 'HTML', reply_markup: inlineKb })
      .catch(err => console.error(`Не удалось отправить пользователю ${tgUserId}:`, err.message));
  }

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
    `🛒 <b>НОВЫЙ ЗАКАЗ — MIDNIGHT NEBULA</b>\n` +
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
  let foundOrder = null;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      db.orders[userId][idx].status = status;
      if (status === 'completed') db.orders[userId][idx].completedAt = new Date().toISOString();
      foundOrder = db.orders[userId][idx];
      break;
    }
  }
  if (!foundOrder) return res.status(404).json({ error: 'Order not found' });
  saveDB(db);

  // Возвращаем товары на склад курьера при отмене
  if (status === 'cancelled' && foundOrder.courierId && foundOrder.items?.length) {
    const stockChanges = adjustCourierStock(foundOrder.courierId, foundOrder.items, +1);
    if (stockChanges && LOG_CHANNEL_ID) {
      const stockLine = getCourierStockLine(foundOrder.courierId);
      bot.sendMessage(LOG_CHANNEL_ID,
        `↩️ <b>Возврат на склад (отмена)</b> · 🚗 ${foundOrder.courierName || `id:${foundOrder.courierId}`}\n` +
        stockChanges.map(c => `• ${c.name} × ${c.qty} (было: ${c.before} → стало: ${c.after})`).join('\n') +
        stockLine,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  }

  // Отправляем в канал логов при смене статуса
  if (LOG_CHANNEL_ID && foundOrder && ['completed', 'cancelled'].includes(status)) {
    const o = foundOrder;
    const courierLabel = o.courierName ? `🚗 <b>${o.courierName}</b>` : `🚗 Курьер неизвестен`;
    const itemsList = (o.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n');
    const timeNow = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const statusLine = status === 'completed' ? `✅ <b>Выполнен</b>` : `❌ <b>Отменён</b>`;
    const logText =
      `${courierLabel}\n` +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      `${statusLine} · ${timeNow}\n` +
      `👤 ${o.tgUsername || `id:${o.tgUserId || '—'}`}\n` +
      `📍 ${o.city || '—'}\n` +
      `💰 ${o.payment === 'card' ? '💳 Карта' : '💵 Наличные'}\n` +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      itemsList + '\n' +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      `💎 <b>${o.total} €</b>`;
    bot.sendMessage(LOG_CHANNEL_ID, logText, { parse_mode: 'HTML' }).catch(() => {});
  }

  res.json({ ok: true });
});

// Сменить курьера у заказа
app.patch('/api/admin/orders/:orderId/courier', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { orderId } = req.params;
  const { courierId, courierName, courierUsername } = req.body;
  const db = loadDB();
  let found = false;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      db.orders[userId][idx].courierId      = courierId      || null;
      db.orders[userId][idx].courierName    = courierName    || null;
      db.orders[userId][idx].courierUsername = courierUsername || null;
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
  let deletedOrder = null;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      deletedOrder = db.orders[userId][idx];
      db.orders[userId].splice(idx, 1);
      break;
    }
  }
  if (!deletedOrder) return res.status(404).json({ error: 'Order not found' });
  saveDB(db);

  // Возвращаем товары на склад курьера при удалении
  if (deletedOrder.courierId && deletedOrder.items?.length) {
    const stockChanges = adjustCourierStock(deletedOrder.courierId, deletedOrder.items, +1);
    if (stockChanges && LOG_CHANNEL_ID) {
      const stockLine = getCourierStockLine(deletedOrder.courierId);
      bot.sendMessage(LOG_CHANNEL_ID,
        `↩️ <b>Возврат на склад (удаление)</b> · 🚗 ${deletedOrder.courierName || `id:${deletedOrder.courierId}`}\n` +
        stockChanges.map(c => `• ${c.name} × ${c.qty} (было: ${c.before} → стало: ${c.after})`).join('\n') +
        stockLine,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  }

  if (LOG_CHANNEL_ID && deletedOrder) {
    const o = deletedOrder;
    const courierLabel = o.courierName ? `🚗 <b>${o.courierName}</b>` : `🚗 Курьер неизвестен`;
    const itemsList = (o.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n');
    const timeNow = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    bot.sendMessage(LOG_CHANNEL_ID,
      `${courierLabel}\n` +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      `🗑 <b>Удалён</b> · ${timeNow}\n` +
      `👤 ${o.tgUsername || `id:${o.tgUserId || '—'}`}\n` +
      `📍 ${o.city || '—'}\n` +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      itemsList + '\n' +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      `💎 <b>${o.total} €</b>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

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
  console.log(`✅ Midnight Nebula bot запущен | порт ${PORT}`);
});
