import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import styles from './Customers.module.css';

export default function Customers() {
  const { customers, orders } = useAdmin();
  const [search, setSearch] = useState('');

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Клиенты</h1>
        <span className={styles.count}>{customers.length}</span>
      </div>

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Поиск по имени, email, городу..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>👥</span>
          <p>{customers.length === 0 ? 'Клиентов пока нет — они появятся после первого заказа' : 'Ничего не найдено'}</p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.thead}>
            <div className={styles.th}>Клиент</div>
            <div className={styles.th}>Город</div>
            <div className={styles.th}>Телефон</div>
            <div className={styles.th} style={{textAlign:'center'}}>Заказов</div>
            <div className={styles.th} style={{textAlign:'right'}}>Потрачено</div>
          </div>

          {filtered.map((c, i) => (
            <div key={i} className={styles.trow}>
              <div className={styles.td}>
                <div className={styles.clientAvatar}>
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className={styles.clientName}>{c.name}</div>
                  <div className={styles.clientEmail}>{c.email}</div>
                </div>
              </div>
              <div className={styles.td}>
                <span className={styles.city}>{c.city || '—'}</span>
              </div>
              <div className={styles.td}>
                <span className={styles.phone}>{c.phone || '—'}</span>
              </div>
              <div className={styles.td} style={{textAlign:'center'}}>
                <span className={styles.ordersBadge}>{c.orders}</span>
              </div>
              <div className={styles.td} style={{textAlign:'right'}}>
                <span className={styles.spent}>{c.spent.toFixed(2)} €</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
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
            <span>Средний чек</span>
            <strong>{orders.length ? (orders.reduce((s,o) => s+(o.total||0),0)/orders.length).toFixed(2) : '0.00'} €</strong>
          </div>
        </div>
      )}
    </div>
  );
}
