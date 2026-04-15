import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { products as initialProducts } from '../../data/products';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_ok') === '1');
  // Пароль хранится в памяти для API-запросов (не в localStorage)
  const adminPasswordRef = useRef(sessionStorage.getItem('admin_pw') || '');

  const [orders, setOrders] = useState([]);

  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem('dragon_products');
      return saved ? JSON.parse(saved) : initialProducts;
    } catch { return initialProducts; }
  });

  const [couriers, setCouriers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dragon_couriers') || '[]'); } catch { return []; }
  });

  // Загружаем заказы из API бота при входе
  useEffect(() => {
    if (!authed) return;
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch('/api/orders', { headers: { 'x-admin-password': pw } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setOrders(data); })
      .catch(() => {});
  }, [authed]);

  useEffect(() => {
    localStorage.setItem('dragon_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('dragon_couriers', JSON.stringify(couriers));
  }, [couriers]);

  const login = async (password) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem('admin_ok', '1');
        sessionStorage.setItem('admin_pw', password);
        adminPasswordRef.current = password;
        setAuthed(true);
        return true;
      }
    } catch {}
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem('admin_ok');
    sessionStorage.removeItem('admin_pw');
    adminPasswordRef.current = '';
    setAuthed(false);
    setOrders([]);
  };

  const addOrder = (order) => {
    const newOrder = {
      ...order,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'new',
    };
    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateOrderStatus = async (id, status) => {
    // Обновляем локально сразу
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    // Сохраняем в API
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch(`/api/orders?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  };

  const addProduct = (product) => {
    const newProduct = { ...product, id: Date.now() };
    setProducts(prev => [newProduct, ...prev]);
  };

  const updateProduct = (id, data) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const deleteProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addCourier = (courier) => {
    setCouriers(prev => [...prev, { ...courier, id: Date.now() }]);
  };

  const updateCourier = (id, data) => {
    setCouriers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCourier = (id) => {
    setCouriers(prev => prev.filter(c => c.id !== id));
  };

  // Находит курьера по городу (для OrderModal)
  const getCourierForCity = (city) => {
    return couriers.find(c => c.cities && c.cities.includes(city)) || null;
  };

  const customers = Object.values(
    orders.reduce((acc, order) => {
      const key = order.email;
      if (!acc[key]) {
        acc[key] = { name: order.name, email: order.email, phone: order.phone, city: order.city, orders: 0, spent: 0 };
      }
      acc[key].orders += 1;
      acc[key].spent += order.total || 0;
      return acc;
    }, {})
  );

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <AdminContext.Provider value={{
      authed, login, logout,
      orders, addOrder, updateOrderStatus,
      products, addProduct, updateProduct, deleteProduct,
      couriers, addCourier, updateCourier, deleteCourier, getCourierForCity,
      customers, revenue,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
