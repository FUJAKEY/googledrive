const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const sanitizeFilename = require('sanitize-filename');

const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const uploadDir = path.join(rootDir, 'uploads');

const USERS_FILE = path.join(dataDir, 'users.json');
const ITEMS_FILE = path.join(dataDir, 'items.json');

function ensureJsonFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function initStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  ensureJsonFile(USERS_FILE, []);
  ensureJsonFile(ITEMS_FILE, []);

  const auditLogPath = path.join(dataDir, 'audit.log');
  if (!fs.existsSync(auditLogPath)) {
    fs.writeFileSync(auditLogPath, '');
  }
}

async function readJson(filePath) {
  const content = await fsp.readFile(filePath, 'utf-8');
  return JSON.parse(content || '[]');
}

async function writeJson(filePath, data) {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

function normalizePath(input) {
  if (!input || input === '/') {
    return '/';
  }

  const segments = input
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (!segments.length) {
    return '/';
  }

  const safeSegments = [];

  for (const segment of segments) {
    if (segment === '.' || segment === '') {
      continue;
    }

    if (segment === '..' || segment.includes('..')) {
      throw new Error('Недопустимый путь.');
    }

    const normalized = segment.replace(/\s+/g, ' ');
    const sanitized = sanitizeFilename(normalized);

    if (!sanitized || sanitized !== normalized) {
      throw new Error('Недопустимый путь.');
    }

    safeSegments.push(normalized);
  }

  if (!safeSegments.length) {
    return '/';
  }

  return `/${safeSegments.join('/')}`;
}

function buildFullPath(parentPath, name) {
  const normalizedParent = normalizePath(parentPath);
  if (normalizedParent === '/') {
    return `/${name}`;
  }
  return `${normalizedParent}/${name}`;
}

function sanitizeFolderName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return '';
  }

  const sanitized = sanitizeFilename(trimmed).replace(/\s+/g, ' ');
  if (!sanitized) {
    return '';
  }

  if (sanitized.includes('/') || sanitized.includes('..')) {
    return '';
  }

  return sanitized;
}

async function getUsers() {
  return readJson(USERS_FILE);
}

async function saveUsers(users) {
  await writeJson(USERS_FILE, users);
}

async function findUserByEmail(email) {
  const users = await getUsers();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

async function getUserById(id) {
  const users = await getUsers();
  return users.find((user) => user.id === id);
}

async function createUser({ name, email, passwordHash }) {
  const users = await getUsers();
  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    throw new Error('Пользователь с таким e-mail уже зарегистрирован.');
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    security: {
      passwordUpdatedAt: new Date().toISOString()
    }
  };

  users.push(user);
  await saveUsers(users);
  await ensureUserRootDirectory(user.id);
  return user;
}

async function updateUser(id, updates) {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('Пользователь не найден.');
  }

  users[index] = {
    ...users[index],
    ...updates,
    security: {
      ...users[index].security,
      ...(updates.security || {})
    }
  };

  await saveUsers(users);
  return users[index];
}

async function ensureUserRootDirectory(userId) {
  const userDir = path.join(uploadDir, userId);
  await fsp.mkdir(userDir, { recursive: true });
  return userDir;
}

async function getItems() {
  return readJson(ITEMS_FILE);
}

async function saveItems(items) {
  await writeJson(ITEMS_FILE, items);
}

async function listItems(ownerId, parentPath = '/') {
  const items = await getItems();
  const normalized = normalizePath(parentPath);
  const scoped = items.filter((item) => item.ownerId === ownerId && item.parentPath === normalized);
  return {
    folders: scoped.filter((item) => item.type === 'folder'),
    files: scoped.filter((item) => item.type === 'file')
  };
}

async function getFolderBreadcrumbs(pathValue) {
  const normalized = normalizePath(pathValue);
  if (normalized === '/') {
    return [{ name: 'Мой диск', path: '/' }];
  }

  const segments = normalized.slice(1).split('/');
  const breadcrumbs = [{ name: 'Мой диск', path: '/' }];
  let currentPath = '';

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    breadcrumbs.push({
      name: segment,
      path: `/${currentPath}`
    });
  }

  return breadcrumbs;
}

async function createFolder(ownerId, folderName, parentPath = '/') {
  const name = sanitizeFolderName(folderName);
  if (!name) {
    throw new Error('Недопустимое название папки.');
  }

  const normalizedParent = normalizePath(parentPath);
  const items = await getItems();
  const duplicate = items.find(
    (item) =>
      item.ownerId === ownerId &&
      item.parentPath === normalizedParent &&
      item.type === 'folder' &&
      item.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    throw new Error('Папка с таким названием уже существует.');
  }

  const folder = {
    id: uuidv4(),
    ownerId,
    type: 'folder',
    name,
    parentPath: normalizedParent,
    fullPath: buildFullPath(normalizedParent, name),
    createdAt: new Date().toISOString()
  };

  items.push(folder);
  await saveItems(items);
  return folder;
}

async function registerFile(ownerId, { originalName, storedName, size, mimeType, parentPath = '/' }) {
  const items = await getItems();
  const normalizedParent = normalizePath(parentPath);
  const sanitizedOriginalName = sanitizeFilename(originalName) || `file-${Date.now()}`;

  const fileItem = {
    id: uuidv4(),
    ownerId,
    type: 'file',
    name: sanitizedOriginalName,
    storedName,
    parentPath: normalizedParent,
    fullPath: buildFullPath(normalizedParent, sanitizedOriginalName),
    size,
    mimeType,
    createdAt: new Date().toISOString()
  };

  items.push(fileItem);
  await saveItems(items);
  return fileItem;
}

async function getItemById(id) {
  const items = await getItems();
  return items.find((item) => item.id === id);
}

async function deleteFile(item) {
  const items = await getItems();
  const filtered = items.filter((entry) => entry.id !== item.id);
  await saveItems(filtered);

  const absolutePath = path.join(uploadDir, item.ownerId, item.storedName);
  try {
    await fsp.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function deleteFolder(item) {
  const items = await getItems();
  const descendants = items.filter(
    (entry) => entry.ownerId === item.ownerId && entry.fullPath.startsWith(`${item.fullPath}/`)
  );

  if (descendants.length > 0) {
    throw new Error('Перед удалением очистите вложенные элементы в папке.');
  }

  const filtered = items.filter((entry) => entry.id !== item.id);
  await saveItems(filtered);
}

async function getUserStorageStats(ownerId) {
  const items = await getItems();
  const userFiles = items.filter((item) => item.ownerId === ownerId && item.type === 'file');
  const totalSize = userFiles.reduce((acc, item) => acc + (item.size || 0), 0);
  return {
    totalFiles: userFiles.length,
    totalSize,
    readableSize: formatBytes(totalSize)
  };
}

async function searchItems(ownerId, query) {
  const normalizedQuery = (query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const items = await getItems();
  return items
    .filter((item) => item.ownerId === ownerId && item.name.toLowerCase().includes(normalizedQuery))
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      parentPath: item.parentPath,
      fullPath: item.fullPath,
      createdAt: item.createdAt,
      size: item.size || 0
    }));
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 Б';
  }

  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

module.exports = {
  initStorage,
  findUserByEmail,
  getUserById,
  createUser,
  updateUser,
  ensureUserRootDirectory,
  listItems,
  getFolderBreadcrumbs,
  createFolder,
  registerFile,
  getItemById,
  deleteFile,
  deleteFolder,
  getUserStorageStats,
  searchItems,
  normalizePath,
  sanitizeFolderName
};
