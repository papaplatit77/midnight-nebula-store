import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import styles from './Products.module.css';

const CAT_NAMES = { disposable:'Одноразки', pods:'Поды', liquids:'Жидкости', accessories:'Расходники' };
const CAT_ICONS = { disposable:'💨', pods:'🔋', liquids:'💧', accessories:'🔧' };

export default function Products() {
  const { products, deleteProduct } = useAdmin();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [confirm, setConfirm] = useState(null);

  const filtered = products.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = (id) => {
    deleteProduct(id);
    setConfirm(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Товары</h1>
          <span className={styles.count}>{products.length}</span>
        </div>
        <Link to="/admin/products/new" className={styles.addBtn}>+ Добавить товар</Link>
      </div>

      <div className={styles.controls}>
        <div className={styles.cats}>
          {['all','disposable','pods','liquids','accessories'].map(c => (
            <button
              key={c}
              className={cat === c ? `${styles.cat} ${styles.catActive}` : styles.cat}
              onClick={() => setCat(c)}
            >
              {c === 'all' ? 'Все' : CAT_NAMES[c]}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Поиск товара..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.grid}>
        {filtered.map(product => (
          <div key={product.id} className={styles.card}>
            <div className={styles.cardImage}>
              <span>{CAT_ICONS[product.category] || '📦'}</span>
              {!product.inStock && <div className={styles.outStock}>Нет в наличии</div>}
              {product.tags?.includes('хит') && <span className={styles.tag} style={{background:'rgba(0,180,255,0.75)'}}>Хит</span>}
              {product.tags?.includes('новинка') && <span className={styles.tag} style={{background:'rgba(52,211,153,0.75)'}}>Новинка</span>}
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardCat}>{CAT_NAMES[product.category]}</div>
              <div className={styles.cardName}>{product.name}</div>
              <div className={styles.cardPrice}>
                <span className={styles.price}>{product.price.toFixed(2)} €</span>
                {product.oldPrice && <span className={styles.oldPrice}>{product.oldPrice.toFixed(2)} €</span>}
              </div>
              <div className={styles.cardActions}>
                <Link to={`/admin/products/${product.id}`} className={styles.editBtn}>Изменить</Link>
                <button className={styles.delBtn} onClick={() => setConfirm(product.id)}>Удалить</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className={styles.empty}><span>🔍</span><p>Товары не найдены</p></div>
      )}

      {/* Confirm delete modal */}
      {confirm && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Удалить товар?</h3>
            <p>Это действие нельзя отменить.</p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirm(null)}>Отмена</button>
              <button className={styles.confirmBtn} onClick={() => handleDelete(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
