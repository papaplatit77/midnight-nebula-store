import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './context/AdminContext';
import DragonLogo from '../components/DragonLogo';
import styles from './AdminLogin.module.css';

export default function AdminLogin() {
  const { login } = useAdmin();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(password);
    if (ok) {
      navigate('/admin/dashboard');
    } else {
      setError('Неверный пароль');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.box}>
        <div className={styles.logo}>
          <DragonLogo size={48} />
          <div>
            <div className={styles.logoName}>MIDNIGHT NEBULA</div>
            <div className={styles.logoSub}>Admin Panel</div>
          </div>
        </div>

        <h1>Вход в систему</h1>
        <p>Введите пароль для доступа к панели управления</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Пароль</label>
            <input
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <span className={styles.error}>{error}</span>}
          </div>
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} />
            ) : 'Войти'}
          </button>
        </form>

      </div>
    </div>
  );
}
