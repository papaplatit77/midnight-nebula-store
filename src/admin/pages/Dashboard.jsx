import { useAdmin } from '../context/AdminContext';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';

const STATUS_LABEL = { new: 'Новый', processing: 'В обработке', shipped: 'Отправлен', delivered: 'Доставлен' };
const STATUS_COLOR = { new: '#44d4ff', processing: '#60a5fa', shipped: '#a78bfa', delivered: '#34d399' };

export default function Dashboard() {
  const { orders, products, customers, revenue } = useAdmin();

  const stats = [
    { label: 'Выручка', value: `${revenue.toFixed(2)} €`, icon: '💰', color: '#44d4ff' },
    { label: 'Заказов', value: orders.length, icon: '📦', color: '#00aaff' },
    { label: 'Товаров', value: products.length, icon: '🛍️', color: '#60a5fa' },
    { label: 'Клиентов', value: customers.length, icon: '👥', color: '#34d399' },
  ];

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const recent = orders.slice(0, 6);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Дашборд</h1>
        <p>Обзор магазина MIDNIGHT NEBULA</p>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard} style={{ '--c': s.color }}>
            <div className={styles.statIcon}>{s.icon}</div>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.row}>
        {/* Recent orders */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Последние заказы</h2>
            <Link to="/admin/orders" className={styles.cardLink}>Все заказы →</Link>
          </div>
          {recent.length === 0 ? (
            <div className={styles.empty}>Заказов пока нет</div>
          ) : (
            <div className={styles.orderList}>
              {recent.map(order => (
                <Link to={`/admin/orders/${order.id}`} key={order.id} className={styles.orderRow}>
                  <div className={styles.orderInfo}>
                    <span className={styles.orderName}>{order.name || order.tgUsername || 'Неизвестен'}</span>
                    <span className={styles.orderDate}>
                      {new Date(order.createdAt || order.date).toLocaleDateString('ru-RU')}
                      {order.city ? ` · ${order.city}` : ''}
                    </span>
                  </div>
                  <div className={styles.orderRight}>
                    <span className={styles.orderTotal}>{parseFloat(order.total || 0).toFixed(2)} €</span>
                    <span className={styles.statusDot} style={{ background: STATUS_COLOR[order.status] || '#888' }}>
                      {STATUS_LABEL[order.status] || 'Новый'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Order statuses */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><h2>Статусы заказов</h2></div>
          {orders.length === 0 ? (
            <div className={styles.empty}>Нет данных</div>
          ) : (
            <div className={styles.statusList}>
              {Object.entries(STATUS_LABEL).map(([key, label]) => {
                const count = statusCounts[key] || 0;
                const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
                return (
                  <div key={key} className={styles.statusItem}>
                    <div className={styles.statusHeader}>
                      <span style={{ color: STATUS_COLOR[key] }}>{label}</span>
                      <span className={styles.statusCount}>{count}</span>
                    </div>
                    <div className={styles.barBg}>
                      <div className={styles.barFill} style={{ width: `${pct}%`, background: STATUS_COLOR[key] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top products */}
          <div className={styles.cardHeader} style={{ marginTop: 24 }}><h2>Товаров в каталоге</h2></div>
          <div className={styles.catList}>
            {['disposable','pods','liquids','accessories'].map(cat => {
              const names = { disposable:'Одноразки', pods:'Поды', liquids:'Жидкости', accessories:'Расходники' };
              const count = products.filter(p => p.category === cat).length;
              return (
                <div key={cat} className={styles.catItem}>
                  <span>{names[cat]}</span>
                  <span className={styles.catCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
