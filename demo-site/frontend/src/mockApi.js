const state = {
  currentUser: null,
  users: [
    { id: 1, email: 'alex@example.test', password: 'password123', name: 'Alex Example', phone: '555-0100', address: '1 Test Lane' },
    { id: 2, email: 'casey@example.test', password: 'password123', name: 'Casey Example', phone: '555-0101', address: '2 Test Lane' }
  ],
  products: [
    { id: 1, name: 'Starter Website', description: 'A friendly starter site for a local business.', price: 499 },
    { id: 2, name: 'Local SEO Pack', description: 'Business listings and on-page optimization.', price: 199 },
    { id: 3, name: 'Care Plan', description: 'Monthly updates, backups, and helpful support.', price: 79 }
  ],
  orders: [{ id: 1, user_id: 1, status: 'Processing', total: 499, items: 'Starter Website' }],
  messages: [
    { id: 1, name: 'Sample Visitor', email: 'visitor@example.test', message: 'Could you tell me more about your services?' }
  ]
};

const publicUser = ({ password: _password, ...user }) => user;
const bodyOf = (options) => options.body ? JSON.parse(options.body) : {};
const requireCustomer = () => {
  if (!state.currentUser || state.currentUser.role === 'admin') throw new Error('Login required');
  return state.currentUser;
};
const requireAdmin = () => {
  if (state.currentUser?.role !== 'admin') throw new Error('Admin access required');
  return state.currentUser;
};

export async function mockApi(path, options = {}) {
  const url = new URL(path, 'http://brightline.local');
  const method = options.method || 'GET';
  const body = bodyOf(options);

  if (url.pathname === '/api/auth/me') {
    if (!state.currentUser) throw new Error('Login required');
    return { user: state.currentUser };
  }
  if (url.pathname === '/api/auth/login' && method === 'POST') {
    const account = state.users.find((item) => item.email === body.email && item.password === body.password);
    if (account) {
      state.currentUser = publicUser(account);
      return { user: state.currentUser };
    }
    if (body.email === 'admin@example.test' && body.password === 'admin123') {
      state.currentUser = { id: 1, email: body.email, name: 'Demo Administrator', role: 'admin' };
      return { user: state.currentUser };
    }
    throw new Error('Invalid email or password');
  }
  if (url.pathname === '/api/auth/register' && method === 'POST') {
    if (state.users.some((item) => item.email === body.email)) throw new Error('Email is already registered');
    const account = { id: state.users.length + 1, email: body.email, password: body.password, name: body.name, phone: '', address: '' };
    state.users.push(account);
    state.currentUser = publicUser(account);
    return { user: state.currentUser };
  }
  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    state.currentUser = null;
    return { ok: true };
  }
  if (url.pathname === '/api/products' && method === 'GET') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    return { search, products: state.products.filter((item) => !search || `${item.name} ${item.description}`.toLowerCase().includes(search)) };
  }
  if (url.pathname.startsWith('/api/products/') && method === 'GET') {
    const product = state.products.find((item) => item.id === Number(url.pathname.split('/').pop()));
    if (!product) throw new Error('Product not found');
    return { product };
  }
  if (url.pathname === '/api/contact' && method === 'POST') {
    state.messages.unshift({ id: state.messages.length + 1, name: body.name, email: body.email, message: body.message });
    return { message: 'Thanks for contacting us' };
  }
  if (url.pathname === '/api/profile' && method === 'GET') {
    return { profile: requireCustomer() };
  }
  if (url.pathname === '/api/profile' && method === 'PUT') {
    const user = requireCustomer();
    Object.assign(user, { name: body.name || user.name, phone: body.phone || user.phone, address: body.address || user.address });
    const account = state.users.find((item) => item.id === user.id);
    Object.assign(account, user);
    return { profile: user };
  }
  if (url.pathname === '/api/orders' && method === 'GET') {
    const user = requireCustomer();
    return { orders: state.orders.filter((item) => item.user_id === user.id) };
  }
  if (url.pathname === '/api/admin/products' && method === 'GET') {
    requireAdmin();
    return { products: state.products };
  }
  if (url.pathname === '/api/admin/products' && method === 'POST') {
    requireAdmin();
    const product = { ...body, id: state.products.length + 1, price: Number(body.price) };
    state.products.push(product);
    return { product };
  }
  if (url.pathname.startsWith('/api/admin/products/') && method === 'DELETE') {
    requireAdmin();
    state.products = state.products.filter((item) => item.id !== Number(url.pathname.split('/').pop()));
    return { ok: true };
  }
  if (url.pathname === '/api/admin/messages' && method === 'GET') {
    requireAdmin();
    return { messages: state.messages };
  }
  if (url.pathname === '/api/admin/users' && method === 'GET') {
    requireAdmin();
    return { users: state.users };
  }
  if (url.pathname.startsWith('/api/admin/users/') && method === 'DELETE') {
    requireAdmin();
    state.users = state.users.filter((item) => item.id !== Number(url.pathname.split('/').pop()));
    return { ok: true };
  }
  throw new Error(`No mock route for ${method} ${url.pathname}`);
}
