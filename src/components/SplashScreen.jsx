import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const START = Date.now();
    const MIN_SHOW = 2200; // минимум 2.2с чтобы анимация успела отыграть

    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 14 + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        const elapsed = Date.now() - START;
        const remaining = Math.max(0, MIN_SHOW - elapsed);
        setTimeout(() => {
          setFading(true);
          setTimeout(onDone, 500);
        }, remaining);
      }
      setProgress(Math.min(p, 100));
    }, 130);

    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className={`${styles.overlay} ${fading ? styles.fading : ''}`}>
      {/* Фоновые блики */}
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.content}>
        {/* Лого */}
        <div className={styles.logoWrap}>
          <div className={styles.logoW}>◈</div>
          <div className={styles.logoText}>MIDNIGHT NEBULA</div>
        </div>

        {/* Подзаголовок */}
        <p className={styles.subtitle}>NRW · Vape Store · Deutschland</p>

        {/* Прогресс-бар */}
        <div className={styles.barWrap}>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.hint}>
            {progress < 100 ? 'Загружаем сайт, подождите...' : 'Готово ✓'}
          </p>
        </div>
      </div>
    </div>
  );
}
