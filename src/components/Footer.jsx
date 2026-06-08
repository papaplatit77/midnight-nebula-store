import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <p className={styles.brandName}>MIDNIGHT NEBULA</p>
          <p className={styles.brandDesc}>Вейп-магазин нового поколения · NRW · Deutschland · 18+</p>
        </div>
        <nav className={styles.nav}>
          <Link to="/">Каталог</Link>
          <Link to="/about">О нас</Link>
          <Link to="/contacts">Контакты</Link>
          <Link to="/cart">Корзина</Link>
        </nav>
      </div>
      <div className={styles.bottom}>
        <p>© 2026 MIDNIGHT NEBULA · Никотин вызывает зависимость · Только 18+</p>
      </div>
    </footer>
  );
}
