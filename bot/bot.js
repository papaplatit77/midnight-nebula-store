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
const WEBAPP_URL     = process.env.WEBAPP_URL || 'https://wakashop-snowy.vercel.app';
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
    [{ text: '📊 По курьерам' }],
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

    if (msgText === '📊 По курьерам') {
      const couriers = getCouriers();
      if (!couriers.length) return bot.sendMessage(chatId, '📊 Курьеры не добавлены.', { reply_markup: ADMIN_KB });
      const kb = {
        inline_keyboard: couriers.map(c => ([{
          text: `🚗 ${c.name || c.username || `id:${c.chatId}`}`,
          callback_data: `courier_stats_${c.chatId}`,
        }])),
      };
      return bot.sendMessage(chatId, '📊 <b>Выберите курьера:</b>', { parse_mode: 'HTML', reply_markup: kb });
    }

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

  // ── Статистика по курьеру (админ) ────────────────────────────
  if (query.data.startsWith('courier_stats_')) {
    if (!isAdmin(query.from.id)) return;
    const courierId = query.data.replace('courier_stats_', '');
    const courier   = getCourierByChatId(courierId);
    const db        = loadDB();

    // Собираем все выполненные заказы этого курьера
    const allOrders = Object.values(db.orders || {}).flat();
    const completed = allOrders.filter(o =>
      o.status === 'completed' && String(o.courierId) === String(courierId)
    );

    const courierLabel = courier?.name || courier?.username || `id:${courierId}`;

    if (!completed.length) {
      return bot.sendMessage(query.message.chat.id,
        `🚗 <b>${courierLabel}</b>\n\nВыполненных заказов нет.`,
        { parse_mode: 'HTML', reply_markup: ADMIN_KB }
      );
    }

    const totalSum = completed.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const PAGE = 10;
    const slice = completed.slice(0, PAGE);

    const lines = slice.map((o, i) => {
      const date = new Date(o.date).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const items = (o.items || []).map(it => `  • ${it.name} ×${it.qty}`).join('\n');
      return `<b>#${i + 1}</b> · ${date}\n👤 ${o.tgUsername || '—'} · 📍 ${o.city || '—'}\n${items}\n💎 <b>${o.total} €</b>`;
    });

    const header = `🚗 <b>${courierLabel}</b> — выполнено заказов: <b>${completed.length}</b>\n💰 Сумма: <b>${totalSum.toFixed(2)} €</b>\n${'━'.repeat(21)}\n\n`;
    const text   = header + lines.join('\n\n─────────\n\n');

    // Если больше PAGE заказов — добавляем кнопку "ещё"
    const kb = completed.length > PAGE ? {
      inline_keyboard: [[{
        text: `Ещё (${completed.length - PAGE}) →`,
        callback_data: `courier_stats_more_${courierId}_${PAGE}`,
      }]],
    } : undefined;

    return bot.sendMessage(query.message.chat.id, text, { parse_mode: 'HTML', reply_markup: kb });
  }

  if (query.data.startsWith('courier_stats_more_')) {
    if (!isAdmin(query.from.id)) return;
    const parts     = query.data.split('_');
    const courierId = parts[3];
    const offset    = Number(parts[4]);
    const courier   = getCourierByChatId(courierId);
    const db        = loadDB();
    const PAGE      = 10;

    const completed = Object.values(db.orders || {}).flat().filter(o =>
      o.status === 'completed' && String(o.courierId) === String(courierId)
    );
    const slice = completed.slice(offset, offset + PAGE);
    const courierLabel = courier?.name || courier?.username || `id:${courierId}`;

    const lines = slice.map((o, i) => {
      const date = new Date(o.date).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const items = (o.items || []).map(it => `  • ${it.name} ×${it.qty}`).join('\n');
      return `<b>#${offset + i + 1}</b> · ${date}\n👤 ${o.tgUsername || '—'} · 📍 ${o.city || '—'}\n${items}\n💎 <b>${o.total} €</b>`;
    });

    const kb = completed.length > offset + PAGE ? {
      inline_keyboard: [[{
        text: `Ещё (${completed.length - offset - PAGE}) →`,
        callback_data: `courier_stats_more_${courierId}_${offset + PAGE}`,
      }]],
    } : undefined;

    return bot.sendMessage(query.message.chat.id,
      `🚗 <b>${courierLabel}</b> · стр. ${Math.floor(offset / PAGE) + 2}\n${'━'.repeat(21)}\n\n` + lines.join('\n\n─────────\n\n'),
      { parse_mode: 'HTML', reply_markup: kb }
    );
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

      const logText =
        `📝 <b>Курьер добавил товары к заказу</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Клиент: ${found.order.tgUsername || `id:${found.userId}`}\n` +
        `🚗 Курьер: ${courier.name || query.from.first_name}\n` +
        `📍 Город: ${found.order.city || '—'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        addedItems.join('\n') + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💎 <b>Новый итог: ${found.order.total} €</b>`;

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

  // Уведомляем курьера через бота
  if (courierId) {
    const courierText =
      `📦 <b>НОВЫЙ ЗАКАЗ — ${order.city || '—'}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${order.tgUsername || 'неизвестен'}${tgUserId ? ` (id: ${tgUserId})` : ''}\n` +
      `🚚 ${deliveryLabel}\n` +
      `💰 ${paymentLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${itemsList}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💎 <b>Итого: ${order.total} €</b>`;

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
      : 'Manager_NRW_1';

    const msgText = order.deliveryType === 'meeting'
      ? `✅ <b>Заказ оформлен!</b>\n\n📍 ${order.city} · ${deliveryLabel}\n💰 ${paymentLabel}\n💎 <b>${order.total} €</b>\n\nНажмите кнопку ниже — откроется чат с курьером с готовым текстом заказа. Просто нажмите «Отправить».`
      : `✅ <b>Заказ оформлен!</b>\n\n📬 Почта · ${paymentLabel}\n💎 <b>${order.total} €</b>\n\nМенеджер свяжется с вами в ближайшее время.`;

    const text = orderText || (
      `📦 ЗАКАЗ WAKASHOP\n` +
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
  let foundOrder = null;
  for (const userId of Object.keys(db.orders || {})) {
    const idx = db.orders[userId].findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      db.orders[userId][idx].status = status;
      foundOrder = db.orders[userId][idx];
      break;
    }
  }
  if (!foundOrder) return res.status(404).json({ error: 'Order not found' });
  saveDB(db);

  // Отправляем в канал логов если заказ выполнен
  if (LOG_CHANNEL_ID && status === 'completed' && foundOrder) {
    const o = foundOrder;
    const courierLabel = o.courierName ? `🚗 <b>${o.courierName}</b>` : `🚗 Курьер неизвестен`;
    const itemsList = (o.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n');
    const logText =
      `${courierLabel}\n` +
      `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n` +
      `✅ <b>Выполнен</b> · ${new Date(o.date).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\n` +
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
