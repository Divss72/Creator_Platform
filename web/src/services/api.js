const API_BASE = '/api';
const GQL_ENDPOINT = '/graphql';

function getToken() {
  return localStorage.getItem('creatorhub_token');
}

export function setSession(token, user) {
  if (token) {
    localStorage.setItem('creatorhub_token', token);
  } else {
    localStorage.removeItem('creatorhub_token');
  }
  if (user) {
    localStorage.setItem('creatorhub_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('creatorhub_user');
  }
}

export function getSession() {
  const token = localStorage.getItem('creatorhub_token');
  const userJson = localStorage.getItem('creatorhub_user');
  let user = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      user = null;
    }
  }
  return { token, user };
}

export async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function gql(query, variables = {}) {
  const token = getToken();
  const response = await fetch(GQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const resData = await response.json();
  if (resData.errors && resData.errors.length > 0) {
    throw new Error(resData.errors[0].message);
  }
  return resData.data;
}

// API methods
export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),

  // Feed & Content
  getFeed: (cursor = null, limit = 20) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', cursor);
    return request(`/feed?${q.toString()}`);
  },
  getPost: (id) => request(`/content/${id}`),
  recordView: (id) => request(`/content/${id}/view`, { method: 'POST' }),
  likePost: (id) => request(`/content/${id}/like`, { method: 'POST' }),
  unlikePost: (id) => request(`/content/${id}/like`, { method: 'DELETE' }),

  // Comments
  getComments: (contentId, limit = 50) => request(`/content/${contentId}/comments?limit=${limit}`),
  addComment: (contentId, body) =>
    request(`/content/${contentId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),

  // Subscriptions
  subscribe: (creatorId, tier) =>
    request('/subscriptions', { method: 'POST', body: JSON.stringify({ creatorId, tier }) }),
  cancelSubscription: (creatorId) => request(`/subscriptions/${creatorId}`, { method: 'DELETE' }),
  mySubscriptions: () => request('/subscriptions/mine'),

  // Trending
  getTrending: (limit = 10, accessibleOnly = false) =>
    request(`/trending?limit=${limit}${accessibleOnly ? '&accessibleOnly=true' : ''}`),

  // Creator Analytics
  getAnalyticsOverview: () => request('/creators/me/analytics/overview'),
  getAnalyticsTimeseries: (range = '30d') =>
    request(`/creators/me/analytics/timeseries?range=${range}`),
  getAnalyticsTopContent: (limit = 5) =>
    request(`/creators/me/analytics/top-content?limit=${limit}`),

  // Studio
  createContent: (payload) => request('/content', { method: 'POST', body: JSON.stringify(payload) })
};
