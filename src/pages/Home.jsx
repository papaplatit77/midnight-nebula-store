import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import OrderModal from '../components/OrderModal';
import styles from './Home.module.css';

const MANAGER_TG = 'midnight_nebula_manager';

function openTg(username) {
  const url = `https://t.me/${username}`;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

const INFO_CARDS = [
  {
    num: '600+',
    title: 'Довольных клиентов',
    text: 'Более 600 постоянных покупателей по всему NRW возвращаются к нам снова и снова. Репутацию строим на честности — никаких сюрпризов при получении заказа.',
  },
  {
    num: '120+',
    title: 'Позиций в каталоге',
    text: 'Жидкости, поды, одноразки, картриджи и снюс — широкий ассортимент, который регулярно обновляется. Всегда есть что выбрать под любой вкус и бюджет.',
  },
  {
    num: 'NRW',
    title: 'Весь регион',
    text: 'Работаем по всему Nordrhein-Westfalen: Дортмунд, Кёльн, Дюссельдорф, Эссен, Дуйсбург, Бохум и другие города. Вся область — наша зона доставки.',
  },
  {
    num: '1 день',
    title: 'Скорость доставки',
    text: 'Заказал до 18:00 — курьер приедет в тот же день. Личная встреча или Почта Германии — выбираешь сам. Подтверждение и трекинг через Telegram.',
  },
];

const FEATURES = [
  { num:'01', title: 'Быстрая доставка', desc: 'Курьер в день заказа по всему NRW. Личная встреча или почта — на твой выбор.' },
  { num:'02', title: 'Большой каталог', desc: '120+ позиций. Постоянно обновляем ассортимент и добавляем новинки.' },
  { num:'03', title: 'Честные цены', desc: 'Цена в каталоге = цена при получении. Никаких скрытых наценок и сюрпризов.' },
  { num:'04', title: 'Гарантия оригинала', desc: 'Работаем только с проверенными поставщиками. За качество отвечаем без вопросов.' },
];

export default function Home() {
  const [orderOpen, setOrderOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
          {[...Array(10)].map((_, i) => <span key={i} className={styles.particle} style={{ '--i': i }} />)}
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroTitle}>
            <div className={styles.heroLine1}>
              <span className={styles.heroWord1}>MIDNIGHT</span>
              <span className={styles.heroWord2}>NEBULA</span>
            </div>
            <div className={styles.heroLine2}>STORE</div>
          </div>

          <button className={styles.orderBtn} onClick={() => setOrderOpen(true)}>
            <span className={styles.orderBtnInner}>КУПИТЬ</span>
            <span className={styles.orderBtnGlow} />
          </button>
        </div>
      </section>

      {/* ══ INFO CARDS ══ */}
      <section className={styles.infoSection}>
        <div className={styles.sectionInner}>
          <div className={styles.infoGrid}>
            {INFO_CARDS.map(c => (
              <div key={c.num} className={styles.infoCard}>
                <span className={styles.infoNum}>{c.num}</span>
                <h3 className={styles.infoTitle}>{c.title}</h3>
                <p className={styles.infoText}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>ПОЧЕМУ МЫ</p>
          <div className={styles.featuresGrid}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <span className={styles.featureNum}>{f.num}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ОПЛАТА ══ */}
      <section className={styles.paySection}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>ОПЛАТА</p>
          <div className={styles.payGrid}>
            <div className={styles.payCard}>
              <div className={styles.payCardTop}>
                <span className={styles.payCardTag}>01</span>
                <h3>Наличные</h3>
              </div>
              <p>Оплата курьеру при получении — самый простой вариант. Без предоплаты, без рисков. Сдача всегда есть.</p>
            </div>
            <div className={styles.payCard}>
              <div className={styles.payCardTop}>
                <span className={styles.payCardTag}>02</span>
                <h3>Банковская карта</h3>
              </div>
              <p>Перевод по номеру карты или через банковское приложение. Visa, Mastercard, любой немецкий банк.</p>
            </div>
            <div className={styles.payCard}>
              <div className={styles.payCardTop}>
                <span className={styles.payCardTag}>03</span>
                <h3>Криптовалюта</h3>
              </div>
              <p>Принимаем USDT (TRC-20 / ERC-20), Bitcoin и Ethereum. Адрес кошелька выдаётся менеджером при оформлении.</p>
            </div>
          </div>
          <div className={styles.payContact}>
            <p>Есть вопросы по оплате или заказу?</p>
            <button onClick={() => openTg(MANAGER_TG)} className={styles.tgBtn}>
              Написать менеджеру в Telegram
            </button>
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <div className={styles.ctaGlow} />
          <p className={styles.ctaLabel}>MIDNIGHT NEBULA STORE</p>
          <h2 className={styles.ctaTitle}>Готов сделать заказ?</h2>
          <p className={styles.ctaSub}>Напиши менеджеру или сразу открой каталог — отвечаем быстро, работаем честно.</p>
          <div className={styles.ctaActions}>
            <button className={styles.ctaOrder} onClick={() => setOrderOpen(true)}>
              Открыть каталог
            </button>
            <button className={styles.ctaTg} onClick={() => openTg(MANAGER_TG)}>
              Telegram →
            </button>
          </div>
        </div>
      </section>

      {orderOpen && <OrderModal onClose={() => setOrderOpen(false)} />}
    </main>
  );
}
