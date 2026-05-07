import Database from 'better-sqlite3';
import Fuse from 'fuse.js';

const db = new Database('finance.db', { verbose: console.log });
db.pragma('journal_mode = WAL');

// Initialize database tables
export const initDb = () => {
  // Create users table first (referenced by jars)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      is_verified INTEGER DEFAULT 0,
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

  db.prepare(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      jar_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      next_date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  // OTP codes table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )
  `).run();

  // Notifications table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'system',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  // AI Reports Log table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_reports_log (
      user_id TEXT NOT NULL,
      month_str TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, month_str),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  // ── Brain 2: KiemVuong (Insights / Cảnh báo) ─────────────────────────────
  // Lưu các phát hiện từ Tầng Phân tích (Spike, Burn Rate...)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS kiem_vuong (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      jar_id TEXT,
      tx_id TEXT,
      period_key TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      evidence_json TEXT,
      suggestion TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, type, period_key),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  // Safe migrations for existing DBs
  try { db.prepare(`ALTER TABLE users ADD COLUMN email TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`).run(); } catch {}
  try { db.prepare(`ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 5000000`).run(); } catch {}

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
  // ORDER BY rowid ASC ensures we always prefer the OLDEST (default) jar when multiple jars share the same concept_type
  return db.prepare('SELECT * FROM jars WHERE user_id = ? AND concept_type = ? ORDER BY rowid ASC').get(userId, conceptType) as any | undefined;
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

  // 1. Thử Tìm Kiếm Chính Xác (Exact Match) - tìm trong TẤT CẢ hũ của user (không lọc concept_type)
  //    để hũ cũ có lịch sử không bị bỏ qua
  let row = db.prepare(`
    SELECT t.jar_id 
    FROM transactions t 
    JOIN jars j ON t.jar_id = j.id 
    WHERE j.user_id = ? AND LOWER(t.description) = ?
    ORDER BY t.date DESC LIMIT 1
  `).get(userId, normalizedDesc) as any;

  if (row) return row;

  // 2. Lấy tối đa 150 giao dịch gần nhất của TẤT CẢ hũ (không lọc concept để bắt lịch sử hũ cũ)
  const txs = db.prepare(`
    SELECT t.jar_id, t.description 
    FROM transactions t 
    JOIN jars j ON t.jar_id = j.id 
    WHERE j.user_id = ? AND t.type = 'expense'
    ORDER BY t.date DESC LIMIT 150
  `).all(userId) as any[];

  if (txs.length === 0) return null;

  // Map txs back to have a processed description for better fuzzy match
  const txData = txs.map(tx => ({
    jar_id: tx.jar_id,
    core_desc: extractCoreKeywords(tx.description) || tx.description.toLowerCase()
  }));

  // 3. Sử dụng Fuse.js để tìm giao dịch tương tự nhất
  const fuse = new Fuse(txData, {
    keys: ['core_desc'],
    includeScore: true,
    threshold: 0.35, // Ngưỡng chặt hơn một chút để tránh match nhầm
    distance: 100,
  });

  const results = fuse.search(searchStr);

  if (results.length > 0 && results[0].score !== undefined && results[0].score <= 0.35) {
    const matchedJarId = results[0].item.jar_id;
    // Ưu tiên dùng lịch sử nếu khớp tốt, bất kể concept_type
    return { jar_id: matchedJarId };
  }

  // 4. Fallback: Tìm trong lịch sử của đúng concept_type
  const conceptTxs = db.prepare(`
    SELECT t.jar_id, t.description 
    FROM transactions t 
    JOIN jars j ON t.jar_id = j.id 
    WHERE j.user_id = ? AND j.concept_type = ?
    ORDER BY t.date DESC LIMIT 100
  `).all(userId, conceptType) as any[];

  if (conceptTxs.length === 0) return null;

  const conceptTxData = conceptTxs.map(tx => ({
    jar_id: tx.jar_id,
    core_desc: extractCoreKeywords(tx.description) || tx.description.toLowerCase()
  }));

  const fuse2 = new Fuse(conceptTxData, {
    keys: ['core_desc'],
    includeScore: true,
    threshold: 0.4,
    distance: 100,
  });

  const results2 = fuse2.search(searchStr);

  if (results2.length > 0 && results2[0].score !== undefined && results2[0].score <= 0.4) {
    return { jar_id: results2[0].item.jar_id };
  }

  return null;
};

export const updateJarBalance = (jarId: string, amount: number) => {
  return db.prepare('UPDATE jars SET balance = balance + ? WHERE id = ?').run(amount, jarId);
};

export const createJar = (
  jar: { id: string, user_id: string, name: string, split_amount: number, color: string, icon: string, concept_type: string },
  sourceJarId?: string
) => {
  if (sourceJarId) {
    // San Hũ Logic bằng TIỀN MẶT
    return db.transaction(() => {
      const sourceJar = db.prepare('SELECT * FROM jars WHERE id = ? AND user_id = ?').get(sourceJarId, jar.user_id) as any;

      if (!sourceJar) throw new Error("Hũ nguồn không tồn tại");
      if (sourceJar.balance <= 0) throw new Error("Hũ nguồn phải có số dư lớn hơn 0 để có thể phân rã tự động");
      if (sourceJar.balance < jar.split_amount) throw new Error(`Số tiền trích (${jar.split_amount}) lớn hơn số dư hiện tại của hũ nguồn (${sourceJar.balance})`);

      const deductedBalance = jar.split_amount;
      
      // Tính ngầm % Tương lai cho hũ con (Nội dung chốt của Giám đốc Sản phẩm)
      const calculatedPercent = Math.round((deductedBalance / sourceJar.balance) * sourceJar.allocation_percent);
      const newJarPercent = Math.max(0, calculatedPercent); 
      const updatedSourcePercent = Math.max(0, sourceJar.allocation_percent - newJarPercent);

      // Cập nhật Hũ nguồn
      db.prepare('UPDATE jars SET allocation_percent = ?, balance = balance - ? WHERE id = ?')
        .run(updatedSourcePercent, deductedBalance, sourceJarId);

      // Tạo Hũ con mới
      db.prepare('INSERT INTO jars (id, user_id, name, allocation_percent, balance, color, icon, concept_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(jar.id, jar.user_id, jar.name, newJarPercent, deductedBalance, jar.color, jar.icon, jar.concept_type);

      return { newJarPercent };
    })();
  } else {
    // Luồng cũ (nếu cần dùng) tạo độc lập bằng 0% và 0đ
    return db.prepare('INSERT INTO jars (id, user_id, name, allocation_percent, color, icon, concept_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(jar.id, jar.user_id, jar.name, 0, jar.color, jar.icon, jar.concept_type);
  }
};

export const bulkUpdateJars = (userId: string, updates: { id: string, percent: number }[]) => {
  return db.transaction(() => {
    // Tính tổng để đảm bảo backend cũng bảo vệ 100%
    const total = updates.reduce((sum, u) => sum + u.percent, 0);
    if (total !== 100) throw new Error("Tổng phân bổ phần trăm không bằng 100%");
    
    const stmt = db.prepare('UPDATE jars SET allocation_percent = ? WHERE id = ? AND user_id = ?');
    for (const update of updates) {
      stmt.run(update.percent, update.id, userId);
    }
  })();
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

  // Trigger Notification for Alert >= 80% budget
  if (txType === 'expense') {
    const jar = db.prepare('SELECT * FROM jars WHERE id = ?').get(transaction.jar_id) as any;
    if (jar && jar.allocation_percent > 0) {
      const dateObj = new Date(transaction.date);
      const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
      const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      const spentRow = db.prepare(`
        SELECT SUM(amount) as total 
        FROM transactions 
        WHERE jar_id = ? AND type = 'expense' AND date >= ? AND date <= ?
      `).get(jar.id, startOfMonth, endOfMonth) as any;
      
      const totalSpent = spentRow?.total || 0;
      const totalAvailable = jar.balance + totalSpent;
      
      if (totalAvailable > 0) {
        const percentSpent = (totalSpent / totalAvailable) * 100;
        const previousSpent = totalSpent - Math.abs(transaction.amount);
        const previousPercent = (previousSpent / totalAvailable) * 100;
        
        if (percentSpent >= 80 && percentSpent <= 100 && previousPercent < 80) {
          createNotification(
            jar.user_id, 
            'Cảnh báo ngân sách', 
            `Hũ "${jar.name}" đã tiêu hết ${Math.round(percentSpent)}% ngân sách khả dụng!`, 
            'alert'
          );
        }
        
        if (percentSpent > 100 && previousPercent <= 100) {
          createNotification(
            jar.user_id, 
            'Vượt ngân sách!', 
            `Hũ "${jar.name}" đã chi vượt mức (lên đến ${Math.round(percentSpent)}%). Vui lòng cân đối lại!`, 
            'alert'
          );
        }
      }
    }
  }

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
  return db.prepare('SELECT id, username, email, is_verified, created_at FROM users WHERE id = ?').get(userId);
};

export const getUserBudget = (userId: string): number => {
  const row = db.prepare('SELECT monthly_budget FROM users WHERE id = ?').get(userId) as any;
  return row?.monthly_budget ?? 5000000;
};

export const setUserBudget = (userId: string, budget: number) => {
  return db.prepare('UPDATE users SET monthly_budget = ? WHERE id = ?').run(budget, userId);
};

export const getAllUsers = () => {
  return db.prepare('SELECT id, username FROM users').all() as any[];
};

export const getUserByEmail = (email: string) => {
  return db.prepare('SELECT id, username, email, is_verified, created_at FROM users WHERE email = ?').get(email) as any | undefined;
};

export const getUserByUsername = (username: string) => {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any | undefined;
};

export const setUserVerified = (userId: string) => {
  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);
};

export const setUserEmail = (userId: string, email: string) => {
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
};

export const updateUserPassword = (userId: string, hashedPassword: string) => {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
};

// OTP helpers
export const createOtp = (email: string, otp: string, type: 'verify' | 'reset'): string => {
  // Invalidate previous OTPs of same type for this email
  db.prepare(`DELETE FROM otp_codes WHERE email = ? AND type = ?`).run(email, type);

  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
  db.prepare('INSERT INTO otp_codes (id, email, otp, type, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, email, otp, type, expiresAt);
  return id;
};

export const verifyOtp = (email: string, otp: string, type: 'verify' | 'reset'): { valid: boolean; reason?: string } => {
  const record = db.prepare(
    `SELECT * FROM otp_codes WHERE email = ? AND otp = ? AND type = ? AND used = 0 ORDER BY expires_at DESC LIMIT 1`
  ).get(email, otp, type) as any;

  if (!record) return { valid: false, reason: 'Mã OTP không đúng' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: 'Mã OTP đã hết hạn' };

  // Mark as used
  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(record.id);
  return { valid: true };
};

export const generateOtp = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
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

export const addRecurringTransaction = (tx: {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  jar_id: string;
  type: string;
  next_date: string;
}) => {
  return db.prepare(
    'INSERT INTO recurring_transactions (id, user_id, amount, description, jar_id, type, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(tx.id, tx.user_id, tx.amount, tx.description, tx.jar_id, tx.type, tx.next_date);
};

export const processRecurringTransactions = () => {
  const now = new Date().toISOString();
  // Find all due recurring transactions
  const dues = db.prepare('SELECT * FROM recurring_transactions WHERE next_date <= ?').all(now) as any[];
  
  if (dues.length === 0) return 0;

  db.transaction(() => {
    dues.forEach(due => {
      // 1. Insert into transactions
      const txId = `${Date.now()}_${due.id}`;
      addTransaction({
        id: txId,
        amount: due.amount,
        description: due.description,
        category_id: due.jar_id,
        date: new Date().toISOString(),
        jar_id: due.jar_id,
        type: due.type as 'expense' | 'income'
      });

      // 2. Calculate next month's date
      const nextDate = new Date(due.next_date);
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      // 3. Update the recurring record
      db.prepare('UPDATE recurring_transactions SET next_date = ? WHERE id = ?').run(nextDate.toISOString(), due.id);

      // 4. Trigger Notification
      createNotification(
        due.user_id, 
        'Giao dịch định kỳ', 
        `Đã tự động ghi nhận: ${due.description} (-${due.amount.toLocaleString()}đ)`, 
        'recurring'
      );
    });
  })();

  return dues.length;
};

// ── Notifications ────────────────────────────────────────────────────────────
export const getNotifications = (userId: string) => {
  return db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
};

export const createNotification = (userId: string, title: string, message: string, type: string = 'system') => {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, title, message, type);
  return id;
};

export const markNotificationRead = (id: string, userId: string) => {
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
};

export const markAllNotificationsRead = (userId: string) => {
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
};

// ── AI Reporting ─────────────────────────────────────────────────────────────
export const getMonthlySummaryForAI = (userId: string, year: number, month: number) => {
  // month is 1-12
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

  const jars = db.prepare('SELECT * FROM jars WHERE user_id = ?').all(userId) as any[];
  const transactions = db.prepare('SELECT * FROM transactions WHERE jar_id IN (SELECT id FROM jars WHERE user_id = ?) AND date >= ? AND date <= ?').all(userId, startOfMonth, endOfMonth) as any[];

  let totalIncome = 0;
  let totalExpense = 0;
  const jarSpending: Record<string, number> = {};
  jars.forEach(j => { jarSpending[j.name] = 0; });

  transactions.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += Math.abs(tx.amount);
      const jar = jars.find(j => j.id === tx.jar_id);
      if (jar) jarSpending[jar.name] += Math.abs(tx.amount);
    }
  });

  let maxJar = '';
  let maxAmount = -1;
  for (const [jarName, amount] of Object.entries(jarSpending)) {
    if (amount > maxAmount) {
      maxAmount = amount;
      maxJar = jarName;
    }
  }

  return {
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    highestSpendingCategory: maxJar,
    highestSpendingAmount: maxAmount,
    jarBalances: jars.map(j => ({ name: j.name, balance: j.balance }))
  };
};

export const hasSentAIReportThisMonth = (userId: string, monthStr: string) => {
  const row = db.prepare('SELECT 1 FROM ai_reports_log WHERE user_id = ? AND month_str = ?').get(userId, monthStr);
  return !!row;
};

export const markAIReportSent = (userId: string, monthStr: string) => {
  db.prepare('INSERT OR IGNORE INTO ai_reports_log (user_id, month_str) VALUES (?, ?)').run(userId, monthStr);
};

// ─── Brain 2: KiemVuong (Insights) Helpers ───────────────────────────────────
export interface KiemVuongInput {
  user_id: string;
  type: 'SPIKE' | 'BURN_RATE' | 'PARETO' | 'SUBSCRIPTION' | 'CONCEPT_DRIFT' | 'HEALTH';
  severity: 'low' | 'medium' | 'high';
  jar_id?: string | null;
  tx_id?: string | null;
  period_key: string;
  title: string;
  message: string;
  evidence?: any;
  suggestion?: string;
}

export const createKiemVuong = (input: KiemVuongInput): string | null => {
  const id = `kv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    db.prepare(`
      INSERT INTO kiem_vuong (id, user_id, type, severity, jar_id, tx_id, period_key, title, message, evidence_json, suggestion, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      id,
      input.user_id,
      input.type,
      input.severity,
      input.jar_id || null,
      input.tx_id || null,
      input.period_key,
      input.title,
      input.message,
      input.evidence ? JSON.stringify(input.evidence) : null,
      input.suggestion || null
    );
    return id;
  } catch (err: any) {
    // UNIQUE constraint → đã có insight cùng (user, type, period) → bỏ qua
    if (String(err.message).includes('UNIQUE')) return null;
    console.error('[KiemVuong Insert Error]', err.message);
    return null;
  }
};

export const getActiveKiemVuong = (userId: string, limit: number = 10) => {
  return db.prepare(`
    SELECT id, type, severity, jar_id, tx_id, title, message, evidence_json, suggestion, status, created_at
    FROM kiem_vuong
    WHERE user_id = ? AND status = 'active'
    ORDER BY 
      CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ?
  `).all(userId, limit) as any[];
};

export const getSpikeTxIds = (userId: string): string[] => {
  const rows = db.prepare(`
    SELECT tx_id FROM kiem_vuong
    WHERE user_id = ? AND type = 'SPIKE' AND tx_id IS NOT NULL
  `).all(userId) as any[];
  return rows.map(r => r.tx_id);
};

export const dismissKiemVuong = (id: string, userId: string) => {
  return db.prepare(`UPDATE kiem_vuong SET status = 'dismissed' WHERE id = ? AND user_id = ?`).run(id, userId);
};

// Lấy giao dịch tương tự dựa trên core_keywords (dùng cho Spike Detection)
// LƯU Ý: KHÔNG sửa logic AI phân loại — đây là helper đọc thuần
export const getSimilarTransactionsForSpike = (
  userId: string,
  description: string,
  jarId: string,
  daysBack: number = 90
): { amount: number; date: string }[] => {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const txs = db.prepare(`
    SELECT t.amount, t.date, t.description
    FROM transactions t
    JOIN jars j ON t.jar_id = j.id
    WHERE j.user_id = ? AND t.type = 'expense' AND t.date >= ?
    ORDER BY t.date DESC LIMIT 200
  `).all(userId, cutoff) as any[];

  if (txs.length === 0) return [];

  const targetCore = extractCoreKeywords(description.toLowerCase()) || description.toLowerCase().trim();
  if (!targetCore) return [];

  // Dùng Fuse.js để tìm các giao dịch có core_keyword tương tự (giống pattern getJarByLocalHistory)
  const txData = txs.map(tx => ({
    amount: tx.amount,
    date: tx.date,
    core: extractCoreKeywords(tx.description.toLowerCase()) || tx.description.toLowerCase()
  }));

  const fuse = new Fuse(txData, {
    keys: ['core'],
    includeScore: true,
    threshold: 0.3,
    distance: 100
  });

  const results = fuse.search(targetCore);
  return results
    .filter(r => r.score !== undefined && r.score <= 0.3)
    .map(r => ({ amount: r.item.amount, date: r.item.date }));
};

// Lấy chi tiêu trong tháng cho 1 hũ (dùng cho Burn Rate)
export const getJarSpendingThisMonth = (jarId: string, year: number, month: number): number => {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59).toISOString();
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE jar_id = ? AND type = 'expense' AND date >= ? AND date <= ?
  `).get(jarId, start, end) as any;
  return row?.total || 0;
};

export default db;

