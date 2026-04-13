import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdmin } from '../admin/context/AdminContext';
import { categories } from '../data/products';
import ProductCard from '../components/ProductCard';
import styles from './Catalog.module.css';

const SORT_OPTIONS = [
  { value: 'default',    label: 'По умолчанию' },
  { value: 'price_asc',  label: '↑ Дешевле' },
  { value: 'price_desc', label: '↓ Дороже' },
];

export default function Catalog() {
  const { products } = useAdmin();
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const [sort, setSort] = useState('default');

  const query = searchParams.get('q') || '';

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
    if (query) list = list.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'price_asc')  list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, activeCategory, query, sort]);

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1>Лучший выбор <span>вейп-товаров</span></h1>
        <p>Доставка по всей Германии · Только оригинальная продукция</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.categories}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={activeCategory === cat.id ? styles.catActive : styles.cat}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Красивые кнопки сортировки */}
        <div className={styles.sortRow}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.sortBtn} ${sort === opt.value ? styles.sortBtnActive : ''}`}
              onClick={() => setSort(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {query && (
        <p className={styles.searchInfo}>
          Результаты по запросу: «{query}» — {filtered.length} товаров
        </p>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>😔</span>
          <p>Товары не найдены</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </main>
  );
}
