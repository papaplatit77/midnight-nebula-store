import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import styles from './ProductCard.module.css';

const CATEGORY_ICONS = {
  disposable: '💨',
  pods: '🔋',
  liquids: '💧',
  accessories: '🔧',
};

export default function ProductCard({ product }) {
  const { add } = useCart();

  return (
    <div className={styles.card}>
      <Link to={`/product/${product.id}`} className={styles.imageWrap}>
        {product.image ? (
          <img src={product.image} alt={product.name} className={styles.productImage} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>{CATEGORY_ICONS[product.category] || '📦'}</span>
          </div>
        )}
        {product.tags?.includes('хит') && <span className={styles.tagHit}>Хит</span>}
        {product.tags?.includes('новинка') && <span className={styles.tagNew}>Новинка</span>}
        {product.tags?.includes('скидка') && <span className={styles.tagSale}>Скидка</span>}
        {!product.inStock && <div className={styles.outOfStock}>Нет в наличии</div>}
      </Link>

      <div className={styles.body}>
        <Link to={`/product/${product.id}`} className={styles.name}>
          {product.name}
        </Link>

        <div className={styles.meta}>
          {product.puffs && <span>{product.puffs} затяжек</span>}
          {product.nicotine != null && <span>{product.nicotine}мг никотин</span>}
        </div>

        <div className={styles.footer}>
          <div className={styles.prices}>
            <span className={styles.price}>{product.price.toFixed(2)} €</span>
            {product.oldPrice && (
              <span className={styles.oldPrice}>{product.oldPrice.toFixed(2)} €</span>
            )}
          </div>
          <button
            className={styles.addBtn}
            disabled={!product.inStock}
            onClick={() => product.inStock && add(product)}
          >
            {product.inStock ? '+' : '✕'}
          </button>
        </div>
      </div>
    </div>
  );
}
