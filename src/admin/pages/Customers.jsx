import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import styles from './Customers.module.css';

export default function Customers() {
  const { customers, orders, deleteUser } = useAdmin();
  const [search, setSearch] = useState('');

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.username?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSpent = customers.reduce((s, c) => s + (c.spent || 0), 0);
  const avgCheck = orders.length
    ? (orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0) / orders.length)
    : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Клиенты</h1>
        <span className={styles.count}>{customers.length}</span>
      </div>

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Поиск по имени, @username, городу..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>👥</span>
          <p>{customers.length === 0
            ? 'Клиентов пока нет — они появятся после первого заказа'
            : 'Ничего не найдено'}
          </p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.thead}>
            <div className={styles.th}>Клиент</div>
            <div className={styles.th}>Telegram</div>
            <div className={styles.th}>Город</div>
            <div className={styles.th} style={{ textAlign: 'center' }}>Заказов</div>
            <div className={styles.th} style={{ textAlign: 'right' }}>Потрачено</div>
            <div className={styles.th}></div>
          </div>

          {filtered.map((c, i) => (
            <div key={c.tgUserId || i} className={styles.trow}>
              <div className={styles.td}>
                <div className={styles.clientAvatar}>
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className={styles.clientName}>
                    {c.name}
                    {c.banned && <span style={{ color: '#f87171', marginLeft: 6, fontSize: 11 }}>🚫 забанен</span>}
                  </div>
                  {c.lastSeen && (
                    <div className={styles.clientEmail}>
                      был {new Date(c.lastSeen).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.td}>
                {c.username
                  ? <a href={`https://t.me/${c.username.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{c.username}</a>
                  : <span style={{ color: '#555' }}>—</span>}
              </div>
              <div className={styles.td}>
                <span className={styles.city}>{c.city || '—'}</span>
              </div>
              <div className={styles.td} style={{ textAlign: 'center' }}>
                <span className={styles.ordersBadge}>{c.orders}</span>
              </div>
              <div className={styles.td} style={{ textAlign: 'right' }}>
                <span className={styles.spent}>{(c.spent || 0).toFixed(2)} €</span>
              </div>
              <div className={styles.td}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => { if (confirm(`Удалить пользователя ${c.name}?`)) deleteUser(c.tgUserId); }}
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {customers.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span>Всего клиентов</span>
            <strong>{customers.length}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Всего заказов</span>
            <strong>{orders.length}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Общая выручка</span>
            <strong>{totalSpent.toFixed(2)} €</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Средний чек</span>
            <strong>{avgCheck.toFixed(2)} €</strong>
          </div>
        </div>
      )}
    </div>
  );
}
