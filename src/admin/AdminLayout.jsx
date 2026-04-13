import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from './context/AdminContext';
import DragonLogo from '../components/DragonLogo';
import styles from './AdminLayout.module.css';

const nav = [
  { to: '/admin/dashboard', icon: '📊', label: 'Дашборд'  },
  { to: '/admin/orders',    icon: '📦', label: 'Заказы'   },
  { to: '/admin/products',  icon: '🛍️', label: 'Товары'   },
  { to: '/admin/customers', icon: '👥', label: 'Клиенты'  },
  { to: '/admin/couriers',  icon: '🚗', label: 'Курьеры'  },
];

export default function AdminLayout() {
  const { logout, orders, revenue } = useAdmin();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const newOrders = orders.filter(o => o.status === 'new').length;

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <DragonLogo size={32} />
          <div>
            <div className={styles.brandName}>WAKASHOP</div>
            <div className={styles.brandSub}>Admin</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? `${styles.navItem} ${styles.navActive}` : styles.navItem}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Заказы' && newOrders > 0 && (
                <span className={styles.badge}>{newOrders}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sideBottom}>
          <a href="/" target="_blank" className={styles.siteLink}>
            <span>🌐</span> Открыть сайт
          </a>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span>🚪</span> Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.greeting}>Добро пожаловать,</span>
            <span className={styles.greetingName}>Администратор</span>
          </div>
          <div className={styles.topbarRight}>
            {newOrders > 0 && (
              <div className={styles.alert}>
                🔔 {newOrders} новых заказов
              </div>
            )}
            <div className={styles.revenue}>
              💰 {revenue.toFixed(2)} €
            </div>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
