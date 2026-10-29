'use strict';
// Shema baze + migracije (idempotentno). Kliče jo /api/setup.
const { getPool } = require('./db');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    color VARCHAR(16) DEFAULT '#4f7fff',
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ip VARCHAR(64), user_agent VARCHAR(255),
    INDEX (user_id), INDEX (expires_at),
    CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    kind ENUM('shared','personal','savings','cash') NOT NULL DEFAULT 'shared',
    owner_user_id INT NULL,
    color VARCHAR(16) DEFAULT '#4f7fff',
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    sort INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (owner_user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    type ENUM('income','expense') NOT NULL,
    color VARCHAR(16) DEFAULT '#8a94a6',
    icon VARCHAR(8) DEFAULT '',
    sort INT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('income','expense','transfer') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    account_id INT NOT NULL,
    counter_account_id INT NULL,
    category_id INT NULL,
    person_user_id INT NULL,
    tdate DATE NOT NULL,
    note VARCHAR(190),
    recurring_id INT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (account_id), INDEX (tdate), INDEX (category_id), INDEX (counter_account_id),
    CONSTRAINT fk_tx_acc FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS recurring (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('income','expense','transfer') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    account_id INT NOT NULL,
    counter_account_id INT NULL,
    category_id INT NULL,
    person_user_id INT NULL,
    day_of_month TINYINT NOT NULL DEFAULT 1,
    note VARCHAR(190),
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_run VARCHAR(7) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL,
    account_id INT NULL,
    color VARCHAR(16) DEFAULT '#2fae6b',
    due_date DATE NULL,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS goal_contributions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    goal_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    cdate DATE NOT NULL,
    note VARCHAR(190),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (goal_id),
    CONSTRAINT fk_gc_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(60) PRIMARY KEY,
    v TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const DEFAULT_CATEGORIES = [
  ['Plača', 'income', '#2fae6b', '💶'], ['Dodatni prihodek', 'income', '#4f7fff', '➕'],
  ['Darilo', 'income', '#a371f7', '🎁'], ['Vračilo', 'income', '#2bb2c0', '↩️'],
  ['Hrana', 'expense', '#e0623a', '🛒'], ['Režije', 'expense', '#d2922a', '💡'],
  ['Najemnina/kredit', 'expense', '#c0453a', '🏠'], ['Prevoz', 'expense', '#4f7fff', '🚗'],
  ['Zdravje', 'expense', '#2fae6b', '💊'], ['Zabava', 'expense', '#a371f7', '🎉'],
  ['Oblačila', 'expense', '#e06aa0', '👕'], ['Naročnine', 'expense', '#8a6ad0', '📺'],
  ['Otroci', 'expense', '#2bb2c0', '🧸'], ['Drugo', 'expense', '#8a94a6', '•'],
];

async function migrate() {
  const pool = getPool();
  for (const sql of TABLES) await pool.query(sql);
  // privzete kategorije samo ob prvem zagonu
  const [cnt] = await pool.query(`SELECT COUNT(*) AS n FROM categories`);
  if (Number(cnt[0].n) === 0) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const [n, t, c, ic] = DEFAULT_CATEGORIES[i];
      await pool.query(`INSERT INTO categories (name,type,color,icon,sort) VALUES (?,?,?,?,?)`, [n, t, c, ic, i]);
    }
  }
  await pool.query(`INSERT INTO settings (k,v) VALUES ('schema_version','1') ON DUPLICATE KEY UPDATE v=VALUES(v)`);
  return { tables: TABLES.length };
}

module.exports = { migrate, TABLES, DEFAULT_CATEGORIES };
