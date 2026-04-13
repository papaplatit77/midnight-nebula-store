import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import styles from './Cart.module.css';

const CATEGORY_ICONS = {
  disposable: '💨',
  pods: '🔋',
  liquids: '💧',
  accessories: '🔧',
};

export default function Cart() {
  const { items, remove, updateQty, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <span>🛒</span>
        <h2>Корзина пуста</h2>
        <p>Добавьте товары из каталога</p>
        <Link to="/" className={styles.shopBtn}>Перейти в каталог</Link>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1>Корзина</h1>

        <div className={styles.layout}>
          <div className={styles.items}>
            {items.map(item => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemImage}>
                  {CATEGORY_ICONS[item.category] || '📦'}
                </div>
                <div className={styles.itemInfo}>
                  <Link to={`/product/${item.id}`} className={styles.itemName}>{item.name}</Link>
                  <span className={styles.itemPrice}>{item.price.toFixed(2)} €</span>
                </div>
                <div className={styles.qtyControl}>
                  <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                </div>
                <div className={styles.itemTotal}>
                  {(item.price * item.qty).toFixed(2)} €
                </div>
                <button className={styles.removeBtn} onClick={() => remove(item.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className={styles.summary}>
            <h2>Итого</h2>
            <div className={styles.summaryRow}>
              <span>Товаров</span>
              <span>{items.reduce((s, i) => s + i.qty, 0)} шт.</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Доставка</span>
              <span className={styles.free}>Бесплатно</span>
            </div>
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span>Итого</span>
              <span>{total.toFixed(2)} €</span>
            </div>
            <button className={styles.checkoutBtn} onClick={() => navigate('/?order=1')}>
              Оформить заказ
            </button>
            <Link to="/" className={styles.continueLink}>← Продолжить покупки</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
