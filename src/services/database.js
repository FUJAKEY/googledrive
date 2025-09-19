const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'aurora-drive.db');

let databaseInstance = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  ensureDataDirectory();
  databaseInstance = new sqlite3.Database(DB_PATH);
  databaseInstance.configure('busyTimeout', 5000);
  return databaseInstance;
}

function run(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function cb(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function initDb() {
  const db = getDatabase();

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      two_factor_secret TEXT,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      classification TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      target_email TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(file_id) REFERENCES files(id)
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`
  );

  await seedAdminUser();
}

async function seedAdminUser() {
  const db = getDatabase();
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@auroradrive.io';
  const existing = await get(db, 'SELECT * FROM users WHERE email = ?', [adminEmail]);
  if (existing) {
    return existing;
  }

  const password = process.env.ADMIN_PASSWORD || 'Admin#12345';
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const id = uuid();

  await run(
    db,
    `INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    , [id, adminEmail, 'Главный администратор', passwordHash, 'admin', now]
  );

  return { id, email: adminEmail, name: 'Главный администратор', role: 'admin', created_at: now };
}

async function createUser({ email, name, password, role = 'member' }) {
  const db = getDatabase();
  const normalizedEmail = email.toLowerCase();
  const existing = await get(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 12);
  const createdAt = new Date().toISOString();
  await run(
    db,
    `INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    , [id, normalizedEmail, name, passwordHash, role, createdAt]
  );

  return { id, email: normalizedEmail, name, role, created_at: createdAt };
}

async function updateUserRole(userId, role) {
  const db = getDatabase();
  await run(db, 'UPDATE users SET role = ? WHERE id = ?', [role, userId]);
}

async function saveTwoFactorSecret(userId, secret, enabled) {
  const db = getDatabase();
  await run(
    db,
    'UPDATE users SET two_factor_secret = ?, two_factor_enabled = ? WHERE id = ?',
    [secret, enabled ? 1 : 0, userId]
  );
}

async function disableTwoFactor(userId) {
  const db = getDatabase();
  await run(db, 'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?', [userId]);
}

async function findUserByEmail(email) {
  const db = getDatabase();
  return get(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
}

async function findUserById(id) {
  const db = getDatabase();
  return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

async function listUsers() {
  const db = getDatabase();
  return all(db, 'SELECT id, email, name, role, two_factor_enabled, created_at FROM users ORDER BY created_at DESC');
}

async function storeFileRecord({ ownerId, originalName, storedName, mimeType, size, classification, description }) {
  const db = getDatabase();
  const id = uuid();
  const createdAt = new Date().toISOString();
  await run(
    db,
    `INSERT INTO files (id, owner_id, original_name, stored_name, mime_type, size, classification, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [id, ownerId, originalName, storedName, mimeType, size, classification, description, createdAt]
  );
  return { id, owner_id: ownerId, original_name: originalName, stored_name: storedName, mime_type: mimeType, size, classification, description, created_at: createdAt };
}

async function listFilesForUser(user) {
  const db = getDatabase();
  const rows = await all(
    db,
    `SELECT * FROM files WHERE owner_id = ?
     UNION
     SELECT f.* FROM files f
     JOIN shares s ON f.id = s.file_id
     WHERE s.target_email = ?
     ORDER BY created_at DESC`,
    [user.id, user.email]
  );
  return rows;
}

async function listAllFiles() {
  const db = getDatabase();
  return all(db, 'SELECT f.*, u.email AS owner_email FROM files f JOIN users u ON f.owner_id = u.id ORDER BY created_at DESC');
}

async function getFileById(fileId) {
  const db = getDatabase();
  return get(db, 'SELECT * FROM files WHERE id = ?', [fileId]);
}

async function deleteFile(fileId) {
  const db = getDatabase();
  await run(db, 'DELETE FROM shares WHERE file_id = ?', [fileId]);
  await run(db, 'DELETE FROM files WHERE id = ?', [fileId]);
}

async function createShare({ fileId, targetEmail, permission }) {
  const db = getDatabase();
  const id = uuid();
  const createdAt = new Date().toISOString();
  await run(
    db,
    `INSERT INTO shares (id, file_id, target_email, permission, created_at) VALUES (?, ?, ?, ?, ?)`
    , [id, fileId, targetEmail.toLowerCase(), permission, createdAt]
  );
  return { id, file_id: fileId, target_email: targetEmail.toLowerCase(), permission, created_at: createdAt };
}

async function listSharesForFile(fileId) {
  const db = getDatabase();
  return all(db, 'SELECT * FROM shares WHERE file_id = ? ORDER BY created_at DESC', [fileId]);
}

async function removeShare(shareId) {
  const db = getDatabase();
  await run(db, 'DELETE FROM shares WHERE id = ?', [shareId]);
}

async function logAudit({ userId, action, details }) {
  const db = getDatabase();
  const id = uuid();
  const createdAt = new Date().toISOString();
  await run(
    db,
    `INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)`
    , [id, userId || null, action, details || null, createdAt]
  );
}

async function listAuditLogs(limit = 100) {
  const db = getDatabase();
  return all(
    db,
    `SELECT a.*, u.email AS user_email
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  initDb,
  getDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  updateUserRole,
  saveTwoFactorSecret,
  disableTwoFactor,
  storeFileRecord,
  listFilesForUser,
  getFileById,
  deleteFile,
  createShare,
  listSharesForFile,
  removeShare,
  listAllFiles,
  logAudit,
  listAuditLogs
};
