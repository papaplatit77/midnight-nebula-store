import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAdmin } from '../admin/context/AdminContext';
import styles from './Checkout.module.css';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { addOrder } = useAdmin();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', city: '', address: '', zip: '', comment: '',
  });
  const [errors, setErrors] = useState({});

  if (items.length === 0 && !done) {
    return (
      <div className={styles.empty}>
        <span>🛒</span>
        <p>Корзина пуста</p>
        <Link to="/" className={styles.backLink}>← В каталог</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.success}>
        <span>✅</span>
        <h2>Заказ оформлен!</h2>
        <p>Мы свяжемся с вами в ближайшее время по указанным контактам.</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>На главную</button>
      </div>
    );
  }

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Введите имя';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Введите корректный email';
    if (!form.phone.trim()) e.phone = 'Введите телефон';
    if (!form.city.trim()) e.city = 'Введите город';
    if (!form.address.trim()) e.address = 'Введите адрес';
    if (!form.zip.trim()) e.zip = 'Введите PLZ';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    addOrder({ ...form, items, total });
    clear();
    setDone(true);
  };

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(err => ({ ...err, [k]: undefined }));
  };

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1>Оформление заказа</h1>
        <div className={styles.layout}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.section}>
              <h2>Контактные данные</h2>
              <div className={styles.row2}>
                <Field label="Имя" error={errors.name}>
                  <input placeholder="Max Mustermann" value={form.name} onChange={set('name')} />
                </Field>
                <Field label="Телефон" error={errors.phone}>
                  <input placeholder="+49 151 000 0000" value={form.phone} onChange={set('phone')} />
                </Field>
              </div>
              <Field label="Email" error={errors.email}>
                <input type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
              </Field>
            </div>

            <div className={styles.section}>
              <h2>Адрес доставки</h2>
              <div className={styles.row2}>
                <Field label="Город" error={errors.city}>
                  <input placeholder="Berlin" value={form.city} onChange={set('city')} />
                </Field>
                <Field label="PLZ (Индекс)" error={errors.zip}>
                  <input placeholder="10115" value={form.zip} onChange={set('zip')} />
                </Field>
              </div>
              <Field label="Адрес (улица, дом, квартира)" error={errors.address}>
                <input placeholder="Musterstraße 1, Wohnung 42" value={form.address} onChange={set('address')} />
              </Field>
            </div>

            <div className={styles.section}>
              <h2>Комментарий к заказу</h2>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Дополнительные пожелания..."
                value={form.comment}
                onChange={set('comment')}
              />
            </div>

            <button type="submit" className={styles.submitBtn}>
              Подтвердить заказ — {total.toFixed(2)} €
            </button>
          </form>

          <div className={styles.orderSummary}>
            <h2>Ваш заказ</h2>
            {items.map(item => (
              <div key={item.id} className={styles.orderItem}>
                <span className={styles.orderName}>{item.name}</span>
                <span className={styles.orderMeta}>×{item.qty} · {(item.price * item.qty).toFixed(2)} €</span>
              </div>
            ))}
            <div className={styles.orderTotal}>
              <span>Итого</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, error, children }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
