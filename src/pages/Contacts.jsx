import styles from './Contacts.module.css';

export default function Contacts() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1>Контакты</h1>
        <div className={styles.grid}>
          <div className={styles.info}>
            <div className={styles.item}>
              <span>📧</span>
              <div>
                <p className={styles.label}>Email</p>
                <p className={styles.value}>info@vapeshop.de</p>
              </div>
            </div>
            <div className={styles.item}>
              <span>📱</span>
              <div>
                <p className={styles.label}>Telegram</p>
                <p className={styles.value}>@vapeshop_de</p>
              </div>
            </div>
            <div className={styles.item}>
              <span>📍</span>
              <div>
                <p className={styles.label}>Адрес</p>
                <p className={styles.value}>Berlin, Deutschland</p>
              </div>
            </div>
            <div className={styles.item}>
              <span>🕐</span>
              <div>
                <p className={styles.label}>Режим работы</p>
                <p className={styles.value}>Пн–Пт: 10:00–20:00</p>
                <p className={styles.value}>Сб–Вс: 12:00–18:00</p>
              </div>
            </div>
          </div>

          <form className={styles.form} onSubmit={e => e.preventDefault()}>
            <h2>Написать нам</h2>
            <input placeholder="Ваше имя" />
            <input type="email" placeholder="Email" />
            <textarea rows={4} placeholder="Ваше сообщение..." />
            <button type="submit">Отправить</button>
          </form>
        </div>
      </div>
    </main>
  );
}
