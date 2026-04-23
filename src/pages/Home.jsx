import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import OrderModal from '../components/OrderModal';
import styles from './Home.module.css';

const REVIEWS = [
  { id: 1, name: 'Max S.',    city: 'Dortmund',   avatar: 'MS', color: '#7c00d4', rating: 5, text: 'Лучший шоп в NRW! Всё быстро, качество топ. Уже 3-й заказ подряд, ни разу не разочаровал.' },
  { id: 2, name: 'Anya K.',   city: 'Köln',        avatar: 'AK', color: '#b300ff', rating: 5, text: 'Elfbar пришёл за день, всё запаковано как надо. Буду ещё заказывать, однозначно 🔥' },
  { id: 3, name: 'Denis M.',  city: 'Düsseldorf',  avatar: 'DM', color: '#9000e0', rating: 5, text: 'Оптом брал — цены адекватные, всё чётко, без лишних вопросов и задержек. Топ.' },
  { id: 4, name: 'Lena V.',   city: 'Essen',       avatar: 'LV', color: '#c000ff', rating: 5, text: 'Крутой ассортимент, нашла наконец свой вкус. Очень рекомендую всем девчонкам!' },
  { id: 5, name: 'Igor T.',   city: 'Bochum',      avatar: 'IT', color: '#6e00bb', rating: 5, text: 'Первый раз заказывал — понравилось. Встреча была быстрой и без лишних слов. Всё по делу.' },
  { id: 6, name: 'Sasha R.',  city: 'Duisburg',    avatar: 'SR', color: '#a000ef', rating: 5, text: 'Порядок! Деньги — товар, всё честно и быстро. Уважаю за прозрачность условий.' },
];

