import { useParams, Link } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import styles from './OrderDetail.module.css';

const STATUS_OPTIONS = { new:'Новый', processing:'В обработке', shipped:'Отправлен', delivered:'Доставлен' };
const STATUS_COLOR = { new:'#44d4ff', processing:'#60a5fa', shipped:'#a78bfa', delivered:'#34d399' };

export default function OrderDetail() {
  const { id } = useParams();
  const { orders, couriers, updateOrderStatus, updateOrderCourier } = useAdmin();
  const order = orders.find(o => String(o.id) === id);

  if (!order) return (
    <div className={styles.notFound}>
      <span>📭</span>
      <p>Заказ не найден</p>
      <Link to="/admin/orders" className={styles.back}>← Назад</Link>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/admin/orders" className={styles.backBtn}>← Заказы</Link>
        <h1>Заказ #{String(order.id).slice(-6)}</h1>
        <span className={styles.date}>{new Date(order.createdAt).toLocaleString('ru-RU')}</span>
      </div>

      <div className={styles.grid}>
        {/* Client */}
        <div className={styles.card}>
          <h2>👤 Клиент</h2>
          <div className={styles.row}><span>Имя</span><strong>{order.name}</strong></div>
          <div className={styles.row}><span>Email</span><strong>{order.email}</strong></div>
          <div className={styles.row}><span>Телефон</span><strong>{order.phone}</strong></div>
        </div>

        {/* Delivery */}
        <div className={styles.card}>
          <h2>📍 Доставка</h2>
          <div className={styles.row}><span>Город</span><strong>{order.city}</strong></div>
          <div className={styles.row}><span>Индекс</span><strong>{order.zip}</strong></div>
          <div className={styles.row}><span>Адрес</span><strong>{order.address}</strong></div>
          {order.comment && <div className={styles.row}><span>Комментарий</span><strong>{order.comment}</strong></div>}
        </div>

        {/* Status */}
        <div className={styles.card}>
          <h2>🔄 Статус заказа</h2>
          <div className={styles.statusButtons}>
            {Object.entries(STATUS_OPTIONS).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.statusBtn} ${order.status === key ? styles.statusBtnActive : ''}`}
                style={order.status === key ? { borderColor: STATUS_COLOR[key], color: STATUS_COLOR[key], background: `${STATUS_COLOR[key]}18` } : {}}
                onClick={() => updateOrderStatus(order.id, key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Courier */}
        <div className={styles.card}>
          <h2>🚗 Курьер</h2>
          <select
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, cursor: 'pointer' }}
            value={order.courierId || ''}
            onChange={e => {
              const chosen = couriers.find(c => String(c.chatId) === e.target.value) || null;
              updateOrderCourier(order.id, chosen);
            }}
          >
            <option value="">— Без курьера —</option>
            {couriers.map(c => (
              <option key={c.chatId} value={c.chatId}>{c.name}{c.username ? ` (@${c.username})` : ''}</option>
            ))}
          </select>
          {order.courierName && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.55 }}>
              Текущий: {order.courierName}{order.courierUsername ? ` · @${order.courierUsername}` : ''}
            </div>
          )}
        </div>

        {/* Items */}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2>📦 Состав заказа</h2>
          <div className={styles.items}>
            {order.items?.map((item, i) => (
              <div key={i} className={styles.item}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemQty}>×{item.qty}</span>
                <span className={styles.itemPrice}>{item.price?.toFixed(2)} €</span>
                <span className={styles.itemTotal}>{(item.price * item.qty).toFixed(2)} €</span>
              </div>
            ))}
          </div>
          <div className={styles.orderTotal}>
            <span>Итого</span>
            <span>{(order.total||0).toFixed(2)} €</span>
          </div>
        </div>
      </div>
    </div>
  );
}
