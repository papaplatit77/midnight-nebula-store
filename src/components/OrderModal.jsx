import { useState, useMemo, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAdmin } from '../admin/context/AdminContext';

import { categories } from '../data/products';
import { useTelegram } from '../hooks/useTelegram';
import styles from './OrderModal.module.css';

const ORDER_API = '/api/order';

const CITIES = [
  'Köln','Düsseldorf','Dortmund','Essen','Duisburg','Bochum','Wuppertal',
  'Bielefeld','Bonn','Münster','Mönchengladbach','Gelsenkirchen','Krefeld',
  'Aachen','Oberhausen','Hagen','Hamm','Solingen','Leverkusen','Neuss',
  'Paderborn','Mülheim an der Ruhr','Remscheid','Siegen','Moers','Witten',
  'Bergisch Gladbach','Recklinghausen','Bottrop','Iserlohn',
  'Berlin','Hamburg','München','Frankfurt am Main','Stuttgart',
  'Leipzig','Bremen','Hannover','Nürnberg','Dresden',
];

const CAT_EMOJI = { disposable:'💨', pods:'🔌', liquids:'💧', accessories:'⚙️', snus:'🍃' };

export default function OrderModal({ onClose }) {
  const { add, items, total, count, clear } = useCart();
  const { products } = useAdmin();
  const { username, userId, isReady } = useTelegram();
  const [couriersList, setCouriersList] = useState([]);

  const [step, setStep] = useState(1);
  const [deliveryType, setDeliveryType] = useState('');
  const [mailOption, setMailOption] = useState(''); // 'track' | 'notrack'
  const [city, setCity] = useState('');
  const [payment, setPayment] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tgHandle, setTgHandle] = useState(username ? username.replace('@', '') : '');
  const [street, setStreet] = useState('');
  const [plz, setPlz] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [addedMap, setAddedMap] = useState({});
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    fetch('/api/couriers').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCouriersList(data);
    }).catch(() => {});
    return () => { document.body.style.overflow = ''; };
  }, []);

  const courierForCity = city ? (couriersList.find(c => c.cities && c.cities.includes(city)) || null) : null;

  // Города с назначенными курьерами (для встречи)
  const citiesWithCouriers = useMemo(() => {
    const assigned = new Set(couriersList.flatMap(c => c.cities || []));
    return CITIES.filter(c => assigned.has(c));
  }, [couriersList]);

  const MAIL_COSTS = { track: 6.20, notrack: 4.19 };
  const shippingCost = deliveryType === 'mail' && mailOption ? MAIL_COSTS[mailOption] : 0;
  const grandTotal = total + shippingCost;

  const latinOnly = /^[a-zA-Z\s\-]+$/;
  const validTgHandle = /^[a-zA-Z0-9_]{5,32}$/;

  const validateMailFields = () => {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'Обязательное поле';
    else if (!latinOnly.test(firstName.trim())) errs.firstName = 'Только латиница';
    if (!lastName.trim()) errs.lastName = 'Обязательное поле';
    else if (!latinOnly.test(lastName.trim())) errs.lastName = 'Только латиница';
    if (!tgHandle.trim()) errs.tgHandle = 'Укажите Telegram username';
    else if (!validTgHandle.test(tgHandle.trim())) errs.tgHandle = 'Только латиница, цифры и _ · минимум 5 символов';
    if (!street.trim()) errs.street = 'Укажите улицу и дом';
    if (!plz.trim()) errs.plz = 'Укажите PLZ';
    else if (!/^\d{5}$/.test(plz.trim())) errs.plz = '5 цифр, например 50667';
    if (!deliveryCity.trim()) errs.deliveryCity = 'Укажите город';
    return errs;
  };

  const mailFieldsFilled = firstName.trim() && lastName.trim() && tgHandle.trim()
    && street.trim() && plz.trim() && deliveryCity.trim();
  const canNext = deliveryType && payment
    && (deliveryType === 'meeting'
      ? (city && (!isReady ? tgHandle.trim() : true))
      : mailOption && mailFieldsFilled);

  const handleDeliveryType = (type) => {
    setDeliveryType(type);
    if (type === 'mail') {
      setPayment('card');
      setMailOption('');
    } else {
      setPayment('');
      setMailOption('');
    }
  };

  const filtered = useMemo(() => {
    return products.filter(p => {
      // Фильтр по типу доставки
      if (deliveryType === 'mail') {
        // Только товары, доступные для почты (shippable)
        if (p.shippable === false) return false;
      } else if (deliveryType === 'meeting' && courierForCity) {
        // Только товары из склада курьера
        if (courierForCity.productIds && courierForCity.productIds.length > 0) {
          if (!courierForCity.productIds.includes(p.id)) return false;
        }
      }
      if (activeCat !== 'all' && p.category !== activeCat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCat, search, deliveryType, courierForCity]);

  const handleAdd = (product) => {
    add(product, 1);
    setAddedMap(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => setAddedMap(prev => ({ ...prev, [product.id]: false })), 1200);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const buildOrderText = () => {
    const deliveryLabel = deliveryType === 'meeting' ? 'Личная встреча' : 'Почта (DHL)';
    const paymentLabel = payment === 'card' ? 'Карта' : 'Наличные';
    const orderCity = deliveryType === 'mail' ? deliveryCity.trim() : city;
    const tg = tgHandle.trim() || (username ? username.replace('@', '') : '');
    const itemsText = items.map(i => `• ${i.name} ×${i.qty} — ${(i.price * i.qty).toFixed(2)} €`).join('\n');
    const mailBlock = deliveryType === 'mail'
      ? `\nПолучатель: ${firstName.trim()} ${lastName.trim()}\nАдрес: ${street.trim()}, ${plz.trim()} ${deliveryCity.trim()}`
      : '';
    return (
      `📦 ЗАКАЗ WAKASHOP\n` +
      `TG: @${tg}\n` +
      `Доставка: ${deliveryLabel}\n` +
      `Город: ${orderCity}\n` +
      `Оплата: ${paymentLabel}` +
      mailBlock + '\n' +
      `───────────────\n` +
      itemsText + '\n' +
      `───────────────\n` +
      `Итого: ${grandTotal.toFixed(2)} €`
    );
  };

  const handleSendOrder = async () => {
    if (items.length === 0) return;

    const text = buildOrderText();

    if (window.Telegram?.WebApp?.openTelegramLink) {
      // В мини-аппе ?text= не поддерживается — копируем в буфер и открываем чат
      try { await navigator.clipboard.writeText(text); } catch {}
      window.Telegram.WebApp.openTelegramLink('https://t.me/Manager_NRW_1');
    } else {
      // В браузере ?text= работает — текст вставится сам
      window.open(`https://t.me/Manager_NRW_1?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }

    setSent(true);
    clear();
  };

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropVisible : ''}`}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className={`${styles.sheet} ${visible ? styles.sheetVisible : ''} ${step === 2 ? styles.sheetFull : styles.sheetHalf}`}>

        <div className={styles.handle}><span /></div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <div className={styles.step1}>
            <div className={styles.stepHeader}>
              <p className={styles.stepLabel}>WAKASHOP</p>
              <h2 className={styles.stepTitle}>Оформить заказ</h2>
              <p className={styles.stepSub}>Выберите способ получения и оплаты</p>
            </div>

            {/* TG username */}
            {username && (
              <div className={styles.tgUser}>
                <span className={styles.tgIcon}>✈️</span>
                <span className={styles.tgName}>Telegram: <strong>{username}</strong></span>
              </div>
            )}

            {/* Способ доставки */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Способ получения</label>
              <div className={styles.optionRow}>
                <button
                  className={`${styles.optionBtn} ${deliveryType === 'meeting' ? styles.optionActive : ''}`}
                  onClick={() => handleDeliveryType('meeting')}
                >
                  <span className={styles.optionIcon}>🤝</span>
                  <span className={styles.optionText}>
                    <strong>Личная встреча</strong>
                    <small>Быстро и удобно</small>
                  </span>
                </button>
                <button
                  className={`${styles.optionBtn} ${deliveryType === 'mail' ? styles.optionActive : ''}`}
                  onClick={() => handleDeliveryType('mail')}
                >
                  <span className={styles.optionIcon}>📬</span>
                  <span className={styles.optionText}>
                    <strong>Почта</strong>
                    <small>DHL · только карта</small>
                  </span>
                </button>
              </div>
            </div>

            {/* TG username — браузер, всегда видно */}
            {!isReady && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Telegram username</label>
                <input
                  className={`${styles.textInput} ${fieldErrors.tgHandle ? styles.inputError : ''}`}
                  type="text"
                  placeholder="@username"
                  value={tgHandle}
                  onChange={e => { setTgHandle(e.target.value.replace(/^@+/, '')); setFieldErrors(p => ({...p, tgHandle: ''})); }}
                />
                {fieldErrors.tgHandle && <span className={styles.fieldErr}>{fieldErrors.tgHandle}</span>}
              </div>
            )}

            {/* Варианты почты — только если выбрана почта */}
            {deliveryType === 'mail' && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Тип доставки</label>
                <div className={styles.optionRow}>
                  <button
                    className={`${styles.optionBtn} ${mailOption === 'track' ? styles.optionActive : ''}`}
                    onClick={() => setMailOption('track')}
                  >
                    <span className={styles.optionIcon}>📦</span>
                    <span className={styles.optionText}>
                      <strong>С трек-номером</strong>
                      <small>DHL · 6,20 €</small>
                    </span>
                  </button>
                  <button
                    className={`${styles.optionBtn} ${mailOption === 'notrack' ? styles.optionActive : ''}`}
                    onClick={() => setMailOption('notrack')}
                  >
                    <span className={styles.optionIcon}>✉️</span>
                    <span className={styles.optionText}>
                      <strong>Без трек-номера</strong>
                      <small>DHL · 4,19 €</small>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Данные получателя — только для почты */}
            {deliveryType === 'mail' && (
              <>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Имя (латиница)</label>
                    <input
                      className={`${styles.textInput} ${fieldErrors.firstName ? styles.inputError : ''}`}
                      type="text"
                      placeholder="Ivan"
                      value={firstName}
                      onChange={e => { setFirstName(e.target.value); setFieldErrors(p => ({...p, firstName: ''})); }}
                    />
                    {fieldErrors.firstName && <span className={styles.fieldErr}>{fieldErrors.firstName}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Фамилия (латиница)</label>
                    <input
                      className={`${styles.textInput} ${fieldErrors.lastName ? styles.inputError : ''}`}
                      type="text"
                      placeholder="Müller"
                      value={lastName}
                      onChange={e => { setLastName(e.target.value); setFieldErrors(p => ({...p, lastName: ''})); }}
                    />
                    {fieldErrors.lastName && <span className={styles.fieldErr}>{fieldErrors.lastName}</span>}
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Улица и номер дома</label>
                  <input
                    className={`${styles.textInput} ${fieldErrors.street ? styles.inputError : ''}`}
                    type="text"
                    placeholder="Musterstraße 12"
                    value={street}
                    onChange={e => { setStreet(e.target.value); setFieldErrors(p => ({...p, street: ''})); }}
                  />
                  {fieldErrors.street && <span className={styles.fieldErr}>{fieldErrors.street}</span>}
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>PLZ (индекс)</label>
                    <input
                      className={`${styles.textInput} ${fieldErrors.plz ? styles.inputError : ''}`}
                      type="text"
                      placeholder="50667"
                      value={plz}
                      onChange={e => { setPlz(e.target.value); setFieldErrors(p => ({...p, plz: ''})); }}
                    />
                    {fieldErrors.plz && <span className={styles.fieldErr}>{fieldErrors.plz}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Город</label>
                    <input
                      className={`${styles.textInput} ${fieldErrors.deliveryCity ? styles.inputError : ''}`}
                      type="text"
                      placeholder="Köln"
                      value={deliveryCity}
                      onChange={e => { setDeliveryCity(e.target.value); setFieldErrors(p => ({...p, deliveryCity: ''})); }}
                    />
                    {fieldErrors.deliveryCity && <span className={styles.fieldErr}>{fieldErrors.deliveryCity}</span>}
                  </div>
                </div>
              </>
            )}

            {/* Город — только для личной встречи (только города с курьерами) */}
            {deliveryType !== 'mail' && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Город</label>
                {citiesWithCouriers.length === 0 ? (
                  <p className={styles.noCitiesNote}>Нет доступных городов. Добавьте курьеров в админ-панели.</p>
                ) : (
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      value={city}
                      onChange={e => { setCity(e.target.value); }}
                    >
                      <option value="">Выберите город...</option>
                      {citiesWithCouriers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className={styles.selectArrow}>▾</span>
                  </div>
                )}
                {courierForCity && (
                  <div className={styles.courierHint}>
                    🚗 Ваш курьер: <strong>{courierForCity.name}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Оплата */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Способ оплаты</label>
              {deliveryType === 'mail' ? (
                <div className={`${styles.optionBtn} ${styles.optionActive} ${styles.optionLocked}`}>
                  <span className={styles.optionIcon}>💳</span>
                  <span className={styles.optionText}>
                    <strong>Банковская карта</strong>
                    <small>Единственный вариант для почты</small>
                  </span>
                </div>
              ) : (
                <div className={styles.optionRow}>
                  <button
                    className={`${styles.optionBtn} ${payment === 'card' ? styles.optionActive : ''}`}
                    onClick={() => setPayment('card')}
                  >
                    <span className={styles.optionIcon}>💳</span>
                    <span className={styles.optionText}>
                      <strong>Банковская карта</strong>
                      <small>Безналичный расчёт</small>
                    </span>
                  </button>
                  <button
                    className={`${styles.optionBtn} ${payment === 'cash' ? styles.optionActive : ''}`}
                    onClick={() => setPayment('cash')}
                  >
                    <span className={styles.optionIcon}>💵</span>
                    <span className={styles.optionText}>
                      <strong>Наличные</strong>
                      <small>При получении</small>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              className={`${styles.nextBtn} ${canNext ? styles.nextBtnActive : ''}`}
              disabled={!canNext}
              onClick={() => {
                const errs = deliveryType === 'mail' ? validateMailFields() : {};
                if (deliveryType === 'meeting' && !isReady) {
                  if (!tgHandle.trim()) errs.tgHandle = 'Укажите Telegram username';
                  else if (!validTgHandle.test(tgHandle.trim())) errs.tgHandle = 'Только латиница, цифры и _ · минимум 5 символов';
                }
                if (Object.keys(errs).length) { setFieldErrors(errs); return; }
                setFieldErrors({});
                setStep(2);
              }}
            >
              {canNext ? 'ДАЛЬШЕ — ВЫБРАТЬ ТОВАРЫ →' : 'Заполните все поля'}
            </button>
          </div>
        )}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (
          <div className={styles.step2}>
            <div className={styles.step2Header}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>← Назад</button>
              <div className={styles.step2Info}>
                <span className={styles.step2Tag}>
                  {deliveryType === 'meeting' ? '🤝 Встреча' : mailOption === 'track' ? '📦 Почта+трек' : '✉️ Почта'}
                </span>
                <span className={styles.step2Tag}>📍 {deliveryType === 'mail' ? deliveryCity : city}</span>
                <span className={styles.step2Tag}>{payment === 'card' ? '💳 Карта' : '💵 Нал'}</span>
              </div>
            </div>

            {/* Поиск */}
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Поиск по названию..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
            </div>

            {/* Категории */}
            <div className={styles.filterSection}>
              <p className={styles.filterLabel}>Категория</p>
              <div className={styles.filterRow}>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`${styles.filterChip} ${activeCat === cat.id ? styles.filterChipActive : ''}`}
                    onClick={() => setActiveCat(cat.id)}
                  >
                    {cat.id !== 'all' && <span>{CAT_EMOJI[cat.id]}</span>}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Сетка товаров */}
            <div className={styles.productsGrid}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  <span>😔</span>
                  <p>Ничего не найдено</p>
                </div>
              ) : filtered.map(p => {
                const inCart = items.find(i => i.id === p.id);
                const justAdded = addedMap[p.id];
                return (
                  <div
                    key={p.id}
                    className={`${styles.productCard} ${inCart ? styles.productCardInCart : ''} ${!p.inStock ? styles.productCardOut : ''}`}
                    onClick={() => p.inStock && handleAdd(p)}
                  >
                    <div className={styles.productImg}>
                      {p.image ? (
                        <img src={p.image} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : (
                        <span>{CAT_EMOJI[p.category] || '📦'}</span>
                      )}
                      {!p.inStock && <div className={styles.stockOverlay}>Нет</div>}
                      {inCart && (
                        <div className={styles.cartBadge}>× {inCart.qty}</div>
                      )}
                    </div>
                    <div className={styles.productBody}>
                      <p className={styles.productName}>{p.name}</p>
                      <div className={styles.productMeta}>
                        {p.puffs && <span>{p.puffs} затяжек</span>}
                        {p.nicotine != null && <span>{p.nicotine}мг</span>}
                      </div>
                      <div className={styles.productFooter}>
                        <div className={styles.productPrices}>
                          <span className={styles.productPrice}>{p.price.toFixed(2)} €</span>
                          {p.oldPrice && <span className={styles.productOld}>{p.oldPrice.toFixed(2)} €</span>}
                        </div>
                        <div className={`${styles.addIcon} ${justAdded ? styles.addIconDone : ''} ${inCart ? styles.addIconActive : ''}`}>
                          {justAdded ? '✓' : inCart ? `+${inCart.qty}` : '+'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Итог — всегда виден */}
            <div className={styles.step2Footer}>
              {count > 0 ? (
                <>
                  <p className={styles.step2FooterText}>
                  🛒 {count} шт. · <strong>{grandTotal.toFixed(2)} €</strong>
                  {shippingCost > 0 && <small style={{ opacity: 0.6, marginLeft: 4 }}>вкл. доставку</small>}
                </p>
                  <button className={`${styles.orderBtn}`} onClick={() => setStep(3)}>
                    ОФОРМИТЬ →
                  </button>
                </>
              ) : (
                <p className={styles.step2FooterHint}>Нажмите на товар чтобы добавить</p>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Подтверждение ══ */}
        {step === 3 && (
          <div className={styles.step1}>
            {sent ? (
              <div className={styles.successBlock}>
                <div className={styles.successIcon}>✅</div>
                <h2 className={styles.successTitle}>Заказ отправлен!</h2>
                <p className={styles.successSub}>
                  {window.Telegram?.WebApp?.openTelegramLink
                    ? 'Текст заказа скопирован — вставьте его в открывшийся чат и отправьте.'
                    : 'Нажмите отправить в открывшемся чате.'}
                </p>
                <button className={`${styles.nextBtn} ${styles.nextBtnActive}`} onClick={handleClose}>
                  Закрыть
                </button>
              </div>
            ) : (
              <>
                <div className={styles.stepHeader}>
                  <p className={styles.stepLabel}>WAKASHOP</p>
                  <h2 className={styles.stepTitle}>Ваш заказ</h2>
                </div>

                {/* Инфо */}
                <div className={styles.confirmInfo}>
                  {username && (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmKey}>Telegram</span>
                      <span className={styles.confirmVal}>{username}</span>
                    </div>
                  )}
                  {deliveryType === 'meeting' && (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmKey}>Город</span>
                      <span className={styles.confirmVal}>📍 {city}</span>
                    </div>
                  )}
                  {deliveryType === 'mail' && (
                    <>
                      <div className={styles.confirmRow}>
                        <span className={styles.confirmKey}>Получатель</span>
                        <span className={styles.confirmVal}>{firstName} {lastName}</span>
                      </div>
                      <div className={styles.confirmRow}>
                        <span className={styles.confirmKey}>Telegram</span>
                        <span className={styles.confirmVal}>@{tgHandle}</span>
                      </div>
                      <div className={styles.confirmRow}>
                        <span className={styles.confirmKey}>Город</span>
                        <span className={styles.confirmVal}>📍 {deliveryCity}</span>
                      </div>
                    </>
                  )}
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmKey}>Доставка</span>
                    <span className={styles.confirmVal}>
                      {deliveryType === 'meeting'
                        ? '🤝 Личная встреча'
                        : mailOption === 'track'
                          ? '📦 Почта с трек-номером'
                          : '✉️ Почта без трек-номера'}
                    </span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmKey}>Оплата</span>
                    <span className={styles.confirmVal}>{payment === 'card' ? '💳 Карта' : '💵 Наличные'}</span>
                  </div>
                </div>

                {/* Товары */}
                <div className={styles.confirmItems}>
                  {items.map(item => (
                    <div key={item.id} className={styles.confirmItem}>
                      <span className={styles.confirmItemName}>{item.name}</span>
                      <span className={styles.confirmItemQty}>× {item.qty}</span>
                      <span className={styles.confirmItemPrice}>{(item.price * item.qty).toFixed(2)} €</span>
                    </div>
                  ))}
                  {shippingCost > 0 && (
                    <div className={styles.confirmItem}>
                      <span className={styles.confirmItemName}>
                        {mailOption === 'track' ? '📦 Доставка (с трек-номером)' : '✉️ Доставка (без трек-номера)'}
                      </span>
                      <span className={styles.confirmItemQty}></span>
                      <span className={styles.confirmItemPrice}>{shippingCost.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className={styles.confirmTotal}>
                    <span>Итого</span>
                    <span>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>

                <div className={styles.confirmBtns}>
                  <button className={styles.backBtn} onClick={() => setStep(2)}>← Изменить</button>
                  <button
                    className={`${styles.nextBtn} ${styles.nextBtnActive} ${styles.confirmSendBtn}`}
                    onClick={handleSendOrder}
                    disabled={items.length === 0}
                  >
                    📨 Отправить заказ
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
