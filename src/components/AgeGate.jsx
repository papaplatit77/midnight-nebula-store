import { useState, useEffect } from 'react';
import styles from './AgeGate.module.css';

export default function AgeGate({ onConfirm }) {
  const [denied, setDenied] = useState(false);

  // Блокируем скролл страницы пока открыт AgeGate
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  if (denied) {
    return (
      <div className={styles.overlay}>
        <div className={styles.box}>
          <div className={styles.icon}>🚫</div>
          <h2>Доступ закрыт</h2>
          <p>Наш магазин доступен только для лиц старше 18 лет.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.logo}>✦ WAKASHOP</div>
        <div className={styles.icon}>🔞</div>
        <h2>Подтверждение возраста</h2>
        <p>Данный сайт содержит товары, предназначенные только для совершеннолетних (18+).</p>
        <p className={styles.sub}>Вам исполнилось 18 лет?</p>
        <div className={styles.buttons}>
          <button className={styles.yes} onClick={onConfirm}>
            Да, мне есть 18
          </button>
          <button className={styles.no} onClick={() => setDenied(true)}>
            Нет
          </button>
        </div>
        <p className={styles.disclaimer}>
          Никотинсодержащие продукты вызывают зависимость. Продажа несовершеннолетним запрещена.
        </p>
      </div>
    </div>
  );
}
