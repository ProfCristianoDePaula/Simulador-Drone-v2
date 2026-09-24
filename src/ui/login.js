const form = document.getElementById('login-form');
const password = document.getElementById('password');
const toggle = document.getElementById('toggle-password');
// Authentication is intentionally unavailable until a real provider is configured.
// Never transmit or persist credentials from this presentation-only form.
form.addEventListener('submit', event => event.preventDefault());
toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.textContent = visible ? 'Ocultar' : 'Mostrar';
  toggle.setAttribute('aria-pressed', String(visible));
});
