let csrfToken = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Could not start a secure session.');
  csrfToken = (await response.json()).csrfToken;
  return csrfToken;
}

export async function checkAdminSession() {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (!response.ok) return false;
  return (await response.json()).authenticated;
}

export async function loginAdmin(username, password) {
  const token = await getCsrfToken();
  const response = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ username, password }),
  });
  const result = response.status === 429 ? { error: 'Too many sign-in attempts. Try again later.' } : await response.json();
  if (!response.ok) return { success: false, error: result.error || 'Unable to sign in.' };
  csrfToken = result.csrfToken;
  return { success: true };
}

export async function logoutAdmin() {
  const token = await getCsrfToken();
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': token } });
  csrfToken = null;
  if (!response.ok && response.status !== 204) throw new Error('Could not end the admin session.');
}

export async function changePassword(currentPassword, newPassword) {
  const token = await getCsrfToken();
  const response = await fetch('/api/auth/password', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (result.csrfToken) csrfToken = result.csrfToken;
  return response.ok ? { success: true } : { success: false, error: result.error || 'Password update failed.' };
}

export async function savePortfolioData(data) {
  const token = await getCsrfToken();
  const response = await fetch('/api/admin/portfolio', {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Portfolio changes could not be saved.');
  }
}
