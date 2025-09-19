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

function formatBytes(bytes = 0) {
  if (!bytes) {
    return '0 Б';
  }

  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}

let dropzoneInputElement = null;
let normalizeSelectedFiles = (fileList) => fileList;
let renderSelectedFiles = () => {};

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
  dropzoneInputElement = dropzone.querySelector('input[type="file"]') || null;
  const dropzoneList = dropzone.querySelector('[data-dropzone-list]');
  const dropzoneMessage = dropzone.querySelector('[data-dropzone-message]');
  const dropzoneSummary = dropzone.querySelector('[data-dropzone-summary]');
  const defaultMessage = dropzoneMessage ? dropzoneMessage.textContent : '';
  const maxFilesAttr = parseInt(dropzone.getAttribute('data-max-files'), 10);
  const maxFiles = Number.isFinite(maxFilesAttr) && maxFilesAttr > 0 ? maxFilesAttr : Infinity;

  normalizeSelectedFiles = (fileList) => {
    if (!dropzoneInputElement) {
      return fileList;
    }

    const filesArray = Array.from(fileList || []);
    if (!filesArray.length) {
      dropzoneInputElement.value = '';
      return dropzoneInputElement.files;
    }

    let selectedFiles = filesArray;
    if (maxFiles !== Infinity && filesArray.length > maxFiles) {
      pushFlash('error', `Можно выбрать до ${maxFiles} файлов за одну загрузку. Лишние файлы будут отброшены.`);
      selectedFiles = filesArray.slice(0, maxFiles);
    }

    if (typeof DataTransfer === 'undefined') {
      return fileList;
    }

    const transfer = new DataTransfer();
    selectedFiles.forEach((file) => transfer.items.add(file));
    dropzoneInputElement.files = transfer.files;
    return dropzoneInputElement.files;
  };

  renderSelectedFiles = (fileList) => {
    if (!dropzoneList || !dropzoneMessage) {
      return;
    }

    const files = Array.from(fileList || []);
    dropzoneList.innerHTML = '';

    if (!files.length) {
      dropzone.classList.remove('has-files');
      dropzoneList.hidden = true;
      if (dropzoneSummary) {
        dropzoneSummary.hidden = true;
      }
      if (defaultMessage) {
        dropzoneMessage.textContent = defaultMessage;
      }
      return;
    }

    dropzone.classList.add('has-files');
    dropzoneList.hidden = false;
    let totalSize = 0;

    files.forEach((file) => {
      totalSize += file.size || 0;
      const item = document.createElement('li');
      item.className = 'dropzone-item';

      const name = document.createElement('span');
      name.className = 'dropzone-item__name';
      name.textContent = file.name;

      const size = document.createElement('span');
      size.className = 'dropzone-item__size';
      size.textContent = formatBytes(file.size || 0);

      item.appendChild(name);
      item.appendChild(size);
      dropzoneList.appendChild(item);
    });

    dropzoneMessage.textContent =
      files.length === 1 ? 'Выбран 1 файл' : `Выбрано файлов: ${files.length}`;

    if (dropzoneSummary) {
      dropzoneSummary.textContent = `Общий объём: ${formatBytes(totalSize)}`;
      dropzoneSummary.hidden = false;
    }
  };

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
      const normalized = normalizeSelectedFiles(files);
      renderSelectedFiles(normalized);
    }
  });

  dropzone.addEventListener('click', () => {
    if (dropzoneInputElement) {
      dropzoneInputElement.click();
    }
  });

  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (dropzoneInputElement) {
        dropzoneInputElement.click();
      }
    }
  });

  if (dropzoneInputElement) {
    renderSelectedFiles(dropzoneInputElement.files);
  }
}

const uploadForm = document.getElementById('upload-form');
if (uploadForm && window.FormData && window.XMLHttpRequest) {
  const fileInput = dropzoneInputElement || uploadForm.querySelector('input[type="file"]');
  const submitButton = uploadForm.querySelector('button[type="submit"]');
  const progressPanel = uploadForm.querySelector('[data-upload-progress]');
  const progressBar = uploadForm.querySelector('[data-upload-bar]');
  const progressPercent = uploadForm.querySelector('[data-upload-percent]');
  const progressStatus = uploadForm.querySelector('[data-upload-status]');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const normalized = normalizeSelectedFiles(fileInput.files);
      renderSelectedFiles(normalized);
    });
  }

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

    if (!fileInput) {
      pushFlash('error', 'Выберите файлы для загрузки.');
      return;
    }

    const normalizedFiles = normalizeSelectedFiles(fileInput.files);
    const filesToUpload = normalizedFiles || fileInput.files;

    renderSelectedFiles(filesToUpload);

    if (!filesToUpload || !filesToUpload.length) {
      pushFlash('error', 'Выберите файлы для загрузки.');
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
        updateStatus('Загрузка файлов…');
      } else {
        updateStatus('Файлы загружены, завершаем обработку…');
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
        (response && response.message) || 'Не удалось загрузить файлы. Попробуйте ещё раз.';
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
