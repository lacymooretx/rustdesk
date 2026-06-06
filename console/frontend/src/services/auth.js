import api from './api';

export async function login(email, password, totp_code) {
  const payload = { email, password };
  if (totp_code) payload.totp_code = totp_code;
  try {
    const response = await api.post('/auth/login', payload);
    const { access_token, user } = response.data;
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    return user;
  } catch (err) {
    if (err.response?.status === 403 && err.response?.data?.totp_required) {
      const totpErr = new Error('TOTP required');
      totpErr.totp_required = true;
      throw totpErr;
    }
    throw err;
  }
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.location.href = '/login';
}

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function isAuthenticated() {
  return !!getToken();
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}
