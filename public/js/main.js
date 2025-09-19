const flashContainer = document.querySelector('[data-flash-container]');

function attachFlashDismiss(button) {
  if (!button) {
    return;
  }

  button.addEventListener('click', () => {
    const flash = button.closest('.flash');
    if (flash) {
      flash.classList.add('is-hidden');
      setTimeout(() => flash.remove(), 200);
    }
  });
}

document
  .querySelectorAll('[data-action="dismiss"]')
  .forEach((button) => attachFlashDismiss(button));

function pushFlash(type, message) {
  if (!flashContainer || !type || !message) {
    return;
  }

  const flash = document.createElement('div');
  flash.className = `flash flash-${type}`;
  flash.setAttribute('role', 'alert');

  const text = document.createElement('span');
  text.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'flash-close';
  close.dataset.action = 'dismiss';
  close.textContent = '×';

  flash.appendChild(text);
  flash.appendChild(close);
  flashContainer.appendChild(flash);
  attachFlashDismiss(close);
  flash.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const dialogs = document.querySelectorAll('.dialog');

document.querySelectorAll('[data-dialog-open]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const target = trigger.getAttribute('data-dialog-open');
    const dialog = document.getElementById(`dialog-${target}`);
    if (dialog) {
      dialog.hidden = false;
      const input = dialog.querySelector('input[type="text"]');
      if (input) {
        input.focus();
      }
    }
  });
});

document.querySelectorAll('[data-dialog-close]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const dialog = trigger.closest('.dialog');
    if (dialog) {
      dialog.hidden = true;
    }
  });
});

dialogs.forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.hidden = true;
    }
  });
});

const confirmButtons = document.querySelectorAll('[data-confirm]');
confirmButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    const message = button.getAttribute('data-confirm');
    if (!window.confirm(message || 'Вы уверены?')) {
      event.preventDefault();
    }
  });
});

const dropzone = document.querySelector('[data-dropzone]');
if (dropzone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      const input = dropzone.querySelector('input[type="file"]');
      if (input) {
        input.files = files;
      }
    }
  });
}

const uploadForm = document.getElementById('upload-form');
if (uploadForm && window.FormData && window.XMLHttpRequest) {
  const fileInput = uploadForm.querySelector('input[type="file"]');
  const submitButton = uploadForm.querySelector('button[type="submit"]');
  const progressPanel = uploadForm.querySelector('[data-upload-progress]');
  const progressBar = uploadForm.querySelector('[data-upload-bar]');
  const progressPercent = uploadForm.querySelector('[data-upload-percent]');
  const progressStatus = uploadForm.querySelector('[data-upload-status]');

  const setProgress = (value) => {
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${Math.min(100, Math.max(0, Math.round(value)))}%`;
    }
  };

  const updateStatus = (message, state) => {
    if (!progressStatus) {
      return;
    }
    progressStatus.textContent = message;
    progressStatus.classList.remove('is-error', 'is-success');
    if (state === 'error') {
      progressStatus.classList.add('is-error');
    } else if (state === 'success') {
      progressStatus.classList.add('is-success');
    }
  };

  const handleFailure = (message) => {
    if (progressPanel) {
      progressPanel.hidden = false;
    }
    setProgress(0);
    updateStatus(message, 'error');
    if (submitButton) {
      submitButton.disabled = false;
    }
    pushFlash('error', message);
  };

  uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      pushFlash('error', 'Выберите файл для загрузки.');
      return;
    }

    if (progressPanel) {
      progressPanel.hidden = false;
    }
    setProgress(0);
    updateStatus('Подготовка к загрузке…');

    if (submitButton) {
      submitButton.disabled = true;
    }

    const formData = new FormData(uploadForm);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadForm.getAttribute('action'), true);

    const csrfToken = window.__SECURE_DRIVE__?.csrfToken || formData.get('_csrf');
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.addEventListener('progress', (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        return;
      }
      const percent = (progressEvent.loaded / progressEvent.total) * 100;
      setProgress(percent);
      if (percent < 100) {
        updateStatus('Загрузка файла…');
      } else {
        updateStatus('Файл загружен, завершаем обработку…');
      }
    });

    xhr.addEventListener('load', () => {
      if (submitButton) {
        submitButton.disabled = false;
      }

      let response;
      try {
        response = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        response = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && response) {
        setProgress(100);
        updateStatus('Загрузка завершена. Перенаправляем…', 'success');
        const redirectTarget = response.redirect || '/dashboard';
        setTimeout(() => {
          window.location.assign(redirectTarget);
        }, 600);
        return;
      }

      const message =
        (response && response.message) || 'Не удалось загрузить файл. Попробуйте ещё раз.';
      handleFailure(message);
    });

    xhr.addEventListener('error', () => {
      if (submitButton) {
        submitButton.disabled = false;
      }
      handleFailure('Произошла ошибка соединения. Попробуйте ещё раз.');
    });

    xhr.send(formData);
  });
}

const csrfMeta = document.querySelector('meta[name="csrf-token"]');
if (csrfMeta) {
  window.__SECURE_DRIVE__ = {
    csrfToken: csrfMeta.getAttribute('content')
  };
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    dialogs.forEach((dialog) => {
      if (!dialog.hidden) {
        dialog.hidden = true;
      }
    });
  }
});
