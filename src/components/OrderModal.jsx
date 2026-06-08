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

export default function OrderModal({ onClose, forceOpen }) {
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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    fetch('/api/couriers').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCouriersList(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (forceOpen) {
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
      const t = setTimeout(() => {
        setStep(1); setDeliveryType(''); setMailOption(''); setCity('');
        setPayment(''); setFirstName(''); setLastName(''); setStreet('');
        setPlz(''); setDeliveryCity(''); setSearch(''); setActiveCat('all');
        setAddedMap({}); setSent(false); setSending(false); setSendError('');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const courierForCity = city ? (couriersList.find(c => c.cities && c.cities.includes(city)) || null) : null;

  // Города для встречи: если курьеры настроены — их города, иначе все города
  const citiesWithCouriers = useMemo(() => {
    if (couriersList.length === 0) return CITIES;
    const assigned = new Set(couriersList.flatMap(c => c.cities || []));
    const filtered = CITIES.filter(c => assigned.has(c));
    return filtered.length > 0 ? filtered : CITIES;
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
    if (!street.trim()) errs.street = 'Укажите улицу и дом';
    if (!plz.trim()) errs.plz = 'Укажите PLZ';
    else if (!/^\d{5}$/.test(plz.trim())) errs.plz = '5 цифр, например 50667';
    if (!deliveryCity.trim()) errs.deliveryCity = 'Укажите город';
    return errs;
  };

  const mailFieldsFilled = firstName.trim() && lastName.trim()
    && street.trim() && plz.trim() && deliveryCity.trim();
  const canNext = deliveryType && payment
    && (deliveryType === 'meeting'
      ? !!city
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
    const paymentLabel = payment === 'card' ? 'Карта' : payment === 'crypto' ? 'Крипто' : 'Наличные';
    const orderCity = deliveryType === 'mail' ? deliveryCity.trim() : city;
    const tg = tgHandle.trim() || (username ? username.replace('@', '') : '');
    const itemsText = items.map(i => `• ${i.name} ×${i.qty} — ${(i.price * i.qty).toFixed(2)} €`).join('\n');
    const mailBlock = deliveryType === 'mail'
      ? `\nПолучатель: ${firstName.trim()} ${lastName.trim()}\nАдрес: ${street.trim()}, ${plz.trim()} ${deliveryCity.trim()}`
      : '';
    return (
      `📦 ЗАКАЗ MIDNIGHT NEBULA\n` +
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

  const handleSendOrder = () => {
    if (items.length === 0) return;

    const text = buildOrderText();
    const recipient = deliveryType === 'meeting' ? 'ManagerCobaltLabAroma' : 'midnight_nebula_manager';
    const url = `https://t.me/${recipient}?text=${encodeURIComponent(text)}`;

    clear();
    window.location.href = url;
  };

  return (
    <div
      className={`${styles.backdrop} ${visible ? styles.backdropVisible : ''}`}
      style={!visible && !forceOpen ? { pointerEvents: 'none' } : undefined}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className={`${styles.sheet} ${visible ? styles.sheetVisible : ''} ${step === 2 ? styles.sheetFull : styles.sheetHalf}`}>

        <div className={styles.handle}><span /></div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <div className={styles.step1}>
            <div className={styles.stepHeader}>
              <p className={styles.stepLabel}>MIDNIGHT NEBULA STORE</p>
              <h2 className={styles.stepTitle}>Детали заказа</h2>
              <p className={styles.stepSub}>Укажи как и где получить</p>
            </div>

            {/* Способ доставки */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Способ получения</label>
              <div className={styles.toggleRow}>
                <button
                  className={`${styles.toggleBtn} ${deliveryType === 'meeting' ? styles.toggleActive : ''}`}
                  onClick={() => handleDeliveryType('meeting')}
                >
                  <span className={styles.toggleMain}>Личная встреча</span>
                  <span className={styles.toggleSub}>быстро, в твоём городе</span>
                </button>
                <button
                  className={`${styles.toggleBtn} ${deliveryType === 'mail' ? styles.toggleActive : ''}`}
                  onClick={() => handleDeliveryType('mail')}
                >
                  <span className={styles.toggleMain}>Почта DHL</span>
                  <span className={styles.toggleSub}>только банковская карта</span>
                </button>
              </div>
            </div>

            {/* Варианты почты */}
            {deliveryType === 'mail' && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Тип отправления</label>
                <div className={styles.toggleRow}>
                  <button
                    className={`${styles.toggleBtn} ${mailOption === 'track' ? styles.toggleActive : ''}`}
                    onClick={() => setMailOption('track')}
                  >
                    <span className={styles.toggleMain}>С трек-номером</span>
                    <span className={styles.toggleSub}>DHL · 6,20 €</span>
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${mailOption === 'notrack' ? styles.toggleActive : ''}`}
                    onClick={() => setMailOption('notrack')}
                  >
                    <span className={styles.toggleMain}>Без трека</span>
                    <span className={styles.toggleSub}>DHL · 4,19 €</span>
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
              <label className={styles.fieldLabel}>Оплата</label>
              {deliveryType === 'mail' ? (
                <div className={`${styles.toggleBtn} ${styles.toggleActive} ${styles.toggleLocked}`}>
                  <span className={styles.toggleMain}>Банковская карта</span>
                  <span className={styles.toggleSub}>единственный вариант для почты</span>
                </div>
              ) : (
                <div className={styles.payTabs}>
                  {[
                    { id:'card',  label:'Карта',     sub:'банк. перевод' },
                    { id:'cash',  label:'Наличные',  sub:'при получении' },
                    { id:'crypto',label:'Крипто',    sub:'USDT / BTC' },
                  ].map(p => (
                    <button
                      key={p.id}
                      className={`${styles.payTab} ${payment === p.id ? styles.payTabActive : ''}`}
                      onClick={() => setPayment(p.id)}
                    >
                      <span className={styles.payTabLabel}>{p.label}</span>
                      <span className={styles.payTabSub}>{p.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className={`${styles.nextBtn} ${canNext ? styles.nextBtnActive : ''}`}
              disabled={!canNext}
              onClick={() => {
                const errs = deliveryType === 'mail' ? validateMailFields() : {};
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
              <p className={styles.step2Title}>Выберите товары</p>
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
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Сетка товаров */}
            <div className={styles.productsGrid}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  <span style={{fontSize:20,opacity:0.4}}>—</span>
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
                        <span className={styles.productPlaceholder} />
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
                  Заказ принят! Курьер получил уведомление и скоро напишет вам в Telegram.
                </p>
                <button className={`${styles.nextBtn} ${styles.nextBtnActive}`} onClick={handleClose}>
                  Закрыть
                </button>
              </div>
            ) : (
              <>
                <div className={styles.stepHeader}>
                  <p className={styles.stepLabel}>MIDNIGHT NEBULA</p>
                  <h2 className={styles.stepTitle}>Ваш заказ</h2>
                </div>

                {/* Инфо */}
                <div className={styles.confirmInfo}>
                    {deliveryType === 'meeting' && (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmKey}>Город</span>
                      <span className={styles.confirmVal}>{city}</span>
                    </div>
                  )}
                  {deliveryType === 'mail' && (
                    <>
                      <div className={styles.confirmRow}>
                        <span className={styles.confirmKey}>Получатель</span>
                        <span className={styles.confirmVal}>{firstName} {lastName}</span>
                      </div>
                      <div className={styles.confirmRow}>
                        <span className={styles.confirmKey}>Город</span>
                        <span className={styles.confirmVal}>{deliveryCity}</span>
                      </div>
                    </>
                  )}
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmKey}>Доставка</span>
                    <span className={styles.confirmVal}>
                      {deliveryType === 'meeting'
                        ? 'Личная встреча'
                        : mailOption === 'track'
                          ? 'Почта с трек-номером'
                          : 'Почта без трек-номера'}
                    </span>
                  </div>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmKey}>Оплата</span>
                    <span className={styles.confirmVal}>
                      {payment === 'card' ? 'Карта' : payment === 'crypto' ? 'Крипто' : 'Наличные'}
                    </span>
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
                        {mailOption === 'track' ? 'Доставка (с трек-номером)' : 'Доставка (без трек-номера)'}
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

                {sendError && (
                  <p style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '8px', textAlign: 'center' }}>
                    ⚠️ {sendError}
                  </p>
                )}
                <div className={styles.confirmBtns}>
                  <button className={styles.backBtn} onClick={() => setStep(2)} disabled={sending}>← Изменить</button>
                  <button
                    className={`${styles.nextBtn} ${styles.nextBtnActive} ${styles.confirmSendBtn}`}
                    onClick={handleSendOrder}
                    disabled={items.length === 0 || sending}
                  >
                    {sending ? '⏳ Отправляем...' : '📨 Отправить заказ'}
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
