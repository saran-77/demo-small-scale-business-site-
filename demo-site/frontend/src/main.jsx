import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockApi } from './mockApi.js';
import './styles.css';

const api = mockApi;

function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api('/api/auth/me').then((data) => setUser(data.user)).catch(() => {});
  }, []);

  const go = (nextPage) => {
    setError('');
    setNotice('');
    setPage(nextPage);
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    go('home');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => go('home')}>Brightline<span>Studio</span></a>
        <nav>
          {['home', 'services', 'products', 'contact'].map((item) => (
            <button key={item} onClick={() => go(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
          ))}
          {user ? (
            <>
              <button onClick={() => go(user.role === 'admin' ? 'admin' : 'dashboard')}>
                {user.role === 'admin' ? 'Admin' : 'Dashboard'}
              </button>
              <button className="outline" onClick={logout}>Log out</button>
            </>
          ) : <button className="outline" onClick={() => go('login')}>Log in</button>}
        </nav>
      </header>
      <main>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {page === 'home' && <Home onNavigate={go} />}
        {page === 'services' && <Services />}
        {page === 'products' && <Products onError={setError} />}
        {page === 'contact' && <Contact onNotice={setNotice} onError={setError} />}
        {page === 'login' && <Auth mode="login" onAuth={(nextUser) => { setUser(nextUser); go(nextUser.role === 'admin' ? 'admin' : 'dashboard'); }} onError={setError} />}
        {page === 'register' && <Auth mode="register" onAuth={(nextUser) => { setUser(nextUser); go('dashboard'); }} onError={setError} />}
        {page === 'dashboard' && user && <Dashboard onError={setError} onNotice={setNotice} />}
        {page === 'admin' && user?.role === 'admin' && <Admin onError={setError} onNotice={setNotice} />}
      </main>
      <footer><span>© 2026 Brightline Studio</span><span>Made for local businesses</span></footer>
    </div>
  );
}

function Home({ onNavigate }) {
  return <section className="hero">
    <div>
      <p className="eyebrow">DIGITAL PARTNERS FOR SMALL TEAMS</p>
      <h1>Make your next <em>good idea</em> happen.</h1>
      <p className="lede">Brightline Studio helps neighborhood businesses look their best online, find more customers, and keep growing.</p>
      <div className="actions"><button className="primary" onClick={() => onNavigate('contact')}>Start a conversation →</button><button className="text-button" onClick={() => onNavigate('services')}>See what we do</button></div>
    </div>
    <div className="hero-card"><span className="sun">✦</span><p>Strategy, design,<br /><strong>and momentum.</strong></p><span className="card-note">Est. 2018 · Local by design</span></div>
  </section>;
}

