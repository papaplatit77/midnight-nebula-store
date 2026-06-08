import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AdminProvider } from './admin/context/AdminContext';
import { useAdmin } from './admin/context/AdminContext';
import Stars from './components/Stars';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductPage from './pages/ProductPage';
import Cart from './pages/Cart';
import About from './pages/About';
import Contacts from './pages/Contacts';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/pages/Dashboard';
import Orders from './admin/pages/Orders';
import OrderDetail from './admin/pages/OrderDetail';
import Products from './admin/pages/Products';
import ProductForm from './admin/pages/ProductForm';
import Customers from './admin/pages/Customers';
import Couriers from './admin/pages/Couriers';

function AdminGuard({ children }) {
  const { authed } = useAdmin();
  return authed ? children : <Navigate to="/admin/login" replace />;
}

function ShopApp() {
  return (
    <>
      <Stars />
      <Header />
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/catalog"     element={<Catalog />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart"        element={<Cart />} />
        <Route path="/checkout"    element={<Navigate to="/" replace />} />
        <Route path="/about"       element={<About />} />
        <Route path="/contacts"    element={<Contacts />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard"    element={<Dashboard />} />
              <Route path="orders"       element={<Orders />} />
              <Route path="orders/:id"   element={<OrderDetail />} />
              <Route path="products"     element={<Products />} />
              <Route path="products/:id" element={<ProductForm />} />
              <Route path="customers"    element={<Customers />} />
              <Route path="couriers"     element={<Couriers />} />
            </Route>
            <Route path="/*" element={<ShopApp />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AdminProvider>
  );
}
