import { Link } from 'react-router-dom';
import styles from './About.module.css';

const STEPS = [
  { n:'01', title:'Выбираешь товары',  desc:'Открываешь каталог, находишь нужное — жидкости, поды, одноразки, картриджи или снюс. Широкий выбор, актуальный ассортимент.' },
  { n:'02', title:'Оформляешь заказ',  desc:'Нажимаешь «Заказать», выбираешь способ доставки и оплаты. Занимает меньше минуты.' },
  { n:'03', title:'Получаешь подтверждение', desc:'Менеджер пишет в Telegram, подтверждает заказ и называет точное время встречи или отправки.' },
  { n:'04', title:'Забираешь или ждёшь', desc:'Личная встреча в твоём городе — или посылка DHL. Всё строго в оговорённые сроки.' },
];

const FACTS = [
  { num:'600+',   label:'клиентов по NRW' },
  { num:'120+',   label:'позиций в наличии' },
  { num:'1 день', label:'срок доставки' },
  { num:'2024',   label:'год открытия' },
];

export default function About() {
  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <p className={styles.heroEyebrow}>MIDNIGHT NEBULA STORE</p>
          <h1 className={styles.heroTitle}>
            Вейп-магазин<br />
            <span>нового поколения</span>
          </h1>
          <p className={styles.heroDesc}>
            Работаем честно и быстро. Только оригинальная продукция,
            прозрачные цены и доставка в день заказа по всему NRW.
          </p>
          <Link to="/" className={styles.heroBtn}>Открыть каталог →</Link>
        </div>
      </section>

      {/* Цифры */}
      <div className={styles.factsRow}>
        {FACTS.map(f => (
          <div key={f.num} className={styles.factItem}>
            <span className={styles.factNum}>{f.num}</span>
            <span className={styles.factLabel}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Как это работает */}
      <section className={styles.stepsSection}>
        <div className={styles.inner}>
          <p className={styles.sectionEye}>КАК МЫ РАБОТАЕМ</p>
          <div className={styles.stepsGrid}>
            {STEPS.map(s => (
              <div key={s.n} className={styles.stepCard}>
                <span className={styles.stepNum}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className={styles.advantagesSection}>
        <div className={styles.inner}>
          <p className={styles.sectionEye}>ПОЧЕМУ ВЫБИРАЮТ НАС</p>
          <div className={styles.advantagesGrid}>
            {[
              { title:'Оригинальный товар',       desc:'Работаем только с проверенными поставщиками. Никаких подделок — на кону наша репутация.' },
              { title:'Прозрачные цены',           desc:'Цена в каталоге = цена при получении. Никаких доп. сборов, никаких сюрпризов.' },
              { title:'Быстрая доставка',          desc:'Заказал до 18:00 — привезём в тот же день. По всему NRW: Дортмунд, Кёльн, Дюссельдорф и не только.' },
              { title:'Несколько способов оплаты', desc:'Наличные, карта или крипто — платишь так, как тебе удобнее. Никакой предоплаты.' },
              { title:'Поддержка в Telegram',      desc:'Менеджер отвечает быстро. Любые вопросы по заказу, составу, совместимости — пиши смело.' },
              { title:'Дискретная упаковка',       desc:'Снаружи ничего лишнего. Обычная посылка без каких-либо надписей о содержимом.' },
            ].map(a => (
              <div key={a.title} className={styles.advCard}>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <div className={styles.ctaGlow} />
          <h2>Готов попробовать?</h2>
          <p>Открой каталог и сделай первый заказ — всё просто.</p>
          <Link to="/" className={styles.ctaBtn}>Перейти в каталог</Link>
        </div>
      </section>

    </main>
  );
}
