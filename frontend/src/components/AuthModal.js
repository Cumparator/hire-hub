// frontend/src/components/AuthModal.js
// Модальное окно входа / регистрации.
// Использование:
//   const modal = new AuthModal({ onSuccess: (user) => { ... } });
//   modal.open();

import { authLogin, authRegister } from '../api/client.js';

// ── Константы валидации ────────────────────────────────────────────────────
const MIN_LOGIN_LEN    = 3;
const MAX_LOGIN_LEN    = 32;
const MIN_PASSWORD_LEN = 6;
const MAX_PASSWORD_LEN = 72;  // bcrypt-предел; у нас pbkdf2, но разумная граница

export class AuthModal {
  constructor({ onSuccess } = {}) {
    this.onSuccess      = onSuccess ?? (() => {});
    this._pendingJobUrl = null;
    this._el            = null;
    this._currentTab    = 'login';
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

          <p class="auth-modal__error" id="auth-error" role="alert" aria-live="polite"></p>

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

    // Enter в полях — очищаем ошибку при вводе, сабмитим по Enter
    el.querySelectorAll('.auth-modal__input').forEach(input => {
      input.addEventListener('input',   () => this._clearError());
      input.addEventListener('keydown', e => { if (e.key === 'Enter') this._submit(); });
    });

    el.querySelector('#auth-submit').addEventListener('click', () => this._submit());
  }

  // ── Переключение таба ─────────────────────────────────────────────────────

  _switchTab(tab) {
    this._currentTab = tab;
    this._el.querySelectorAll('.auth-modal__tab').forEach(btn => {
      btn.classList.toggle('auth-modal__tab--active', btn.dataset.tab === tab);
    });
    this._el.querySelector('#auth-submit').textContent =
      tab === 'login' ? 'Войти' : 'Зарегистрироваться';
    this._clearError();
    // Сбросить маркировку полей при смене таба
    this._el.querySelectorAll('.auth-modal__input').forEach(i =>
      i.classList.remove('auth-modal__input--error')
    );
  }

  _resetForm() {
    this._currentTab = 'login';
    this._switchTab('login');
    this._el.querySelector('.auth-modal__input--login').value    = '';
    this._el.querySelector('.auth-modal__input--password').value = '';
  }

  // ── Управление ошибками ───────────────────────────────────────────────────

  /**
   * Показать ошибку: текст + shake + опциональная маркировка полей.
   * @param {string}   msg
   * @param {'login'|'password'|'both'|null} [field] — какое поле подсветить красным
   */
  _setError(msg, field = null) {
    const errorEl = this._el.querySelector('#auth-error');
    errorEl.textContent = msg;

    // Маркировка полей
    const loginInput = this._el.querySelector('.auth-modal__input--login');
    const passInput  = this._el.querySelector('.auth-modal__input--password');

    loginInput.classList.toggle('auth-modal__input--error', field === 'login' || field === 'both');
    passInput.classList.toggle('auth-modal__input--error',  field === 'password' || field === 'both');

    // Shake
    const box = this._el.querySelector('.auth-modal__box');
    box.classList.remove('auth-modal__box--shake');
    // reflow — чтобы анимация запустилась повторно, если ошибка уже была
    void box.offsetWidth;
    box.classList.add('auth-modal__box--shake');
    box.addEventListener('animationend', () => {
      box.classList.remove('auth-modal__box--shake');
    }, { once: true });
  }

  _clearError() {
    this._el.querySelector('#auth-error').textContent = '';
    this._el.querySelectorAll('.auth-modal__input').forEach(i =>
      i.classList.remove('auth-modal__input--error')
    );
  }

  // ── Клиентская валидация ──────────────────────────────────────────────────

  /**
   * Проверяет поля до отправки на сервер.
   * @returns {{ ok: boolean, message?: string, field?: string }}
   */
  _validate(login, password) {
    if (!login && !password) {
      return { ok: false, message: 'Заполните все поля', field: 'both' };
    }
    if (!login) {
      return { ok: false, message: 'Введите логин', field: 'login' };
    }
    if (!password) {
      return { ok: false, message: 'Введите пароль', field: 'password' };
    }
    if (login.length < MIN_LOGIN_LEN) {
      return { ok: false, message: `Логин — минимум ${MIN_LOGIN_LEN} символа`, field: 'login' };
    }
    if (login.length > MAX_LOGIN_LEN) {
      return { ok: false, message: `Логин — не более ${MAX_LOGIN_LEN} символов`, field: 'login' };
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(login)) {
      return { ok: false, message: 'Логин: только латиница, цифры, _ - .', field: 'login' };
    }
    if (this._currentTab === 'register') {
      if (password.length < MIN_PASSWORD_LEN) {
        return { ok: false, message: `Пароль — минимум ${MIN_PASSWORD_LEN} символов`, field: 'password' };
      }
      if (password.length > MAX_PASSWORD_LEN) {
        return { ok: false, message: `Пароль — не более ${MAX_PASSWORD_LEN} символов`, field: 'password' };
      }
    }
    return { ok: true };
  }

  // ── Отправка ──────────────────────────────────────────────────────────────

 async _submit() {
    const login    = this._el.querySelector('.auth-modal__input--login').value.trim();
    const password = this._el.querySelector('.auth-modal__input--password').value;

    const validation = this._validate(login, password);
    if (!validation.ok) {
        this._setError(validation.message, validation.field);
        return;
    }

    this._clearError();

    try {
        const fn = this._currentTab === 'login' ? authLogin : authRegister;
        const data = await fn(login, password); 

        this.close();
        this.onSuccess(data.user);
    } catch (err) {
        const msg = err.message || 'Ошибка сервера';
        const field = this._inferErrorField(err.code); 
        
        this._setError(msg, field); 
    }
}

  /**
   * По машинному коду ошибки определяем, какое поле подсветить.
   * Коды соответствуют authService.js на бэкенде.
   */
  _inferErrorField(code) {
    switch (code) {
      case 'LOGIN_NOT_FOUND':
      case 'LOGIN_TAKEN':
        return 'login';
      case 'INVALID_PASSWORD':
        return 'password';
      case 'VALIDATION_ERROR':
        return 'both';
      default:
        return null;
    }
  }
}