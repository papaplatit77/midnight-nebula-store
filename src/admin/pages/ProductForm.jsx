import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import styles from './ProductForm.module.css';

const CATEGORIES = [
  { value: 'disposable', label: 'Одноразки' },
  { value: 'pods',       label: 'Поды' },
  { value: 'liquids',    label: 'Жидкости' },
  { value: 'accessories',label: 'Расходники' },
];

const CAT_ICON = { disposable:'💨', pods:'🔋', liquids:'💧', accessories:'🔧' };

const EMPTY = {
  name: '', category: 'disposable', price: '', oldPrice: '',
  puffs: '', nicotine: '', description: '', inStock: true, shippable: true,
  tags: [], image: null,
};

// Сжимает изображение до max 600px и возвращает base64
function compressImage(file) {
  return new Promise((resolve) => {
    const MAX = 600;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductForm() {
  const { id } = useParams();
  const { products, addProduct, updateProduct } = useAdmin();
  const navigate = useNavigate();
  const isEdit = id !== 'new';
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const existing = isEdit ? products.find(p => String(p.id) === id) : null;
  const [form, setForm] = useState(existing ? {
    ...existing,
    price:    String(existing.price),
    oldPrice: existing.oldPrice ? String(existing.oldPrice) : '',
    puffs:    existing.puffs    ? String(existing.puffs)    : '',
    nicotine: existing.nicotine != null ? String(existing.nicotine) : '',
    image:    existing.image || null,
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const [saved,  setSaved]  = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    setErrors(err => ({ ...err, [k]: undefined }));
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags?.includes(tag)
        ? f.tags.filter(t => t !== tag)
        : [...(f.tags || []), tag],
    }));
  };

  // Обработка файла (из input или drag&drop)
  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImgLoading(true);
    try {
      const base64 = await compressImage(file);
      setForm(f => ({ ...f, image: base64 }));
    } finally {
      setImgLoading(false);
    }
  };

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Введите название';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'Введите корректную цену';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const data = {
      ...form,
      price:    parseFloat(form.price),
      oldPrice: form.oldPrice ? parseFloat(form.oldPrice) : null,
      puffs:    form.puffs    ? parseInt(form.puffs)      : null,
      nicotine: form.nicotine !== '' ? parseInt(form.nicotine) : null,
    };

    isEdit ? updateProduct(Number(id), data) : addProduct(data);
    setSaved(true);
    setTimeout(() => navigate('/admin/products'), 900);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/products')}>← Товары</button>
        <h1>{isEdit ? 'Редактировать товар' : 'Новый товар'}</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.grid}>

          {/* ── Фото ── */}
          <div className={styles.card}>
            <h2>Фотография</h2>

            {/* Зона загрузки */}
            <div
              className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''} ${form.image ? styles.dropZoneHasImg : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {imgLoading ? (
                <div className={styles.dropLoading}>
                  <span className={styles.spinner} />
                  <p>Обработка...</p>
                </div>
              ) : form.image ? (
                <>
                  <img src={form.image} alt="preview" className={styles.dropPreview} />
                  <div className={styles.dropOverlay}>
                    <span>🔄 Заменить</span>
                  </div>
                </>
              ) : (
                <div className={styles.dropPlaceholder}>
                  <span className={styles.dropIcon}>📷</span>
                  <p className={styles.dropText}>Нажмите или перетащите фото</p>
                  <p className={styles.dropHint}>JPG, PNG, WEBP · до 10 МБ</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileInput}
            />

            {form.image && (
              <button
                type="button"
                className={styles.removeImgBtn}
                onClick={() => setForm(f => ({ ...f, image: null }))}
              >
                ✕ Удалить фото
              </button>
            )}
          </div>

          {/* ── Основная информация ── */}
          <div className={styles.card}>
            <h2>Основная информация</h2>

            <div className={styles.field}>
              <label>Название *</label>
              <input placeholder="Elfbar 600 — Blueberry Ice" value={form.name} onChange={set('name')} />
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>

            <div className={styles.field}>
              <label>Категория</label>
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label>Описание</label>
              <textarea rows={4} placeholder="Описание товара..." value={form.description} onChange={set('description')} />
            </div>
          </div>

          {/* ── Цена и характеристики ── */}
          <div className={styles.card}>
            <h2>Цена и характеристики</h2>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Цена (€) *</label>
                <input type="number" step="0.01" min="0" placeholder="9.99" value={form.price} onChange={set('price')} />
                {errors.price && <span className={styles.error}>{errors.price}</span>}
              </div>
              <div className={styles.field}>
                <label>Старая цена (€)</label>
                <input type="number" step="0.01" min="0" placeholder="12.99" value={form.oldPrice} onChange={set('oldPrice')} />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Затяжек</label>
                <input type="number" min="0" placeholder="600" value={form.puffs} onChange={set('puffs')} />
              </div>
              <div className={styles.field}>
                <label>Никотин (мг)</label>
                <input type="number" min="0" placeholder="20" value={form.nicotine} onChange={set('nicotine')} />
              </div>
            </div>

            <div className={styles.field}>
              <label>Теги</label>
              <div className={styles.tags}>
                {['хит','новинка','скидка'].map(tag => (
                  <button
                    key={tag} type="button"
                    className={`${styles.tagBtn} ${form.tags?.includes(tag) ? styles.tagActive : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.stockToggle}>
              <input type="checkbox" checked={form.inStock} onChange={set('inStock')} />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.stockLabel}>
                {form.inStock ? '✓ В наличии' : '✕ Нет в наличии'}
              </span>
            </label>

            <label className={styles.stockToggle} style={{ marginTop: '8px' }}>
              <input type="checkbox" checked={form.shippable !== false} onChange={e => setForm(f => ({ ...f, shippable: e.target.checked }))} />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.stockLabel}>
                {form.shippable !== false ? '📬 Доступен для почты' : '🚫 Только самовывоз/курьер'}
              </span>
            </label>
          </div>
        </div>

        {/* ── Предпросмотр ── */}
        <div className={styles.card}>
          <h2>Предпросмотр карточки</h2>
          <div className={styles.preview}>
            <div className={styles.previewIcon}>
              {form.image
                ? <img src={form.image} alt="" className={styles.previewImg} />
                : (CAT_ICON[form.category] || '📦')
              }
            </div>
            <div className={styles.previewInfo}>
              <div className={styles.previewCat}>{CATEGORIES.find(c=>c.value===form.category)?.label}</div>
              <div className={styles.previewName}>{form.name || 'Название товара'}</div>
              <div className={styles.previewPrice}>
                {form.price ? `${parseFloat(form.price||0).toFixed(2)} €` : '0.00 €'}
                {form.oldPrice && <span>{parseFloat(form.oldPrice).toFixed(2)} €</span>}
              </div>
              <div className={styles.previewTags}>
                {form.tags?.map(t => <span key={t}>{t}</span>)}
                <span className={form.inStock ? styles.inStock : styles.outStock}>
                  {form.inStock ? 'В наличии' : 'Нет в наличии'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/admin/products')}>
            Отмена
          </button>
          <button type="submit" className={`${styles.saveBtn} ${saved ? styles.savedBtn : ''}`}>
            {saved ? '✓ Сохранено!' : (isEdit ? 'Сохранить изменения' : 'Добавить товар')}
          </button>
        </div>
      </form>
    </div>
  );
}
