import Database from 'better-sqlite3';
import Fuse from 'fuse.js';

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
      concept_type TEXT NOT NULL,
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

  try {
    db.prepare(`ALTER TABLE jars ADD COLUMN concept_type TEXT NOT NULL DEFAULT 'GIAO_DICH_KHAC'`).run();
  } catch {
    // Column already exists
  }

  // Training data table for Hybrid AI (Brain 1 self-improvement)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS training_data (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      concept TEXT NOT NULL,
      source TEXT DEFAULT 'gemini',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Jars will be seeded per user on signup.
};

export const seedDefaultJarsForUser = (userId: string) => {
  const insertJar = db.prepare(`
       INSERT INTO jars (id, user_id, name, allocation_percent, balance, color, icon, concept_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

  // Using composite IDs (user_id + '_' + type) to keep them unique across the table
  // IDs are composite (userId_type) – NO spaces allowed
  insertJar.run(`${userId}_necessities`, userId, 'Thiết yếu', 55, 0, '#4ade80', 'home', 'THIET_YEU');
  insertJar.run(`${userId}_play`, userId, 'Giải trí', 10, 0, '#f472b6', 'gamepad', 'HUONG_THU');
  insertJar.run(`${userId}_financial_freedom`, userId, 'Tự do tài chính', 10, 0, '#60a5fa', 'trending-up', 'DAU_TU');
  insertJar.run(`${userId}_education`, userId, 'Giáo dục', 10, 0, '#fbbf24', 'book-open', 'GIAO_DUC');
  insertJar.run(`${userId}_long_term_savings`, userId, 'Tiết kiệm dài hạn', 10, 0, '#a78bfa', 'piggy-bank', 'TICH_LUY');
  insertJar.run(`${userId}_give`, userId, 'Cho đi', 5, 0, '#fb923c', 'heart', 'CHO_DI');
};

export const getJars = (userId: string) => {
  return db.prepare('SELECT * FROM jars WHERE user_id = ?').all(userId);
};

export const getJarByConcept = (userId: string, conceptType: string) => {
  return db.prepare('SELECT * FROM jars WHERE user_id = ? AND concept_type = ?').get(userId, conceptType) as any | undefined;
};

const STOP_WORDS = new Set([
  'mua', 'bán', 'đi', 'trả', 'tiền', 'hết', 'cho', 'vay', 'mượn', 'đóng', 'nạp',
  'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười',
  'những', 'các', 'cái', 'chiếc', 'bộ', 'vài', 'đợt', 'lần', 'khoản', 'phí'
]);

function extractCoreKeywords(text: string): string {
  // 1. Loại bỏ số tiền và ký hiệu (giống logic extract_name bên Python FastText)
  let cleanText = text.replace(/(?:\b(?:giá|hết)\s*)?\b\d+(?:[\.,]\d+)*(?:\s*[kKmMtTrR]|(?:\s*ngàn|\s*nghìn|\s*lít|\s*củ|\s*đồng|\s*vnd|\s*vnđ|đ|\s*cành|\s*đ)?)?\b/ig, '');
  cleanText = cleanText.replace(/[\+\-\*/,=]/g, ' ');

  // 2. Tách từ và lọc Stop Words
  const tokens = cleanText.toLowerCase().split(/\s+/);
  const coreTokens = tokens.filter(w => !STOP_WORDS.has(w) && w.length > 0);
  return coreTokens.join(' ').trim();
}

export const getJarByLocalHistory = (userId: string, conceptType: string, description: string) => {
  const normalizedDesc = description.toLowerCase().trim();
  const searchStr = extractCoreKeywords(normalizedDesc) || normalizedDesc;

  // 1. Thử Tìm Kiếm Chính Xác (Exact Match)
  let row = db.prepare(`
    SELECT t.jar_id 
    FROM transactions t 
    JOIN jars j ON t.jar_id = j.id 
    WHERE j.user_id = ? AND j.concept_type = ? AND LOWER(t.description) = ?
    ORDER BY t.date DESC LIMIT 1
  `).get(userId, conceptType, normalizedDesc) as any;

  if (row) return row;

  // 2. Lấy tối đa 100 giao dịch gần nhất của concept này
  const txs = db.prepare(`
    SELECT t.jar_id, t.description 
    FROM transactions t 
    JOIN jars j ON t.jar_id = j.id 
    WHERE j.user_id = ? AND j.concept_type = ?
    ORDER BY t.date DESC LIMIT 100
  `).all(userId, conceptType) as any[];

  if (txs.length === 0) return null;

  // Map txs back to have a processed description for better fuzzy match
  const txData = txs.map(tx => ({
    jar_id: tx.jar_id,
    core_desc: extractCoreKeywords(tx.description) || tx.description.toLowerCase()
  }));

  // 3. Sử dụng Fuse.js
  const fuse = new Fuse(txData, {
    keys: ['core_desc'],
    includeScore: true,
    threshold: 0.4, // Phù hợp với sai chính tả cơ bản
    distance: 100,
  });

  const results = fuse.search(searchStr);

  if (results.length > 0 && results[0].score !== undefined && results[0].score <= 0.4) {
    return { jar_id: results[0].item.jar_id };
  }

  return null;
};

export const updateJarBalance = (jarId: string, amount: number) => {
  return db.prepare('UPDATE jars SET balance = balance + ? WHERE id = ?').run(amount, jarId);
};

export const createJar = (
  jar: { id: string, user_id: string, name: string, allocation_percent: number, color: string, icon: string, concept_type: string },
  sourceJarId?: string
) => {
  if (sourceJarId) {
    // San Hũ Logic
    return db.transaction(() => {
      const sourceJar = db.prepare('SELECT * FROM jars WHERE id = ? AND user_id = ?').get(sourceJarId, jar.user_id) as any;

      if (!sourceJar) throw new Error("Source jar not found");
      if (sourceJar.allocation_percent <= jar.allocation_percent) {
        throw new Error("Source jar percentage must be greater than new jar percentage");
      }

      // 1. Calculate deducted balance
      const deductedBalance = Math.round((sourceJar.balance * jar.allocation_percent) / sourceJar.allocation_percent);

      // 2. Update Source Jar (% and Balance)
      db.prepare('UPDATE jars SET allocation_percent = allocation_percent - ?, balance = balance - ? WHERE id = ?')
        .run(jar.allocation_percent, deductedBalance, sourceJarId);

      // 3. Create New Jar with deducted balance
      return db.prepare('INSERT INTO jars (id, user_id, name, allocation_percent, balance, color, icon, concept_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(jar.id, jar.user_id, jar.name, jar.allocation_percent, deductedBalance, jar.color, jar.icon, jar.concept_type);
    })();
  } else {
    // Luồng Cũ (Tạo độc lập từ số dư 0%)
    return db.prepare('INSERT INTO jars (id, user_id, name, allocation_percent, color, icon, concept_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(jar.id, jar.user_id, jar.name, jar.allocation_percent, jar.color, jar.icon, jar.concept_type);
  }
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

export const updateTransactionJar = (transactionId: string, newJarId: string) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any;
  if (!tx) throw new Error('Transaction not found');

  if (tx.jar_id !== newJarId) {
    db.transaction(() => {
      // Reverse old jar balance
      const reverseDelta = tx.type === 'expense' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
      updateJarBalance(tx.jar_id, reverseDelta);

      // Apply to new jar
      const forwardDelta = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
      updateJarBalance(newJarId, forwardDelta);

      db.prepare('UPDATE transactions SET jar_id = ?, category_id = ? WHERE id = ?').run(newJarId, newJarId, transactionId);
    })();
  }
  return tx;
}

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
  concept: string;
  source?: string;
}) => {
  return db.prepare(
    'INSERT OR IGNORE INTO training_data (id, text, concept, source) VALUES (?, ?, ?, ?)'
  ).run(entry.id, entry.text, entry.concept, entry.source || 'gemini');
};

export default db;