function Services() {
  return <section className="content"><p className="eyebrow">OUR SERVICES</p><h2>Practical help with<br /><em>lasting impact.</em></h2><div className="card-grid">
    {[['01', 'Brand foundations', 'A clear look and voice that makes your business memorable.'], ['02', 'Web experiences', 'Fast, friendly websites that turn curious visitors into customers.'], ['03', 'Growth support', 'A steady partner for content, search, and your next big step.']].map(([number, title, text]) => <article className="feature-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
  </div></section>;
}

function Products({ onError }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const load = () => api(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((data) => setProducts(data.products)).catch((e) => onError(e.message));
  useEffect(load, []);
  return <section className="content"><p className="eyebrow">SHOP THE STUDIO</p><h2>Simple packages,<br /><em>real progress.</em></h2><form className="search" onSubmit={(e) => { e.preventDefault(); load(); }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packages" /><button className="primary">Search</button></form><div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-art">{String(product.id).padStart(2, '0')}</div><div><h3>{product.name}</h3><div dangerouslySetInnerHTML={{ __html: product.description }} /><strong>${Number(product.price).toFixed(2)}</strong></div></article>)}</div></section>;
}

function Contact({ onNotice, onError }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const submit = async (e) => { e.preventDefault(); try { await api('/api/contact', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', email: '', message: '' }); onNotice('Thanks — we will be in touch soon.'); } catch (error) { onError(error.message); } };
  return <section className="content narrow"><p className="eyebrow">SAY HELLO</p><h2>Let's make something<br /><em>useful together.</em></h2><form className="stack-form" onSubmit={submit}>{[['name', 'Your name'], ['email', 'Email address']].map(([key, label]) => <input key={key} required value={form[key]} placeholder={label} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}<textarea required rows="5" placeholder="Tell us a little about your project" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><button className="primary">Send message</button></form></section>;
}

function Auth({ mode, onAuth, onError }) {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const register = mode === 'register';
  const submit = async (e) => { e.preventDefault(); try { const data = await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(form) }); onAuth(data.user); } catch (error) { onError(error.message); } };
  return <section className="content narrow auth"><p className="eyebrow">{register ? 'JOIN US' : 'WELCOME BACK'}</p><h2>{register ? 'Create your account.' : 'Log in to your account.'}</h2><form className="stack-form" onSubmit={submit}>{register && <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}<input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button className="primary">{register ? 'Create account' : 'Log in'}</button></form><p className="muted">{register ? 'Already a customer? Use the login link in the header.' : 'Use the demo credentials from the README for local testing.'}</p></section>;
}

function Dashboard({ onError, onNotice }) {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  useEffect(() => { Promise.all([api('/api/profile'), api('/api/orders')]).then(([p, o]) => { setProfile(p.profile); setOrders(o.orders); }).catch((e) => onError(e.message)); }, []);
  if (!profile) return <section className="content"><p>Loading dashboard…</p></section>;
  const save = async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); try { const result = await api('/api/profile', { method: 'PUT', body: JSON.stringify(data) }); setProfile(result.profile); onNotice('Profile updated.'); } catch (error) { onError(error.message); } };
  return <section className="content"><p className="eyebrow">CUSTOMER DASHBOARD</p><h2>Hello, <em>{profile.name}.</em></h2><div className="dashboard-grid"><form className="stack-form panel" onSubmit={save}><h3>Your profile</h3><input name="name" defaultValue={profile.name} /><input name="phone" defaultValue={profile.phone} placeholder="Phone" /><input name="address" defaultValue={profile.address} placeholder="Address" /><button className="primary">Save profile</button></form><div className="panel"><h3>Your orders</h3>{orders.length ? orders.map((order) => <div className="order" key={order.id}><strong>Order #{order.id}</strong><span>{order.items} · ${order.total}</span><small>{order.status}</small></div>) : <p className="muted">No orders yet.</p>}</div></div></section>;
}

function Admin({ onError, onNotice }) {
  const [data, setData] = useState({ products: [], messages: [], users: [] });
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '' });
  const load = () => Promise.all([api('/api/admin/products'), api('/api/admin/messages'), api('/api/admin/users')]).then(([products, messages, users]) => setData({ products: products.products, messages: messages.messages, users: users.users })).catch((e) => onError(e.message));
  useEffect(load, []);
  const addProduct = async (e) => { e.preventDefault(); try { await api('/api/admin/products', { method: 'POST', body: JSON.stringify(newProduct) }); setNewProduct({ name: '', description: '', price: '' }); onNotice('Product added.'); load(); } catch (error) { onError(error.message); } };
  const removeProduct = async (id) => { try { await api(`/api/admin/products/${id}`, { method: 'DELETE' }); onNotice('Product removed.'); load(); } catch (error) { onError(error.message); } };
  const removeUser = async (id) => { try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); onNotice('User removed.'); load(); } catch (error) { onError(error.message); } };
  return <section className="content"><p className="eyebrow">ADMIN CONSOLE</p><h2>Keep things <em>moving.</em></h2><div className="dashboard-grid"><div className="panel"><h3>Products ({data.products.length})</h3>{data.products.map((p) => <p className="list-row" key={p.id}><strong>{p.name}</strong><span>${p.price}</span><button className="danger" onClick={() => removeProduct(p.id)}>Remove</button></p>)}<form className="stack-form compact" onSubmit={addProduct}><input required placeholder="New product" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /><input required placeholder="Description" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} /><input required type="number" placeholder="Price" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} /><button className="primary">Add product</button></form></div><div className="panel"><h3>Messages ({data.messages.length})</h3>{data.messages.map((message) => <article className="message" key={message.id}><strong>{message.name}</strong><small>{message.email}</small><div dangerouslySetInnerHTML={{ __html: message.message }} /></article>)}</div></div><div className="panel users"><h3>Users ({data.users.length})</h3>{data.users.map((u) => <p className="list-row" key={u.id}><span>{u.email}</span><code>{u.password}</code><button className="danger" onClick={() => removeUser(u.id)}>Remove</button></p>)}</div></section>;
}

createRoot(document.getElementById('root')).render(<App />);
