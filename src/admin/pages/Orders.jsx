import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import styles from './Orders.module.css';

const STATUSES = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'processing', label: 'В обработке' },
  { key: 'shipped', label: 'Отправлены' },
  { key: 'delivered', label: 'Доставлены' },
];

const STATUS_COLOR = { new: '#d966ff', processing: '#60a5fa', shipped: '#a78bfa', delivered: '#34d399' };
const STATUS_LABEL = { new: 'Новый', processing: 'В обработке', shipped: 'Отправлен', delivered: 'Доставлен' };

export default function Orders() {
  const { orders, updateOrderStatus, deleteOrder } = useAdmin();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase()) &&
        !o.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Заказы</h1>
        <span className={styles.count}>{orders.length}</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.filters}>
          {STATUSES.map(s => (
            <button
              key={s.key}
              className={filter === s.key ? `${styles.filter} ${styles.filterActive}` : styles.filter}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
              <span className={styles.filterCount}>
                {s.key === 'all' ? orders.length : orders.filter(o => o.status === s.key).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>📭</span>
          <p>Заказов не найдено</p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.thead}>
            <div className={styles.th} style={{width:60}}>#</div>
            <div className={styles.th}>Клиент</div>
            <div className={styles.th}>Город</div>
            <div className={styles.th}>Товары</div>
            <div className={styles.th}>Сумма</div>
            <div className={styles.th}>Дата</div>
            <div className={styles.th}>Статус</div>
            <div className={styles.th}></div>
          </div>

          {filtered.map(order => (
            <div key={order.id} className={styles.trow}>
              <div className={styles.td} style={{width:60, color:'rgba(255,255,255,0.3)', fontSize:12}}>
                #{String(order.id).slice(-4)}
              </div>
              <div className={styles.td}>
                <div className={styles.clientName}>{order.name}</div>
                <div className={styles.clientEmail}>{order.email}</div>
              </div>
              <div className={styles.td}>
                <span className={styles.city}>{order.city}</span>
              </div>
              <div className={styles.td}>
                <span className={styles.itemsCount}>{order.items?.length || 0} поз.</span>
              </div>
              <div className={styles.td}>
                <span className={styles.total}>{(order.total||0).toFixed(2)} €</span>
              </div>
              <div className={styles.td}>
                <span className={styles.date}>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <div className={styles.td}>
                <select
                  className={styles.statusSelect}
                  value={order.status}
                  onChange={e => updateOrderStatus(order.id, e.target.value)}
                  style={{ borderColor: STATUS_COLOR[order.status], color: STATUS_COLOR[order.status] }}
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className={styles.td} style={{ display:'flex', gap:6 }}>
                <Link to={`/admin/orders/${order.id}`} className={styles.viewBtn}>→</Link>
                <button
                  className={styles.deleteBtn}
                  onClick={() => { if (confirm('Удалить заказ?')) deleteOrder(order.id); }}
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
