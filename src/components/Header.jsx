import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import DragonLogo from './DragonLogo';
import styles from './Header.module.css';

export default function Header() {
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // закрываем меню при смене маршрута
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // блокируем скролл при открытом меню
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
      setMenuOpen(false);
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo}>
            <DragonLogo size={32} />
            <span className={styles.logoText}>WAKASHOP</span>
          </Link>

          <form className={styles.search} onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </form>

          <nav className={styles.nav}>
            <Link to="/" className={styles.navLink}>Каталог</Link>
            <Link to="/about" className={styles.navLink}>О нас</Link>
            <Link to="/contacts" className={styles.navLink}>Контакты</Link>
            <Link to="/cart" className={styles.cartBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </Link>
          </nav>

          {/* Мобильные кнопки */}
          <div className={styles.mobileRight}>
            <Link to="/cart" className={styles.cartBtnMobile}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Мобильное меню */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        <form className={styles.mobileSearch} onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button type="submit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </form>
        <nav className={styles.mobileNav}>
          <Link to="/" className={styles.mobileNavLink}>Каталог</Link>
          <Link to="/about" className={styles.mobileNavLink}>О нас</Link>
          <Link to="/contacts" className={styles.mobileNavLink}>Контакты</Link>
          <Link to="/cart" className={styles.mobileNavLink}>
            Корзина {count > 0 && <span className={styles.mobileCount}>{count}</span>}
          </Link>
        </nav>
      </div>

      {/* Затемнение фона */}
      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}
    </>
  );
}
