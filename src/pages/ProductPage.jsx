import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAdmin } from '../admin/context/AdminContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import styles from './ProductPage.module.css';

const CATEGORY_ICONS = {
  disposable: '💨', pods: '🔋', liquids: '💧', accessories: '🔧',
};
const CATEGORY_NAMES = {
  disposable: 'Одноразки', pods: 'Поды', liquids: 'Жидкости', accessories: 'Расходники',
};

export default function ProductPage() {
  const { id } = useParams();
  const { products } = useAdmin();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const product = products.find(p => p.id === Number(id));

  if (!product) {
    return (
      <div className={styles.notFound}>
        <span>😔</span>
        <p>Товар не найден</p>
        <Link to="/" className={styles.backLink}>← Вернуться в каталог</Link>
      </div>
    );
  }

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleAdd = () => {
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Link to="/">Главная</Link>
          <span>/</span>
          <Link to="/catalog">{CATEGORY_NAMES[product.category]}</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        {/* Product */}
        <div className={styles.product}>
          <div className={styles.imageWrap}>
            {product.image ? (
              <img src={product.image} alt={product.name} className={styles.productImg} />
            ) : (
              <div className={styles.image}>
                <span>{CATEGORY_ICONS[product.category]}</span>
              </div>
            )}
            {product.tags?.includes('хит') && <span className={styles.tagHit}>Хит</span>}
            {product.tags?.includes('новинка') && <span className={styles.tagNew}>Новинка</span>}
          </div>

          <div className={styles.info}>
            <p className={styles.category}>{CATEGORY_NAMES[product.category]}</p>
            <h1>{product.name}</h1>

            <div className={styles.badges}>
              {product.puffs && <span>💨 {product.puffs} затяжек</span>}
              {product.nicotine != null && <span>⚡ {product.nicotine}мг никотин</span>}
              <span className={product.inStock ? styles.inStock : styles.outStock}>
                {product.inStock ? '✓ В наличии' : '✕ Нет в наличии'}
              </span>
            </div>

            <p className={styles.description}>{product.description}</p>

            <div className={styles.priceRow}>
              <div>
                <span className={styles.price}>{product.price.toFixed(2)} €</span>
                {product.oldPrice && (
                  <span className={styles.oldPrice}>{product.oldPrice.toFixed(2)} €</span>
                )}
              </div>
              {product.oldPrice && (
                <span className={styles.discount}>
                  -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                </span>
              )}
            </div>

            {product.inStock && (
              <div className={styles.actions}>
                <div className={styles.qtyControl}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(q => q + 1)}>+</button>
                </div>
                <button
                  className={`${styles.addBtn} ${added ? styles.addedBtn : ''}`}
                  onClick={handleAdd}
                >
                  {added ? '✓ Добавлено!' : 'В корзину'}
                </button>
              </div>
            )}

            <div className={styles.perks}>
              <div className={styles.perk}><span>🚚</span> Доставка по всей Германии</div>
              <div className={styles.perk}><span>✅</span> Только оригинальная продукция</div>
              <div className={styles.perk}><span>🔞</span> Только для лиц 18+</div>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className={styles.related}>
            <h2>Похожие товары</h2>
            <div className={styles.relatedGrid}>
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
