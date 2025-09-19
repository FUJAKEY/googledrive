const fs = require('fs/promises');
const path = require('path');

const auditLogPath = path.join(__dirname, '..', '..', 'data', 'audit.log');

async function getRecentEvents(filter = () => true, limit = 50) {
  try {
    const raw = await fs.readFile(auditLogPath, 'utf-8');
    if (!raw) {
      return [];
    }

    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .reverse();

    const events = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (filter(event)) {
          events.push(event);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Ошибка разбора события аудита', error);
      }
      if (events.length >= limit) {
        break;
      }
    }

    return events;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function getUserEvents(userId, limit = 20) {
  if (!userId) {
    return [];
  }

  return getRecentEvents((event) => {
    if (event.details && event.details.userId) {
      return event.details.userId === userId;
    }
    if (typeof event.message === 'string') {
      return event.message.startsWith(`${userId}:`);
    }
    return false;
  }, limit);
}

module.exports = {
  getRecentEvents,
  getUserEvents
};
