// frontend/src/components/AuthModal.js
// Модальное окно входа / регистрации.
// Использование:
//   const modal = new AuthModal({ onSuccess: (user) => { ... } });
//   modal.open();

import { authLogin, authRegister } from '../api/client.js';

export class AuthModal {
  constructor({ onSuccess } = {}) {
    this.onSuccess      = onSuccess ?? (() => {});
    this._pendingJobUrl = null; // URL вакансии, открытый после авторизации
    this._el            = null;
    this._build();
  }

  // ── Публичный API ──────────────────────────────────────────────────────────

  open(pendingJobUrl = null) {
    this._pendingJobUrl = pendingJobUrl;
    this._el.classList.add('auth-modal--visible');
    this._resetForm();
    this._el.querySelector('.auth-modal__input--login').focus();
  }

  close() {
    this._el.classList.remove('auth-modal--visible');
  }

  // ── Построение DOM ─────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.className = 'auth-modal';
    el.innerHTML = `
      <div class="auth-modal__backdrop"></div>
      <div class="auth-modal__box">
        <div class="auth-modal__tabs">
          <button class="auth-modal__tab auth-modal__tab--active" data-tab="login">Вход</button>
          <button class="auth-modal__tab" data-tab="register">Регистрация</button>
        </div>

        <div class="auth-modal__body">
          <p class="auth-modal__hint" id="auth-hint">Войдите, чтобы перейти к вакансии</p>

          <input
            class="auth-modal__input auth-modal__input--login"
            type="text"
            placeholder="Логин"
            autocomplete="username"
          />
          <input
            class="auth-modal__input auth-modal__input--password"
            type="password"
            placeholder="Пароль"
            autocomplete="current-password"
          />

          <p class="auth-modal__error" id="auth-error"></p>

          <button class="auth-modal__submit" id="auth-submit">Войти</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;

    // Закрытие по backdrop
    el.querySelector('.auth-modal__backdrop').addEventListener('click', () => this.close());

    // Табы
    el.querySelectorAll('.auth-modal__tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // Enter в полях
    el.querySelectorAll('.auth-modal__input').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this._submit();
      });
    });

    el.querySelector('#auth-submit').addEventListener('click', () => this._submit());
  }

  _switchTab(tab) {
    this._currentTab = tab;
    this._el.querySelectorAll('.auth-modal__tab').forEach(btn => {
      btn.classList.toggle('auth-modal__tab--active', btn.dataset.tab === tab);
    });
    this._el.querySelector('#auth-submit').textContent =
      tab === 'login' ? 'Войти' : 'Зарегистрироваться';
    this._clearError();
  }

  _resetForm() {
    this._currentTab = 'login';
    this._switchTab('login');
    this._el.querySelector('.auth-modal__input--login').value    = '';
    this._el.querySelector('.auth-modal__input--password').value = '';
  }

  _setError(msg) {
    this._el.querySelector('#auth-error').textContent = msg;
  }

  _clearError() {
    this._el.querySelector('#auth-error').textContent = '';
  }

  async _submit() {
    const login    = this._el.querySelector('.auth-modal__input--login').value.trim();
    const password = this._el.querySelector('.auth-modal__input--password').value;

    if (!login || !password) {
      this._setError('Заполните все поля');
      return;
    }

    const btn = this._el.querySelector('#auth-submit');
    btn.disabled = true;
    btn.textContent = '...';
    this._clearError();

    try {
      const fn   = this._currentTab === 'login' ? authLogin : authRegister;
      const data = await fn(login, password);
      this.close();
      this.onSuccess(data.user);

      // Если был отложенный переход — открываем вакансию
      if (this._pendingJobUrl) {
        window.open(this._pendingJobUrl, '_blank', 'noopener,noreferrer');
        this._pendingJobUrl = null;
      }
    } catch (err) {
      this._setError(err.message || 'Ошибка. Попробуйте снова.');
    } finally {
      btn.disabled = false;
      this._switchTab(this._currentTab); // восстановит текст кнопки
    }
  }
}
