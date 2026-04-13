import { Link } from 'react-router-dom';
import DragonLogo from './DragonLogo';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <DragonLogo size={28} />
            <span className={styles.logoText}>WAKASHOP</span>
          </div>
          <p>Интернет-магазин вейп-товаров с доставкой по всей Германии</p>
          <p className={styles.age}>🔞 Только для лиц 18+</p>
        </div>
        <div className={styles.links}>
          <p className={styles.linksTitle}>Навигация</p>
          <Link to="/">Каталог</Link>
          <Link to="/about">О нас</Link>
          <Link to="/contacts">Контакты</Link>
          <Link to="/cart">Корзина</Link>
        </div>
        <div className={styles.links}>
          <p className={styles.linksTitle}>Категории</p>
          <Link to="/?cat=disposable">Одноразки</Link>
          <Link to="/?cat=pods">Поды</Link>
          <Link to="/?cat=liquids">Жидкости</Link>
          <Link to="/?cat=accessories">Расходники</Link>
        </div>
      </div>
      <div className={styles.bottom}>
        <p>© 2026 WAKASHOP · Никотин вызывает сильную зависимость</p>
      </div>
    </footer>
  );
}
