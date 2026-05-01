import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { products as initialProducts } from '../../data/products';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem('admin_ok') === '1');
  // Пароль хранится в памяти для API-запросов (не в localStorage)
  const adminPasswordRef = useRef(localStorage.getItem('admin_pw') || '');

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);

  const [products, setProducts] = useState(initialProducts);

  const [couriers, setCouriers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dragon_couriers') || '[]'); } catch { return []; }
  });

  // Загружаем курьеров с сервера при старте
  useEffect(() => {
    fetch('/api/couriers')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCouriers(data);
          localStorage.setItem('dragon_couriers', JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []);

  // Загружаем продукты с сервера при старте (для всех пользователей)
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
        } else {
          // Сервер пустой — берём из localStorage если есть (миграция)
          try {
            const local = JSON.parse(localStorage.getItem('dragon_products') || '[]');
            if (local.length > 0) {
              setProducts(local);
              // Сохраняем на сервер
              const pw = adminPasswordRef.current;
              if (pw) {
                fetch('/api/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
                  body: JSON.stringify({ products: local }),
                }).catch(() => {});
              }
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  // Нормализация заказа из разных источников в единый формат
  function normalizeOrder(o) {
    return {
      ...o,
      name: o.tgUsername || o.name || 'Неизвестен',
      createdAt: o.date || o.createdAt || new Date().toISOString(),
      total: parseFloat(o.total) || 0,
      status: o.status || 'new',
    };
  }

  const [lastRefresh, setLastRefresh] = useState(null);

  const refreshOrders = useCallback(() => {
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch('/api/orders', { headers: { 'x-admin-password': pw } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data.map(normalizeOrder));
          setLastRefresh(new Date());
        }
      })
      .catch(() => {});
    fetch('/api/users', { headers: { 'x-admin-password': pw } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(() => {});
  }, []);

  // Загружаем при входе и обновляем каждые 30 секунд
  useEffect(() => {
    if (!authed) return;
    refreshOrders();
    const interval = setInterval(refreshOrders, 30_000);
    return () => clearInterval(interval);
  }, [authed, refreshOrders]);

  // Сохраняем продукты на сервер при изменении
  const saveProductsToServer = (updatedProducts) => {
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ products: updatedProducts }),
    }).catch(() => {});
  };

  const saveCouriersToServer = (updatedCouriers) => {
    const pw = adminPasswordRef.current;
    localStorage.setItem('dragon_couriers', JSON.stringify(updatedCouriers));
    if (!pw) return;
    fetch('/api/couriers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ couriers: updatedCouriers }),
    }).catch(() => {});
  };

  const login = async (password) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        localStorage.setItem('admin_ok', '1');
        localStorage.setItem('admin_pw', password);
        adminPasswordRef.current = password;
        setAuthed(true);
        return true;
      }
    } catch {}
    return false;
  };

  const logout = () => {
    localStorage.removeItem('admin_ok');
    localStorage.removeItem('admin_pw');
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

  const deleteOrder = async (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch(`/api/orders?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': pw },
    }).catch(() => {});
  };

  const deleteUser = async (tgUserId) => {
    setUsers(prev => prev.filter(u => u.id !== tgUserId));
    setOrders(prev => prev.filter(o => o.tgUserId !== tgUserId));
    const pw = adminPasswordRef.current;
    if (!pw) return;
    fetch(`/api/users?id=${tgUserId}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': pw },
    }).catch(() => {});
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
    setProducts(prev => {
      const updated = [newProduct, ...prev];
      saveProductsToServer(updated);
      return updated;
    });
  };

  const updateProduct = (id, data) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...data } : p);
      saveProductsToServer(updated);
      return updated;
    });
  };

  const deleteProduct = (id) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveProductsToServer(updated);
      return updated;
    });
  };

  const addCourier = (courier) => {
    setCouriers(prev => {
      const updated = [...prev, { ...courier, id: Date.now() }];
      saveCouriersToServer(updated);
      return updated;
    });
  };

  const updateCourier = (id, data) => {
    setCouriers(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c);
      saveCouriersToServer(updated);
      return updated;
    });
  };

  const deleteCourier = (id) => {
    setCouriers(prev => {
      const updated = prev.filter(c => c.id !== id);
      saveCouriersToServer(updated);
      return updated;
    });
  };

  // Находит курьера по городу (для OrderModal)
  const getCourierForCity = (city) => {
    return couriers.find(c => c.cities && c.cities.includes(city)) || null;
  };

  // Клиенты: сначала из пользователей бота, дополняем данными из заказов
  const customers = users.length > 0
    ? users.map(u => ({
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || `id:${u.id}`,
        username: u.username ? `@${u.username}` : null,
        tgUserId: u.id,
        city: orders.find(o => o.tgUserId === u.id)?.city || '—',
        orders: u.orderCount || 0,
        spent: u.totalSpent || 0,
        banned: u.banned,
        lastSeen: u.lastSeen,
      }))
    : Object.values(
        orders.reduce((acc, order) => {
          const key = order.tgUserId || order.name || 'unknown';
          if (!acc[key]) {
            acc[key] = {
              name: order.name || order.tgUsername || 'Неизвестен',
              username: order.tgUsername || null,
              tgUserId: order.tgUserId || null,
              city: order.city || '—',
              orders: 0,
              spent: 0,
            };
          }
          acc[key].orders += 1;
          acc[key].spent += parseFloat(order.total) || 0;
          return acc;
        }, {})
      );

  const revenue = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  return (
    <AdminContext.Provider value={{
      authed, login, logout,
      orders, addOrder, updateOrderStatus, refreshOrders, lastRefresh,
      products, addProduct, updateProduct, deleteProduct,
      couriers, addCourier, updateCourier, deleteCourier, getCourierForCity,
      customers, users, revenue,
      deleteOrder, deleteUser,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
