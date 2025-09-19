const { DateTime } = require('luxon');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(isoString) {
  return DateTime.fromISO(isoString).setLocale('ru').toFormat('dd LLL yyyy, HH:mm');
}

module.exports = {
  formatBytes,
  formatDate
};
