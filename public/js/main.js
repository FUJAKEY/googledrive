(() => {
  const state = {
    session: null,
    csrfToken: null,
    toastTimer: null
  };
  const queryMessageKeys = ['success', 'error', 'info'];

  document.addEventListener('DOMContentLoaded', async () => {
    hydrateInitialCsrfToken();
    try {
      await injectPartials();
      showMessageFromQuery();
      document.body.classList.add('app-mounted');
      await refreshSession();
      setupNavigation();
      attachGlobalHandlers();
      await runPageController();
    } catch (error) {
      console.error('Ошибка инициализации интерфейса', error);
      showToast(error.message || 'Не удалось инициализировать интерфейс', 'error');
    } finally {
      document.body.classList.add('app-loaded');
    }
  });

  function showMessageFromQuery() {
    if (!window.location.search) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    let consumed = false;
    queryMessageKeys.forEach((key) => {
      const value = params.get(key);
      if (value) {
        showToast(value, key === 'info' ? 'info' : key);
        consumed = true;
      }
    });
    if (consumed && window.history?.replaceState) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  function updateCsrfFields(token) {
    if (!token) {
      return;
    }
    document.querySelectorAll('[data-csrf-field]').forEach((field) => {
      field.value = token;
    });
  }

  function hydrateInitialCsrfToken() {
    if (state.csrfToken) {
      return;
    }
    const presetField = document.querySelector('[data-csrf-field]');
    if (presetField?.value) {
      state.csrfToken = presetField.value;
    }
  }

  async function ensureFormCsrfField(form) {
    if (!form) {
      return false;
    }
    const field = form.querySelector('[data-csrf-field]');
    if (!field) {
      return true;
    }
    const fallbackToken = field.value;
    try {
      const token = await ensureCsrfToken();
      if (token) {
        field.value = token;
        return true;
      }
    } catch (error) {
      console.error('Не удалось подготовить CSRF-токен для формы', error);
      if (!fallbackToken) {
        showToast('Не удалось подготовить защиту формы. Обновите страницу и попробуйте снова.', 'error');
        return false;
      }
      state.csrfToken = fallbackToken;
      return true;
    }

    if (fallbackToken) {
      state.csrfToken = fallbackToken;
      return true;
    }

    showToast('Не удалось подготовить защиту формы. Обновите страницу и попробуйте снова.', 'error');
    return false;
  }

  async function injectPartials() {
    await Promise.all([injectPartial('header'), injectPartial('footer')]);
    const year = document.querySelector('[data-year]');
    if (year) {
      year.textContent = new Date().getFullYear();
    }
  }

  async function injectPartial(name) {
    const placeholder = document.querySelector(`[data-include="${name}"]`);
    if (!placeholder) {
      return;
    }
    try {
      const response = await fetch(`/partials/${name}.html`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`Не удалось загрузить компонент ${name}`);
      }
      const html = await response.text();
      placeholder.insertAdjacentHTML('afterend', html);
      placeholder.remove();
    } catch (error) {
      console.error(error);
    }
  }

  async function refreshSession() {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Не удалось получить данные сессии');
      }
      state.session = await response.json();
    } catch (error) {
      state.session = { authenticated: false };
    }
  }

  function setupNavigation() {
    const isAuth = !!state.session?.authenticated;
    const user = state.session?.user || null;

    toggleVisibility('.nav-authenticated', isAuth);
    toggleVisibility('.nav-guest', !isAuth);

    document.querySelectorAll('.nav-admin').forEach((el) => {
      el.style.display = user?.role === 'admin' ? '' : 'none';
    });

    const nameEl = document.querySelector('[data-user-name]');
    const roleEl = document.querySelector('[data-user-role]');
    if (nameEl) {
      nameEl.textContent = user?.name || '';
    }
    if (roleEl) {
      roleEl.textContent = user ? user.role : '';
    }

    document.body.classList.toggle('user-authenticated', isAuth);
    document.body.classList.toggle('user-admin', user?.role === 'admin');

    highlightActiveNav();
  }

  function toggleVisibility(selector, show) {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.display = show ? '' : 'none';
    });
  }

  function highlightActiveNav() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.main-nav a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('/')) {
        link.classList.remove('active');
        return;
      }
      const normalized = href.length > 1 && href.endsWith('/') ? href.slice(0, -1) : href;
      const isMatch = normalized === '/'
        ? currentPath === '/'
        : currentPath === normalized || currentPath.startsWith(`${normalized}/`);
      link.classList.toggle('active', isMatch);
    });
  }

  function attachGlobalHandlers() {
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    const navBackdrop = document.querySelector('[data-nav-backdrop]');

    const closeNav = () => {
      document.body.classList.remove('nav-open');
      navToggle?.setAttribute('aria-expanded', 'false');
    };

    const openNav = () => {
      document.body.classList.add('nav-open');
      navToggle?.setAttribute('aria-expanded', 'true');
    };

    const toggleNav = () => {
      if (document.body.classList.contains('nav-open')) {
        closeNav();
      } else {
        openNav();
      }
    };

    navToggle?.addEventListener('click', toggleNav);
    navBackdrop?.addEventListener('click', closeNav);

    mainNav?.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 960) {
          closeNav();
        }
      });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 960) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeNav();
      }
    });

    document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          // ошибка выхода не должна блокировать редирект
        } finally {
          closeNav();
          window.location.href = '/';
        }
      });
    });
  }

  async function ensureCsrfToken() {
    if (state.csrfToken) {
      updateCsrfFields(state.csrfToken);
      return state.csrfToken;
    }
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error('Не удалось получить CSRF-токен');
    }
    const data = await response.json();
    state.csrfToken = data.csrfToken;
    updateCsrfFields(state.csrfToken);
    return state.csrfToken;
  }

  async function apiRequest(url, { method = 'GET', body = null, headers = {}, skipRedirect = false } = {}) {
    const options = {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain, */*', ...headers }
    };

    let isFormData = false;
    if (body instanceof FormData) {
      options.body = body;
      isFormData = true;
    } else if (body) {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }

    if (!['GET', 'HEAD'].includes(method)) {
      const token = await ensureCsrfToken();
      if (isFormData) {
        if (!body.has('_csrf')) {
          body.append('_csrf', token);
        }
      } else {
        options.headers['CSRF-Token'] = token;
      }
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let payload = null;
    if (response.status !== 204) {
      payload = isJson ? await response.json() : await response.text();
    }

    if (response.status === 401 && !skipRedirect) {
      window.location.href = '/login';
      throw new Error(typeof payload === 'string' ? payload : payload?.message || 'Требуется авторизация');
    }

    if (response.status === 403 && !skipRedirect) {
      showToast(typeof payload === 'string' ? payload : payload?.message || 'Доступ запрещён', 'error');
      throw new Error(typeof payload === 'string' ? payload : payload?.message || 'Доступ запрещён');
    }

    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : payload?.message || 'Ошибка запроса';
      throw new Error(message);
    }

    return payload;
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4200);
  }

  async function runPageController() {
    const page = document.body.dataset.page;
    if (!page) {
      return;
    }
    const controllers = {
      login: initLogin,
      register: initRegister,
      twofactor: initTwoFactor,
      dashboard: initDashboard,
      upload: initUpload,
      file: initFile,
      profile: initProfile,
      'profile-security': initProfileSecurity,
      security: initSecurity,
      'admin-users': initAdminUsers,
      'admin-files': initAdminFiles,
      'admin-audit': initAdminAudit
    };
    const handler = controllers[page];
    if (handler) {
      try {
        await handler();
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Произошла ошибка', 'error');
      }
    }
  }

  function updateOwnerVisibility(isOwner) {
    document.querySelectorAll('.owner-only').forEach((el) => {
      const fallback = el.dataset.ownerDisplay || (el.tagName === 'DIV' ? 'block' : 'inline-flex');
      el.style.display = isOwner ? fallback : 'none';
    });
  }

  async function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const ready = await ensureFormCsrfField(form);
    if (!ready) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      try {
        const result = await apiRequest('/api/auth/login', { method: 'POST', body: payload });
        showToast(result.message, 'success');
        if (result.twoFactorRequired) {
          window.location.href = '/2fa';
        } else {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function initRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const ready = await ensureFormCsrfField(form);
    if (!ready) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      try {
        const result = await apiRequest('/api/auth/register', { method: 'POST', body: payload });
        showToast(result.message, 'success');
        window.location.href = '/login';
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function initTwoFactor() {
    try {
      const context = await apiRequest('/api/auth/2fa/context', { skipRedirect: true });
      const emailSpan = document.querySelector('[data-twofactor-email]');
      if (context?.email && emailSpan) {
        emailSpan.textContent = context.email;
      }
    } catch (error) {
      window.location.href = '/login';
      return;
    }

    const form = document.getElementById('twoFactorForm');
    if (!form) return;

    const ready = await ensureFormCsrfField(form);
    if (!ready) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await apiRequest('/api/auth/2fa', { method: 'POST', body: payload });
        showToast(result.message, 'success');
        window.location.href = '/dashboard';
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function initDashboard() {
    const tableBody = document.querySelector('#dashboardTable tbody');
    if (!tableBody) return;
    try {
      const data = await apiRequest('/api/dashboard/files');
      tableBody.innerHTML = '';
      if (!data.files || data.files.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="muted">Документы отсутствуют.</td></tr>';
        return;
      }
      data.files.forEach((file) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(file.original_name)}</td>
          <td><span class="badge" data-level="${file.classification}">${file.classification}</span></td>
          <td>${file.formattedSize}</td>
          <td>${file.formattedDate}</td>
          <td class="table-actions">
            <a href="/files/${file.id}" class="btn btn-link">Карточка</a>
            <a href="/api/files/${file.id}/download" class="btn btn-link">Скачать</a>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function initUpload() {
    const select = document.getElementById('classificationSelect');
    if (select) {
      try {
        const data = await apiRequest('/api/files/classifications');
        select.innerHTML = '';
        data.classifications.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.value;
          option.textContent = item.label;
          select.appendChild(option);
        });
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    const form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      try {
        const result = await apiRequest('/api/files', { method: 'POST', body: formData });
        showToast(result.message, 'success');
        window.location.href = `/files/${result.file.id}`;
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function initFile() {
    const pathSegments = window.location.pathname.split('/');
    const fileId = pathSegments[pathSegments.length - 1];
    if (!fileId) return;

    try {
      const data = await apiRequest(`/api/files/${fileId}`);
      updateFileCard(data);
      bindFileActions(fileId, data.isOwner);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function updateFileCard(data) {
    const file = data.file;
    if (!file) return;

    document.querySelector('[data-file-name]')?.textContent = file.original_name;
    document.querySelector('[data-file-meta]')?.textContent = `ID: ${file.id}`;
    const classEl = document.querySelector('[data-file-classification]');
    if (classEl) {
      classEl.innerHTML = `<span class="badge" data-level="${file.classification}">${file.classification}</span>`;
    }
    document.querySelector('[data-file-size]')?.textContent = file.formattedSize;
    document.querySelector('[data-file-created]')?.textContent = file.formattedDate;
    document.querySelector('[data-file-description]')?.textContent = file.description || 'Описание отсутствует';

    const downloadLink = document.querySelector('[data-action="download"]');
    if (downloadLink) {
      downloadLink.href = `/api/files/${file.id}/download`;
    }

    updateOwnerVisibility(data.isOwner);

    const tableBody = document.querySelector('#sharesTable tbody');
    if (tableBody) {
      tableBody.innerHTML = '';
      if (!data.shares || data.shares.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="muted">Доступ не предоставлен.</td></tr>';
      } else {
        data.shares.forEach((share) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHtml(share.target_email)}</td>
            <td>${share.permission}</td>
            <td>${share.formattedDate}</td>
            <td class="table-actions">
              <button class="btn btn-link" data-action="revoke" data-share-id="${share.id}">Отозвать</button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }
    }
  }

  function bindFileActions(fileId, isOwner) {
    const deleteBtn = document.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Удалить документ без возможности восстановления?')) return;
        try {
          const result = await apiRequest(`/api/files/${fileId}`, { method: 'DELETE' });
          showToast(result.message, 'info');
          window.location.href = '/dashboard';
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    }

    const shareForm = document.getElementById('shareForm');
    if (shareForm && isOwner) {
      shareForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(shareForm).entries());
        try {
          const result = await apiRequest(`/api/files/${fileId}/shares`, { method: 'POST', body: payload });
          showToast(result.message, 'success');
          const updated = await apiRequest(`/api/files/${fileId}`);
          updateFileCard(updated);
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    }

    const sharesTable = document.getElementById('sharesTable');
    if (sharesTable && isOwner) {
      sharesTable.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.matches('[data-action="revoke"]')) {
          const shareId = target.dataset.shareId;
          if (!shareId) return;
          try {
            const result = await apiRequest(`/api/files/${fileId}/shares/${shareId}`, { method: 'DELETE' });
            showToast(result.message, 'info');
            const updated = await apiRequest(`/api/files/${fileId}`);
            updateFileCard(updated);
          } catch (error) {
            showToast(error.message, 'error');
          }
        }
      });
    }
  }

  async function initProfile() {
    try {
      const data = await apiRequest('/api/profile');
      document.querySelector('[data-profile-name]')?.textContent = data.user.name;
      document.querySelector('[data-profile-email]')?.textContent = data.user.email;
      document.querySelector('[data-profile-role]')?.textContent = data.user.role;
      document.querySelector('[data-profile-mfa]')?.textContent = data.user.twoFactorEnabled ? 'Включена' : 'Выключена';
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function initProfileSecurity() {
    const setupContainer = document.querySelector('[data-mfa-setup]');
    const statusEl = document.querySelector('[data-mfa-status]');
    const secretEl = document.querySelector('[data-mfa-secret]');
    const qrEl = document.querySelector('[data-mfa-qr]');

    async function loadState() {
      try {
        const data = await apiRequest('/api/profile/security');
        if (statusEl) {
          statusEl.textContent = data.twoFactorEnabled ? 'Активна' : 'Отключена';
        }
        if (data.setup) {
          setupContainer?.removeAttribute('hidden');
          if (secretEl) secretEl.textContent = data.setup.base32 || '';
          if (qrEl && data.qrCode) {
            qrEl.src = data.qrCode;
            qrEl.style.display = '';
          }
        } else {
          setupContainer?.setAttribute('hidden', '');
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    document.querySelector('[data-action="mfa-setup"]')?.addEventListener('click', async () => {
      try {
        await apiRequest('/api/profile/security/setup', { method: 'POST' });
        showToast('Секрет сгенерирован. Подтвердите код.', 'info');
        await loadState();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    document.querySelector('[data-action="mfa-disable"]')?.addEventListener('click', async () => {
      if (!confirm('Отключить двухфакторную защиту?')) return;
      try {
        const result = await apiRequest('/api/profile/security/disable', { method: 'POST' });
        showToast(result.message, 'info');
        await loadState();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    const confirmForm = document.getElementById('mfaConfirmForm');
    if (confirmForm) {
      confirmForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(confirmForm).entries());
        try {
          const result = await apiRequest('/api/profile/security/confirm', { method: 'POST', body: payload });
          showToast(result.message, 'success');
          confirmForm.reset();
          await loadState();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    }

    await loadState();
  }

  async function initSecurity() {
    const tableBody = document.querySelector('#classificationMatrix tbody');
    if (!tableBody) return;
    try {
      const data = await apiRequest('/api/meta/classification-matrix');
      tableBody.innerHTML = '';
      data.matrix.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.description)}</td>`;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function initAdminUsers() {
    const tableBody = document.querySelector('#adminUsersTable tbody');
    if (!tableBody) return;

    try {
      const data = await apiRequest('/api/admin/users');
      tableBody.innerHTML = '';
      const roles = ['member', 'manager', 'security', 'admin'];
      data.users.forEach((user) => {
        const tr = document.createElement('tr');
        const options = roles
          .map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role}</option>`)
          .join('');
        tr.innerHTML = `
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.name || '—')}</td>
          <td>
            <select data-user-id="${user.id}" class="role-select">
              ${options}
            </select>
          </td>
          <td>${user.created_at_formatted}</td>
          <td class="table-actions">
            <button class="btn btn-link" data-action="apply-role" data-user-id="${user.id}">Применить</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      showToast(error.message, 'error');
    }

    tableBody.addEventListener('click', async (event) => {
      const target = event.target;
      if (target.matches('[data-action="apply-role"]')) {
        const userId = target.dataset.userId;
        const select = tableBody.querySelector(`select[data-user-id="${userId}"]`);
        if (!select) return;
        try {
          const result = await apiRequest(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            body: { role: select.value }
          });
          showToast(result.message, 'success');
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    });
  }

  async function initAdminFiles() {
    const tableBody = document.querySelector('#adminFilesTable tbody');
    if (!tableBody) return;

    try {
      const data = await apiRequest('/api/admin/files');
      tableBody.innerHTML = '';
      data.files.forEach((file) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(file.original_name)}</td>
          <td>${escapeHtml(file.owner_email)}</td>
          <td>${file.classification}</td>
          <td>${file.formattedSize}</td>
          <td>${file.formattedDate}</td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function initAdminAudit() {
    const tableBody = document.querySelector('#auditTable tbody');
    if (!tableBody) return;

    try {
      const data = await apiRequest('/api/admin/audit');
      tableBody.innerHTML = '';
      data.logs.forEach((log) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${log.created_at_formatted}</td>
          <td>${escapeHtml(log.user_email || 'система')}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.details || '—')}</td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function escapeHtml(value) {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
