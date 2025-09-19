const flashCloseButtons = document.querySelectorAll('[data-action="dismiss"]');
flashCloseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const flash = button.closest('.flash');
    if (flash) {
      flash.classList.add('is-hidden');
      setTimeout(() => flash.remove(), 200);
    }
  });
});

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