export default function Home() {
  const [orderOpen, setOrderOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Открываем модал если пришли с ?order=1 (например из корзины)
  useEffect(() => {
    if (searchParams.get('order') === '1') {
      setOrderOpen(true);
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <main className={styles.page}>

      {/* ══ HERO ══ */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroParticles}>
          {[...Array(8)].map((_, i) => <span key={i} className={styles.particle} style={{ '--i': i }} />)}
        </div>
        <div className={styles.heroContent}>
          <p className={styles.heroTag}>◎ NRW · Vape Store · Deutschland</p>
          <span className={styles.heroLogoWrap}>
            <span className={styles.heroLogoGlow} aria-hidden="true">WAKASHOP</span>
            <h1 className={styles.heroLogo}>WAKASHOP</h1>
          </span>
          <p className={styles.heroSub}>
            Жидкости, под-системы, одноразки и картриджи.<br />
            Актуальный ассортимент — всегда в наличии.
          </p>
          <button className={styles.orderBtn} onClick={() => setOrderOpen(true)}>
            <span className={styles.orderBtnInner}>ЗАКАЗАТЬ</span>
            <span className={styles.orderBtnGlow} />
          </button>
          <a
            href="https://t.me/Manager_NRW_1"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.wholesaleBtn}
          >
            ОПТОМ
          </a>
          <p className={styles.heroHint}>Доставка по NRW · Личная встреча · Почта</p>
        </div>
        <div className={styles.heroScroll}>
          <span />
          <span />
          <span />
        </div>
      </section>

      {/* ══ КТО МЫ ══ */}
      <section className={styles.section} id="about">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>КТО МЫ?</div>
          <div className={styles.whoGrid}>
            <div className={styles.whoText}>
              <h2>Один из топов <span>NRW</span></h2>
              <p>
                Работаем честно — актуальный ассортимент, быстрая доставка
                и сотни довольных клиентов, которые возвращаются снова.
              </p>
              <p className={styles.notifyTeaser}>
                Ждёшь любимый товар? Включи уведомления и получай новости о поставках!
              </p>
              <div className={styles.whoActions}>
                <button className={styles.whoBtn} onClick={() => setOrderOpen(true)}>
                  Сделать заказ →
                </button>
                <a
                  href="https://t.me/Manager_NRW_1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.subscribeBtn}
                >
                  ПОДПИСАТЬСЯ
                </a>
              </div>
            </div>
            <div className={styles.whoStats}>
              <div className={styles.statBox}>
                <span className={styles.statNum}>500+</span>
                <span className={styles.statLbl}>довольных клиентов</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNum}>100+</span>
                <span className={styles.statLbl}>позиций в каталоге</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNum}>NRW</span>
                <span className={styles.statLbl}>вся область</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNum}>1 день</span>
                <span className={styles.statLbl}>скорость доставки</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ НАШИ ПЛЮСЫ ══ */}
      <section className={styles.plusSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>НАШИ ПЛЮСЫ</div>
          <div className={styles.plusGrid}>
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>⚡</div>
              <h3>УСЛОВИЯ</h3>
              <p>Прозрачные условия и честные цены без скрытых наценок. Одни из самых доступных на рынке. Доставка без задержек.</p>
            </div>
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>📦</div>
              <h3>ОПТОВЫЕ ПАРТИИ</h3>
              <p>Работаем и с оптом — выгодно для тех, кто занимается перепродажей. Объёмы и условия обсуждаются отдельно.</p>
            </div>
            <div className={styles.plusCard}>
              <div className={styles.plusIcon}>🏆</div>
              <h3>ГАРАНТИЯ КАЧЕСТВА</h3>
              <p>Гарантируем доставку без сбоев и в надлежащем состоянии. За нас говорят сотни отзывов от постоянных клиентов.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ОПЛАТА + ПОДДЕРЖКА ══ */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.payGrid}>
            <div className={styles.payCard}>
              <div className={styles.payIcon}>💳</div>
              <h3>ОПЛАТА</h3>
              <p>Проблемы с картой или наличными — не повод откладывать заказ. Принимаем разные варианты.</p>
              <div className={styles.payMethods}>
                <span>💵 Наличные</span>
                <span>💳 Банковская карта</span>
              </div>
            </div>
            <div className={styles.payCard}>
              <div className={styles.payIcon}>💬</div>
              <h3>ТЕХ. ПОДДЕРЖКА</h3>
              <p>Остались вопросы? Пиши — дадим ответ на каждый. Работаем быстро и по делу.</p>
              <Link to="/contacts" className={styles.supportBtn}>ЗАДАТЬ ВОПРОС</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ОТЗЫВЫ ══ */}
      <section className={styles.reviewsSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>ОТЗЫВЫ</div>
          <h2 className={styles.reviewsTitle}>Нам доверяют</h2>
          <div className={styles.reviewsTrackWrap}>
            <div className={styles.reviewsTrack}>
              {REVIEWS.map(r => (
                <div key={r.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <div className={styles.reviewAvatar} style={{ background: `linear-gradient(135deg, ${r.color}, #d966ff)` }}>
                      {r.avatar}
                    </div>
                    <div>
                      <p className={styles.reviewName}>{r.name}</p>
                      <p className={styles.reviewCity}>📍 {r.city}</p>
                    </div>
                    <div className={styles.reviewStars}>{'★'.repeat(r.rating)}</div>
                  </div>
                  <p className={styles.reviewText}>"{r.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ ОБРАТНАЯ СВЯЗЬ ══ */}
      <section className={styles.feedbackSection}>
        <div className={styles.sectionInner}>
          <div className={styles.feedbackCard}>
            <p className={styles.feedbackBrand}>WAKASHOP</p>
            <h2>Мы ценим обратную связь</h2>
            <p>Оставь отзыв и помоги другим сделать выбор.</p>
            <Link to="/contacts" className={styles.feedbackBtn}>ОСТАВИТЬ ОТЗЫВ</Link>
          </div>
        </div>
      </section>

      {/* ══ ORDER MODAL ══ */}
      {orderOpen && <OrderModal onClose={() => setOrderOpen(false)} />}
    </main>
  );
}
