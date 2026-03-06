import Database from 'better-sqlite3';

const db = new Database('finance.db', { verbose: console.log });

// Initialize database tables
export const initDb = () => {
  // Create users table first (referenced by jars)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS jars (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      allocation_percent INTEGER NOT NULL,
      balance REAL DEFAULT 0,
      color TEXT,
      icon TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions(
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category_id TEXT NOT NULL,
      date TEXT NOT NULL,
      jar_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      FOREIGN KEY(jar_id) REFERENCES jars(id)
    )
  `).run();

  // Safe migration: add 'type' column if it doesn't exist yet (for existing DBs)
  try {
    db.prepare(`ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'`).run();
  } catch {
    // Column already exists – ignore
  }

  // Training data table for Hybrid AI (Brain 1 self-improvement)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS training_data (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      jar_id TEXT NOT NULL,
      jar_name TEXT NOT NULL,
      source TEXT DEFAULT 'gemini',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Jars will be seeded per user on signup.
};

export const seedDefaultJarsForUser = (userId: string) => {
  const insertJar = db.prepare(`
       INSERT INTO jars (id, user_id, name, allocation_percent, balance, color, icon) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  // Using composite IDs (user_id + '_' + type) to keep them unique across the table
  // IDs are composite (userId_type) – NO spaces allowed
  insertJar.run(`${userId}_necessities`, userId, 'Thiết yếu', 55, 0, '#4ade80', 'home');
  insertJar.run(`${userId}_play`, userId, 'Giải trí', 10, 0, '#f472b6', 'gamepad');
  insertJar.run(`${userId}_financial_freedom`, userId, 'Tự do tài chính', 10, 0, '#60a5fa', 'trending-up');
  insertJar.run(`${userId}_education`, userId, 'Giáo dục', 10, 0, '#fbbf24', 'book-open');
  insertJar.run(`${userId}_long_term_savings`, userId, 'Tiết kiệm dài hạn', 10, 0, '#a78bfa', 'piggy-bank');
  insertJar.run(`${userId}_give`, userId, 'Cho đi', 5, 0, '#fb923c', 'heart');
};

export const getJars = (userId: string) => {
  return db.prepare('SELECT * FROM jars WHERE user_id = ?').all(userId);
};

export const updateJarBalance = (jarId: string, amount: number) => {
  return db.prepare('UPDATE jars SET balance = balance + ? WHERE id = ?').run(amount, jarId);
};

export const createJar = (jar: { id: string, user_id: string, name: string, allocation_percent: number, color: string, icon: string }) => {
  return db.prepare('INSERT INTO jars (id, user_id, name, allocation_percent, color, icon) VALUES (?, ?, ?, ?, ?, ?)')
    .run(jar.id, jar.user_id, jar.name, jar.allocation_percent, jar.color, jar.icon);
};

export const updateJar = (id: string, userId: string, name: string, percent: number) => {
  return db.prepare('UPDATE jars SET name = ?, allocation_percent = ? WHERE id = ? AND user_id = ?')
    .run(name, percent, id, userId);
};

export const deleteJar = (id: string, userId: string) => {
  // Delete transactions associated with this jar first
  db.prepare('DELETE FROM transactions WHERE jar_id = ?').run(id);
  return db.prepare('DELETE FROM jars WHERE id = ? AND user_id = ?').run(id, userId);
};

export const getTransactions = (userId: string) => {
  return db.prepare(`
    SELECT t.* FROM transactions t
    JOIN jars j ON t.jar_id = j.id
    WHERE j.user_id = ?
    ORDER BY date DESC
      `).all(userId);
};

export const addTransaction = (transaction: {
  id: string;
  amount: number;
  description: string;
  category_id: string;
  date: string;
  jar_id: string;
  type?: 'expense' | 'income';
}) => {
  const txType = transaction.type || 'expense';
  const info = db.prepare(
    'INSERT INTO transactions (id, amount, description, category_id, date, jar_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    transaction.id,
    transaction.amount,
    transaction.description,
    transaction.category_id,
    transaction.date,
    transaction.jar_id,
    txType
  );

  // Expenses decrease jar balance; incomes increase it
  const balanceDelta = txType === 'expense' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);
  updateJarBalance(transaction.jar_id, balanceDelta);

  return info;
};

export const getDatabaseInfoForAI = (userId: string) => {
  const jars = getJars(userId);
  const tx = db.prepare(`
    SELECT t.* FROM transactions t
    JOIN jars j ON t.jar_id = j.id
    WHERE j.user_id = ?
    ORDER BY date DESC LIMIT 20
      `).all(userId);
  return { jars, recentTransactions: tx };
};

export const addIncome = (userId: string, totalAmount: number, description: string = "Nạp tiền ngân sách") => {
  const jars = getJars(userId) as { id: string, name: string, allocation_percent: number }[];
  if (!jars.length) throw new Error("User has no jars configured");

  const date = new Date().toISOString();

  // Distribute totalamount by percent
  db.transaction(() => {
    jars.forEach(jar => {
      const amountForJar = (totalAmount * jar.allocation_percent) / 100;
      if (amountForJar > 0) {
        // Update jar balance directly (positive addition)
        updateJarBalance(jar.id, amountForJar);

        // Add a transaction record for this specific jar (type = income)
        db.prepare('INSERT INTO transactions (id, amount, description, category_id, date, jar_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(`${Date.now()}_${jar.id}`, amountForJar, description, jar.id, date, jar.id, 'income');
      }
    });
  })();
};

export const getUserById = (userId: string) => {
  return db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(userId);
};

export const deleteTransaction = (id: string) => {
  // Fetch transaction first so we can reverse the balance
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as {
    amount: number; jar_id: string; type: string
  } | undefined;

  if (!tx) throw new Error('Transaction not found');

  db.transaction(() => {
    // Reverse the balance effect
    const reverseDelta = tx.type === 'expense' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
    updateJarBalance(tx.jar_id, reverseDelta);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  })();
};

export const addTrainingData = (entry: {
  id: string;
  text: string;
  jar_id: string;
  jar_name: string;
  source?: string;
}) => {
  return db.prepare(
    'INSERT OR IGNORE INTO training_data (id, text, jar_id, jar_name, source) VALUES (?, ?, ?, ?, ?)'
  ).run(entry.id, entry.text, entry.jar_id, entry.jar_name, entry.source || 'gemini');
};

export default db;

