const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const auditLogFile = path.join(rootDir, 'data', 'audit.log');

function persistLogEntry(entry) {
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFile(auditLogFile, line, (error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Не удалось записать событие безопасности', error);
    }
  });
}

function logEvent(level, message, details = {}) {
  const entry = {
    level,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  persistLogEntry(entry);
}

function logSecurityEvent(action, message, details = {}) {
  logEvent('security', `${action}: ${message}`, details);
}

function logSystem(message, details = {}) {
  logEvent('system', message, details);
}

function logError(error) {
  if (!error) {
    return;
  }
  const payload = {
    name: error.name,
    stack: error.stack
  };
  logEvent('error', error.message || 'Неизвестная ошибка', payload);
}

function logUserAction(userId, action, details = {}) {
  logEvent('action', `${userId}: ${action}`, {
    userId,
    ...details
  });
}

module.exports = {
  logSecurityEvent,
  logSystem,
  logError,
  logUserAction
};
