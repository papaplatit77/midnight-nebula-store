import styles from './Contacts.module.css';

function openTg(username) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/${username}`);
  } else {
    window.open(`https://t.me/${username}`, '_blank', 'noopener');
  }
}

export default function Contacts() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1>Контакты</h1>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(179,0,255,0.12), rgba(124,0,212,0.08))',
            border: '1px solid rgba(179,0,255,0.25)',
            borderRadius: '20px',
            padding: '48px 40px',
            textAlign: 'center',
            maxWidth: '420px',
            width: '100%',
          }}>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>✈️</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              Свяжитесь с нами в Telegram
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
              Мы отвечаем быстро — по любым вопросам заказов, доставки и сотрудничества.
            </p>
            <button
              onClick={() => openTg('Manager_NRW_1')}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #b300ff, #7c00d4)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '16px',
                letterSpacing: '1px',
                padding: '14px 32px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(179,0,255,0.4)',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              @Manager_NRW_1
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
