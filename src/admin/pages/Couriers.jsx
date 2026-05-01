import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import styles from './Couriers.module.css';

const ALL_CITIES = [
  'Köln','Düsseldorf','Dortmund','Essen','Duisburg','Bochum','Wuppertal',
  'Bielefeld','Bonn','Münster','Mönchengladbach','Gelsenkirchen','Krefeld',
  'Aachen','Oberhausen','Hagen','Hamm','Solingen','Leverkusen','Neuss',
  'Paderborn','Mülheim an der Ruhr','Remscheid','Siegen','Moers','Witten',
  'Bergisch Gladbach','Recklinghausen','Bottrop','Iserlohn',
  'Berlin','Hamburg','München','Frankfurt am Main','Stuttgart',
  'Leipzig','Bremen','Hannover','Nürnberg','Dresden',
];

const EMPTY = { name: '', chatId: '', username: '', cities: [], productIds: [] };

export default function Couriers() {
  const { couriers, addCourier, updateCourier, deleteCourier, products } = useAdmin();
  const [form, setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState('cities'); // 'cities' | 'products'

  const takenCities = new Set(
    couriers.flatMap(c => (editId === c.id ? [] : c.cities || []))
  );

  const toggleCity = (city) => {
    setForm(f => ({
      ...f,
      cities: f.cities.includes(city)
        ? f.cities.filter(c => c !== city)
        : [...f.cities, city],
    }));
  };

  const toggleProduct = (id) => {
    setForm(f => ({
      ...f,
      productIds: (f.productIds || []).includes(id)
        ? (f.productIds || []).filter(p => p !== id)
        : [...(f.productIds || []), id],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.chatId.trim()) return;
    const data = {
      name: form.name.trim(),
      chatId: form.chatId.trim(),
      username: form.username.trim().replace(/^@/, ''),
      cities: form.cities,
      productIds: form.productIds || [],
    };
    if (editId !== null) {
      updateCourier(editId, data);
    } else {
      addCourier(data);
    }
    setForm(EMPTY);
    setEditId(null);
    setOpen(false);
    setTab('cities');
  };

  const handleEdit = (c) => {
    setForm({
      name: c.name,
      chatId: c.chatId,
      username: c.username || '',
      cities: c.cities || [],
      productIds: c.productIds || [],
    });
    setEditId(c.id);
    setOpen(true);
    setTab('cities');
  };

  const handleDelete = (id) => {
    deleteCourier(id);
    setConfirm(null);
  };

  const handleCancel = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(false);
    setTab('cities');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Курьеры</h1>
          <span className={styles.count}>{couriers.length}</span>
        </div>
        {!open && (
          <button className={styles.addBtn} onClick={() => setOpen(true)}>
            + Добавить курьера
          </button>
        )}
      </div>

      {/* Форма добавления / редактирования */}
      {open && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{editId !== null ? 'Редактировать курьера' : 'Новый курьер'}</h2>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label>Имя / Описание</label>
              <input
                placeholder="Иван (Köln)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label>Telegram Chat ID</label>
              <input
                placeholder="123456789"
                value={form.chatId}
                onChange={e => setForm(f => ({ ...f, chatId: e.target.value.replace(/\D/g, '') }))}
              />
              <span className={styles.hint}>Узнать через @userinfobot в Telegram</span>
            </div>
            <div className={styles.field}>
              <label>Username (необязательно)</label>
              <input
                placeholder="@username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
              <span className={styles.hint}>Если есть — пользователи смогут написать напрямую</span>
            </div>
          </div>

          {/* Вкладки: Города / Товары */}
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabBtn} ${tab === 'cities' ? styles.tabActive : ''}`}
              onClick={() => setTab('cities')}
            >
              🏙 Города ({form.cities.length})
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'products' ? styles.tabActive : ''}`}
              onClick={() => setTab('products')}
            >
              📦 Склад ({(form.productIds || []).length})
            </button>
          </div>

          {/* Города */}
          {tab === 'cities' && (
            <div className={styles.citiesSection}>
              <label className={styles.citiesLabel}>
                Города обслуживания
                <span className={styles.citiesSel}>{form.cities.length} выбрано</span>
              </label>
              <div className={styles.citiesGrid}>
                {ALL_CITIES.map(city => {
                  const taken    = takenCities.has(city);
                  const selected = form.cities.includes(city);
                  return (
                    <button
                      key={city}
                      className={`${styles.cityBtn} ${selected ? styles.citySelected : ''} ${taken && !selected ? styles.cityTaken : ''}`}
                      onClick={() => !taken && toggleCity(city)}
                      title={taken ? 'Город уже занят другим курьером' : ''}
                    >
                      {city}
                      {taken && !selected && <span className={styles.takenMark}>✕</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Товары (склад курьера) */}
          {tab === 'products' && (
            <div className={styles.citiesSection}>
              <label className={styles.citiesLabel}>
                Товары в наличии у курьера
                <span className={styles.citiesSel}>{(form.productIds || []).length} выбрано</span>
              </label>
              {products.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                  Нет товаров. Сначала добавьте товары в каталог.
                </p>
              ) : (
                <div className={styles.productsGrid}>
                  {products.filter(p => p.inStock !== false).map(p => {
                    const selected = (form.productIds || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        className={`${styles.cityBtn} ${selected ? styles.citySelected : ''}`}
                        onClick={() => toggleProduct(p.id)}
                        title={p.name}
                      >
                        {p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name}
                        {p.price && <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: '4px' }}>{p.price}€</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={handleSave} disabled={!form.name.trim() || !form.chatId.trim()}>
              {editId !== null ? 'Сохранить' : 'Добавить'}
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel}>Отмена</button>
          </div>
        </div>
      )}

      {/* Список курьеров */}
      {couriers.length === 0 && !open ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚗</div>
          <p>Курьеры не добавлены</p>
          <p className={styles.emptyHint}>Добавьте курьера и назначьте ему города и товары.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {couriers.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>🚗 {c.name}</div>
                  <div className={styles.cardId}>
                    ID: <code>{c.chatId}</code>
                    {c.username && <span style={{ marginLeft: '8px', opacity: 0.6 }}>@{c.username}</span>}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.editBtn} onClick={() => handleEdit(c)}>Изменить</button>
                  <button className={styles.deleteBtn} onClick={() => setConfirm(c.id)}>Удалить</button>
                </div>
              </div>
              <div className={styles.cardCities}>
                {(c.cities || []).length === 0
                  ? <span className={styles.noCities}>Города не назначены</span>
                  : (c.cities || []).map(city => (
                    <span key={city} className={styles.cityTag}>{city}</span>
                  ))
                }
              </div>
              {(c.productIds || []).length > 0 && (
                <div className={styles.cardProducts}>
                  <span className={styles.noCities} style={{ marginRight: '6px' }}>📦 Товаров: {c.productIds.length}</span>
                  {c.productIds.slice(0, 3).map(id => {
                    const p = products.find(x => x.id === id);
                    return p ? <span key={id} className={styles.cityTag} style={{ opacity: 0.7 }}>{p.name.length > 16 ? p.name.slice(0,16)+'…' : p.name}</span> : null;
                  })}
                  {c.productIds.length > 3 && <span className={styles.noCities}>+{c.productIds.length - 3} ещё</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <p>Удалить курьера?</p>
            <div className={styles.dialogActions}>
              <button className={styles.deleteBtn} onClick={() => handleDelete(confirm)}>Удалить</button>
              <button className={styles.cancelBtn} onClick={() => setConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
