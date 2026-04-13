import { useState, useEffect } from 'react';
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

const EMPTY = { name: '', chatId: '', cities: [] };

export default function Couriers() {
  const [couriers, setCouriers] = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [open, setOpen]         = useState(false);
  const [copied, setCopied]     = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/couriers')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCouriers(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const handleSave = () => {
    if (!form.name.trim() || !form.chatId.trim()) return;
    let updated;
    if (editId !== null) {
      updated = couriers.map(c => c.id === editId
        ? { ...c, name: form.name.trim(), chatId: form.chatId.trim(), cities: form.cities }
        : c
      );
    } else {
      updated = [...couriers, { id: Date.now(), name: form.name.trim(), chatId: form.chatId.trim(), cities: form.cities }];
    }
    setCouriers(updated);
    setForm(EMPTY);
    setEditId(null);
    setOpen(false);
  };

  const handleEdit = (c) => {
    setForm({ name: c.name, chatId: c.chatId, cities: c.cities || [] });
    setEditId(c.id);
    setOpen(true);
  };

  const handleDelete = (id) => {
    setCouriers(prev => prev.filter(c => c.id !== id));
    setConfirm(null);
  };

  const handleCancel = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(false);
  };

  const jsonValue = JSON.stringify(couriers);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

      {/* Инструкция по сохранению */}
      {couriers.length > 0 && (
        <div className={styles.exportBox}>
          <div className={styles.exportTitle}>
            📋 После изменений — скопируй JSON и вставь в Vercel
            <span className={styles.exportSub}>Settings → Environment Variables → COURIERS_JSON</span>
          </div>
          <div className={styles.exportRow}>
            <code className={styles.exportJson}>{jsonValue}</code>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? '✅ Скопировано' : '📋 Копировать'}
            </button>
          </div>
        </div>
      )}

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
          </div>

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

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={handleSave} disabled={!form.name.trim() || !form.chatId.trim()}>
              {editId !== null ? 'Сохранить' : 'Добавить'}
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel}>Отмена</button>
          </div>
        </div>
      )}

      {/* Список курьеров */}
      {loading ? (
        <div className={styles.empty}><p>Загрузка...</p></div>
      ) : couriers.length === 0 && !open ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚗</div>
          <p>Курьеры не добавлены</p>
          <p className={styles.emptyHint}>Добавьте курьера и назначьте ему города — при заказе из этого города уведомление придёт именно ему.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {couriers.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>🚗 {c.name}</div>
                  <div className={styles.cardId}>ID: <code>{c.chatId}</code></div>
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
