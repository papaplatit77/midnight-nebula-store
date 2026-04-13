import { Link } from 'react-router-dom';
import styles from './About.module.css';

export default function About() {
  return (
    <main className={styles.page}>

      {/* ── КТО МЫ ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.heroLabel}>КТО МЫ?</p>
          <h1 className={styles.heroTitle}>
            Один из топов <span>NRW</span>
          </h1>
          <p className={styles.heroText}>
            Жидкости и под-системы, одноразки и картриджи — в наличии всегда актуальный
            ассортимент для твоих предпочтений.
          </p>
          <Link to="/" className={styles.heroBtn}>Перейти в каталог →</Link>
        </div>
        <div className={styles.heroGlow} />
      </section>

      {/* ── НАШИ ПЛЮСЫ ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>НАШИ ПЛЮСЫ</p>

          <div className={styles.plusGrid}>

            {/* УСЛОВИЯ */}
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>⚡</div>
              <h3>УСЛОВИЯ</h3>
              <p>
                Прозрачные условия и честные цены без скрытых наценок.
                Одни из самых доступных предложений на рынке.
                Доставка без задержек.
              </p>
            </div>

            {/* ОПТОВЫЕ ПАРТИИ */}
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>📦</div>
              <h3>ОПТОВЫЕ ПАРТИИ</h3>
              <p>
                Работаем и с оптом — выгодно для тех, кто занимается перепродажей.
                Объёмы и условия обсуждаются отдельно.
              </p>
            </div>

            {/* ГАРАНТИЯ КАЧЕСТВА */}
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>🏆</div>
              <h3>ГАРАНТИЯ КАЧЕСТВА</h3>
              <p>
                Мы гарантируем доставку без сбоев и в надлежащем состоянии.
                Не на словах — за нас говорят сотни отзывов от тех, кто уже получил,
                проверил и вернулся.
              </p>
            </div>

            {/* ОПЛАТА */}
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>💳</div>
              <h3>ОПЛАТА</h3>
              <p>
                Проблемы с картой или наличными — не повод откладывать заказ.
                Мы принимаем разные варианты оплаты.
              </p>
              <div className={styles.payMethods}>
                <span>💵 Наличные</span>
                <span>💳 Банковская карта</span>
              </div>
            </div>

            {/* ТЕХ. ПОДДЕРЖКА */}
            <div className={`${styles.plusCard} ${styles.plusCardWide}`}>
              <div className={styles.plusIcon}>💬</div>
              <h3>ТЕХ. ПОДДЕРЖКА</h3>
              <p>Остались вопросы? — пиши, дадим ответ на каждый!</p>
              <Link to="/contacts" className={styles.askBtn}>ЗАДАТЬ ВОПРОС</Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── ОТЗЫВЫ / WAKASHOP ── */}
      <section className={styles.reviewSection}>
        <div className={styles.reviewInner}>
          <div className={styles.reviewCard}>
            <p className={styles.reviewBrand}>WAKASHOP</p>
            <p className={styles.reviewText}>Мы ценим обратную связь.</p>
            <p className={styles.reviewSub}>Оставь отзыв и помоги другим сделать выбор.</p>
            <Link to="/contacts" className={styles.reviewBtn}>ОСТАВИТЬ ОТЗЫВ</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM INFO ── */}
      <section className={styles.bottomSection}>
        <div className={styles.bottomInner}>

          <div className={styles.bottomBrand}>
            <p className={styles.bottomName}>WAKASHOP</p>
            <p className={styles.bottomGeo}>NORDRHEIN-WESTFALEN</p>
            <p className={styles.bottomGeo}>DEUTSCHLAND</p>
            <p className={styles.bottomClub}>◎ Wakashop Club</p>
          </div>

          <div className={styles.bottomNav}>
            <p className={styles.bottomNavTitle}>НАВИГАЦИЯ</p>
            <Link to="/">ГЛАВНАЯ</Link>
            <Link to="/about">О НАС</Link>
            <Link to="/contacts">ОТЗЫВЫ</Link>
          </div>

        </div>

        <div className={styles.bottomFooter}>
          <p>© WAKASHOP | 2025</p>
          <p className={styles.bottomSlogan}>МЫ ПРОСТО ЛУЧШЕ ДРУГИХ</p>
          <p className={styles.bottomCredit}>BUILD FOR NRW · BY TALLSMAN &amp; D9FFICK</p>
        </div>
      </section>

    </main>
  );
}
