import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import styles from './Header.module.css';

export default function Header() {
  const { count } = useCart();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>MIDNIGHT NEBULA</span>
          </Link>

          <nav className={styles.nav}>
            <Link to="/" className={styles.navLink}>Каталог</Link>
            <Link to="/about" className={styles.navLink}>О нас</Link>
            <Link to="/contacts" className={styles.navLink}>Контакты</Link>
          </nav>

          <div className={styles.right}>
            <Link to="/cart" className={styles.cartBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </Link>
            <button
              className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Меню"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        <nav className={styles.mobileNav}>
          <Link to="/" className={styles.mobileNavLink}>Каталог</Link>
          <Link to="/about" className={styles.mobileNavLink}>О нас</Link>
          <Link to="/contacts" className={styles.mobileNavLink}>Контакты</Link>
          <Link to="/cart" className={styles.mobileNavLink}>
            Корзина {count > 0 && <span className={styles.mobileCount}>{count}</span>}
          </Link>
        </nav>
      </div>

      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}
    </>
  );
}
