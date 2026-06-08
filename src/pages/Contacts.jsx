import styles from './Contacts.module.css';

function openTg(username) {
  const url = `https://t.me/${username}`;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export default function Contacts() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1>Контакты</h1>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,180,255,0.12), rgba(0,80,200,0.08))',
            border: '1px solid rgba(0,180,255,0.25)',
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
              onClick={() => openTg('midnight_nebula_manager')}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #00aaff, #0044cc)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '16px',
                letterSpacing: '1px',
                padding: '14px 32px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(0,180,255,0.4)',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              @midnight_nebula_manager
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
