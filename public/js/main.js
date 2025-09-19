(() => {
  const state = {
    session: null,
    csrfToken: null,
    toastTimer: null
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await injectPartials();
    await refreshSession();
    setupNavigation();
    attachGlobalHandlers();
    await runPageController();
  });

  async function injectPartials() {
    await Promise.all([
      injectPartial('header'),
      injectPartial('footer')
    ]);
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
      const response = await fetch(`/partials/${name}.html`);
      const html = await response.text();
      placeholder.insertAdjacentHTML('afterend', html);
      placeholder.remove();
    } catch (error) {
      console.error(`Не удалось загрузить компонент ${name}`, error);
    }
  }

  async function refreshSession() {
    try {
      const response = await fetch('/api/session');
      state.session = await response.json();
    } catch (error) {
      state.session = { authenticated: false };
    }
  }

  function setupNavigation() {
    const isAuth = !!state.session?.authenticated;
    const user = state.session?.user || null;
    document.querySelectorAll('.nav-authenticated').forEach((el) => {
      el.style.display = isAuth ? '' : 'none';
    });
    document.querySelectorAll('.nav-guest').forEach((el) => {
      el.style.display = isAuth ? 'none' : '';
    });
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
  }

  function attachGlobalHandlers() {
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    if (navToggle && mainNav) {
      navToggle.addEventListener('click', () => {
        mainNav.classList.toggle('open');
      });
    }

    document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          // ignore
        } finally {
          window.location.href = '/';
        }
      });
    });
  }

  async function ensureCsrfToken() {
    if (state.csrfToken) {
      return state.csrfToken;
    }
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    state.csrfToken = data.csrfToken;
    return state.csrfToken;
  }

  async function apiRequest(url, { method = 'GET', body = null, headers = {}, skipRedirect = false } = {}) {
    const options = { method, headers: { ...headers } };
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
    const payload = isJson ? await response.json() : await response.text();

    if (response.status === 401 && !skipRedirect) {
      window.location.href = '/login';
      throw new Error('Требуется авторизация');
    }
    if (response.status === 403 && !skipRedirect) {
      showToast(payload?.message || 'Доступ запрещён', 'error');
      throw new Error(payload?.message || 'Доступ запрещён');
    }
    if (!response.ok) {
      const message = payload?.message || payload || 'Ошибка запроса';
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
    toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 4000);
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

  async function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
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
    const nameEl = document.querySelector('[data-file-name]');
    const metaEl = document.querySelector('[data-file-meta]');
    const classEl = document.querySelector('[data-file-classification]');
    const sizeEl = document.querySelector('[data-file-size]');
    const createdEl = document.querySelector('[data-file-created]');
    const descEl = document.querySelector('[data-file-description]');
    if (nameEl) nameEl.textContent = file.original_name;
    if (metaEl) metaEl.textContent = `ID: ${file.id}`;
    if (classEl) classEl.innerHTML = `<span class="badge" data-level="${file.classification}">${file.classification}</span>`;
    if (sizeEl) sizeEl.textContent = file.formattedSize;
    if (createdEl) createdEl.textContent = file.formattedDate;
    if (descEl) descEl.textContent = file.description || 'Описание отсутствует';

    const downloadLink = document.querySelector('[data-action="download"]');
    if (downloadLink) {
      downloadLink.href = `/api/files/${file.id}/download`;
    }

    document.querySelectorAll('.owner-only').forEach((el) => {
      el.style.display = data.isOwner ? '' : 'none';
    });

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
