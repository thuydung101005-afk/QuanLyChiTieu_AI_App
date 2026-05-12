import express from 'express';
import cors from 'cors';
import { initDb, getJars, getTransactions, addTransaction, getDatabaseInfoForAI, createJar, deleteJar, updateJar, bulkUpdateJars, addIncome, getUserById, deleteTransaction, getJarByConcept, updateTransactionJar, getJarByLocalHistory, addRecurringTransaction, processRecurringTransactions, getMonthlySummaryForAI, hasSentAIReportThisMonth, markAIReportSent, createNotification, getAllUsers, getUserBudget, setUserBudget, getActiveKiemVuong, getSpikeTxIds, dismissKiemVuong } from './database.js';
import db from './database.js';
import { runSpikeCheck, runBurnRateCheck } from './analyzeService.js';
import { GoogleGenAI } from '@google/genai';
import "dotenv/config";
import axios from 'axios';
import authRoutes from './authRoutes.js';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

// Middleware to verify JWT token
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: 'Token is required' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        (req as any).user = user;
        next();
    });
};

// Routes
app.use('/api/auth', authRoutes);

// Session validation endpoint (for localStorage auto-restore)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const user = getUserById(userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json({ valid: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize SQLite database
initDb();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_NODE || process.env.GEMINI_API_KEY });

const generateAndSendMonthlyAIReport = async (userId: string, year: number, month: number) => {
    try {
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        if (hasSentAIReportThisMonth(userId, monthStr)) return false;

        const summary = getMonthlySummaryForAI(userId, year, month);

        // Skip if no income and no expense
        if (summary.totalIncome === 0 && summary.totalExpense === 0) return false;

        const user = getUserById(userId);
        const userName = user ? user.username : 'bạn';

        const prompt = `Bạn là chuyên gia tài chính cá nhân thân thiện (tên là Bé Trứng). Dựa trên dữ liệu tài chính tháng trước của người dùng tên là "${userName}":
Tổng thu: ${summary.totalIncome.toLocaleString()}đ
Tổng chi: ${summary.totalExpense.toLocaleString()}đ
Hũ chi nhiều nhất: ${summary.highestSpendingCategory} (${summary.highestSpendingAmount.toLocaleString()}đ)

Hãy viết 1 nhận xét hoặc lời khuyên thật ngắn gọn, dưới 50 từ, mang phong cách chuyên gia nhưng gần gũi. Bắt buộc xưng hô là "Bé Trứng" và gọi người dùng bằng tên "${userName}".`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const textRes = response.text || "Tháng qua bạn đã quản lý tốt, hãy tiếp tục phát huy nhé!";

        createNotification(userId, `Báo cáo tháng ${month}`, textRes, 'ai');
        markAIReportSent(userId, monthStr);
        return true;
    } catch (err: any) {
        console.error(`AI Report Error for user ${userId}:`, err.message);
        return false;
    }
};

// Endpoints
app.post('/api/auth/notifications/trigger-monthly-ai', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12 (current month — for demo purposes)
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

        // For demo: clear the flag so report can be triggered multiple times
        db.prepare('DELETE FROM ai_reports_log WHERE user_id = ? AND month_str = ?').run(userId, monthStr);

        const sent = await generateAndSendMonthlyAIReport(userId, year, month);
        if (!sent) {
            return res.status(200).json({ success: false, message: 'Không đủ dữ liệu để tạo báo cáo tháng này. Hãy thêm một số giao dịch trước nhé!' });
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
// ─── MONTHLY BUDGET ──────────────────────────────────────────────────────────
app.get('/api/budget', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const budget = getUserBudget(userId);
        res.json({ success: true, monthly_budget: budget });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/budget', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { monthly_budget } = req.body;
        const value = Number(monthly_budget);
        if (!Number.isFinite(value) || value < 0) {
            return res.status(400).json({ error: 'Hạn mức không hợp lệ' });
        }
        setUserBudget(userId, value);
        res.json({ success: true, monthly_budget: value });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/jars', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const jars = getJars(userId);
        res.json(jars);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/jars', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { name, split_amount, color, icon, concept_type, sourceJarId } = req.body;
        if (!name || split_amount === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const jarId = `${userId}_${Date.now()}`; // Unique custom jar id

        const payload = createJar({
            id: jarId,
            user_id: userId,
            name,
            split_amount,
            color: color || '#ccc',
            icon: icon || 'piggy-bank',
            concept_type: concept_type || 'GIAO_DICH_KHAC'
        }, sourceJarId);

        res.status(201).json({ success: true, id: jarId, newJarPercent: payload?.newJarPercent || 0 });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/jars/bulk', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { updates } = req.body; // array of { id, percent }
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ error: "Invalid updates format" });
        }
        bulkUpdateJars(userId, updates);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/jars/:id', authenticateToken, (req, res) => {
    try {
        const jarId = req.params.id;
        const userId = (req as any).user.userId;
        const { name, allocation_percent } = req.body;

        updateJar(jarId, userId, name, allocation_percent);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/jars/:id', authenticateToken, (req, res) => {
    try {
        const jarId = req.params.id;
        const userId = (req as any).user.userId;

        deleteJar(jarId, userId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const transactions = getTransactions(userId);
        res.json(transactions);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/predict', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Missing description" });
        }

        // Fetch dynamic jars for this user
        const jars = getJars(userId) as any[];
        if (!jars || jars.length === 0) {
            return res.status(400).json({ error: "User has no custom jars configured." });
        }

        // IMPORTANT: Chỉ gửi "hũ custom thực sự" (GIAO_DICH_KHAC) lên TF-IDF zero-shot.
        // Các hũ mặc định (Thiết yếu, Giải trí...) có tên chung chung sẽ bị TF-IDF match nhầm,
        // do đó chúng phải được quyết định bởi FastText + Local History.
        const customJarsForTfidf = jars.filter((j: any) => j.concept_type === 'GIAO_DICH_KHAC');

        // 1. Send description to Python Microservice (Global Concept Architecture)
        const pythonResponse = await axios.post('http://127.0.0.1:8000/predict', {
            text: description,
            jars: customJarsForTfidf.map((j: any) => ({ id: j.id, name: j.name }))
        });

        const brain1Result = pythonResponse.data;

        // 2. Map Global Concept back to the User's specific Jar
        let predictedTargetJarId = jars[0].id; // Fallback

        // Step A: Luôn kiểm tra Lịch Sử Cá nhân TRƯỚC (ưu tiên cao nhất)
        const historyMatch = getJarByLocalHistory(userId, brain1Result.predicted_concept, description);

        if (historyMatch) {
            // Lịch sử cá nhân là ưu tiên số 1 - luôn tin tưởng thói quen người dùng
            predictedTargetJarId = historyMatch.jar_id;
            console.log(`[Predict] ✅ Local History Override → jar_id: ${historyMatch.jar_id}`);
        } else if (brain1Result.predicted_jar_id) {
            // Step B: TF-IDF đã chốt chắc nịch một hũ custom (Zero-shot) - dùng khi không có lịch sử
            predictedTargetJarId = brain1Result.predicted_jar_id;
            console.log(`[Predict] 🎯 TF-IDF Zero-shot → jar_id: ${brain1Result.predicted_jar_id}`);
        } else {
            // Step C: Fallback - lấy hũ đầu tiên cùng Concept (hũ mặc định cũ nhất)
            const mappedJar = getJarByConcept(userId, brain1Result.predicted_concept);
            if (mappedJar) {
                predictedTargetJarId = mappedJar.id;
                console.log(`[Predict] 💡 Concept Default → jar_id: ${mappedJar.id}, concept: ${brain1Result.predicted_concept}`);
            }
        }

        // 3. Return to Frontend
        res.status(200).json({
            success: true,
            brain_1_result: {
                ...brain1Result,
                predicted_jar_id: predictedTargetJarId // Inject the mapped ID for UI to highlight
            }
        });
    } catch (err: any) {
        console.error("Brain 1 Prediction Error:", err.message);
        res.status(500).json({ error: 'Python microservice prediction failed. ' + err.message });
    }
});

// The final save route after user confirms the bubble
app.post('/api/transactions/confirm', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { amount, description, jar_id, category_id, predicted_jar_id, is_recurring } = req.body;

        const id = Date.now().toString();
        const dateNow = new Date().toISOString();

        addTransaction({
            id,
            amount,
            description,
            category_id: category_id || jar_id, // fallback
            date: dateNow,
            jar_id
        });

        // RECURRING TRIGGER
        if (is_recurring) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            addRecurringTransaction({
                id: `rec_${id}`,
                user_id: userId,
                amount,
                description,
                jar_id,
                type: 'expense',
                next_date: nextMonth.toISOString()
            });
        }

        // AUTO-LEARNING TRIGGER: User corrected the prediction
        if (predicted_jar_id && jar_id !== predicted_jar_id) {
            const jars = getJars(userId);
            const selectedJar = jars.find((j: any) => j.id === jar_id);
            if (selectedJar && selectedJar.concept_type && description) {
                axios.post('http://127.0.0.1:8000/learn', {
                    text: description,
                    concept: selectedJar.concept_type
                }).catch(err => {
                    console.error("[Auto-learn] Python service not reachable:", err.message);
                });
            }
        }

        // ── BRAIN 2 — Phân tích sau khi giao dịch lưu thành công ────────
        // Không động vào logic Brain 1 ở trên. Chỉ ĐỌC dữ liệu và sinh KiemVuong.
        let spikeAlert: any = null;
        try {
            const spike = runSpikeCheck(userId, { id, amount, description, jar_id });
            if (spike.isSpike) {
                spikeAlert = {
                    title: '🔥 Giao dịch đột biến',
                    message: spike.message,
                    ratio: spike.ratio,
                    median: spike.median
                };
            }

            // Burn Rate cho hũ vừa được chi
            const allJars = getJars(userId) as any[];
            const targetJar = allJars.find(j => j.id === jar_id);
            if (targetJar) {
                runBurnRateCheck(userId, {
                    id: targetJar.id,
                    name: targetJar.name,
                    balance: targetJar.balance,
                    allocation_percent: targetJar.allocation_percent
                });
            }
        } catch (err: any) {
            console.error('[Brain2] Analysis error (non-blocking):', err.message);
        }

        res.status(201).json({
            success: true,
            id,
            spike_alert: spikeAlert
        });
    } catch (err: any) {
        console.error("Save Transaction Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Insights API (Brain 2 output) ───────────────────────────────────────
app.get('/api/insights', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const insights = getActiveKiemVuong(userId, 10);
        // Parse evidence_json về object cho FE dễ dùng
        const formatted = insights.map((i: any) => ({
            ...i,
            evidence: i.evidence_json ? safeJsonParse(i.evidence_json) : null
        }));
        res.json({ success: true, insights: formatted });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/insights/:id/dismiss', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const insightId = req.params.id;
        const info = dismissKiemVuong(insightId, userId);
        res.json({ success: true, updated: info.changes });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Trả về danh sách tx_id đang được flag SPIKE (FE dùng để vẽ badge)
app.get('/api/insights/spike-tx-ids', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const ids = getSpikeTxIds(userId);
        res.json({ success: true, tx_ids: ids });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

function safeJsonParse(s: string) {
    try { return JSON.parse(s); } catch { return null; }
}

// Income Route
app.post('/api/incomes', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { amount, description, is_recurring } = req.body;
        if (!amount) {
            return res.status(400).json({ error: "Missing amount" });
        }

        addIncome(userId, amount, description);

        if (is_recurring) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            // Since income is split across jars, we just assign to the first jar for record keeping
            // But wait, addIncome splits it, so recurring income should just be handled differently
            // PENDING FIX: MISA typically allows recurring for specific jars, but for now we'll store it as 'income' on user's first jar
            const jars = getJars(userId) as any[];
            if (jars.length > 0) {
                addRecurringTransaction({
                    id: `rec_${Date.now()}`,
                    user_id: userId,
                    amount,
                    description: description || 'Thu nhập định kỳ',
                    jar_id: jars[0].id,
                    type: 'income',
                    next_date: nextMonth.toISOString()
                });
            }
        }

        res.status(201).json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a transaction (and reverse jar balance)
app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const txId = req.params.id;

        deleteTransaction(txId);
        res.json({ success: true });
    } catch (err: any) {
        console.error('Delete Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Auto-Learning Endpoint: Update Transaction Jar
app.put('/api/transactions/:id/jar', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const txId = req.params.id;
        const { newJarId } = req.body;

        if (!newJarId) return res.status(400).json({ error: 'Missing Data' });

        // 1. Update Database and Balances
        const tx = updateTransactionJar(txId, newJarId);

        // 2. Retrieve the global concept of the newly assigned Jar
        const jars = getJars(userId);
        const newJar = jars.find((j: any) => j.id === newJarId);

        // 3. Fire-and-forget request to Python AI Service for Auto-Learning
        if (newJar && newJar.concept_type && tx.description) {
            axios.post('http://127.0.0.1:8000/learn', {
                text: tx.description,
                concept: newJar.concept_type
            }).catch(err => {
                console.error("[Auto-learn] Python service not reachable:", err.message);
            });
        }

        res.json({ success: true });
    } catch (err: any) {
        console.error('Update Transaction Jar Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const { message } = req.body;

        const dbInfo = getDatabaseInfoForAI(userId);

        // ── Bổ sung Insights từ Brain 2 vào context để Bé Trứng trả lời sắc bén hơn ──
        const insights = getActiveKiemVuong(userId, 5);
        const insightsText = insights.length > 0
            ? insights.map((i: any) => `- [${i.severity}] ${i.title}: ${i.message}${i.suggestion ? ` (Gợi ý: ${i.suggestion})` : ''}`).join('\n')
            : '(không có)';

        // ── COMPACT FORMAT — Tiết kiệm 70% token Gemini ────────────────────────
        // Trước: JSON.stringify full object → ~3300 token
        // Sau:  inline format → ~700 token
        const jarsCompact = (dbInfo.jars as any[])
            .map(j => `${j.name}(${Math.round(j.balance).toLocaleString()}đ/${j.allocation_percent}%)`)
            .join(' | ');

        // Chỉ gửi tối đa 8 giao dịch gần nhất, format ngắn gọn
        const recentTxs = (dbInfo.recentTransactions as any[]).slice(0, 8);
        const txCompact = recentTxs.length > 0
            ? recentTxs.map(t => {
                const d = new Date(t.date);
                const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
                const sign = t.type === 'income' ? '+' : '-';
                return `${dateStr} ${t.description} ${sign}${Math.round(Math.abs(t.amount)).toLocaleString()}đ`;
            }).join(' | ')
            : '(chưa có)';

        const prompt = `Bạn là Bé Trứng (Egg-u) — trợ lý tài chính cá nhân hình quả trứng dễ thương, theo phương pháp 6 hũ.

DỮ LIỆU NGƯỜI DÙNG:
• Hũ: ${jarsCompact}
• Giao dịch gần (8 cái): ${txCompact}
• Phát hiện từ phòng phân tích:
${insightsText}

CÁCH TRẢ LỜI:
- Xưng "Bé Trứng" hoặc "Tớ", gọi user là "bạn" hoặc "cậu"
- Ngắn gọn (dưới 4 câu), thân thiện
- Nếu phát hiện liên quan đến câu hỏi → lồng số liệu cụ thể vào
- Nếu không liên quan → KHÔNG đề cập
- Cuối câu kèm gợi ý dưới dạng: [Gợi ý: "Câu 1", "Câu 2"]

Câu hỏi: "${message}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const textRes = response.text || "Bé Trứng đang suy nghĩ, bạn chờ xíu nha!";

        // Extract suggestions if any
        const suggestionMatch = textRes.match(/\[Gợi ý:(.*?)\]$/);
        let suggestions: string[] = [];
        let cleanText = textRes;

        if (suggestionMatch && suggestionMatch[1]) {
            cleanText = textRes.replace(/\[Gợi ý:.*?\]$/, '').trim();
            suggestions = suggestionMatch[1].split(',').map(s => s.replace(/"/g, '').trim());
        }

        res.json({ reply: cleanText, suggestions });
    } catch (err: any) {
        console.error("AI Error:", err);
        res.status(500).json({ error: 'Bé Trứng đang bận chút việc, bạn thử lại sau nha~' });
    }
});

app.listen(port, () => {
    console.log(`Backend API running on http://localhost:${port}`);

    // CRONJOB: Check recurring transactions every minute
    setInterval(() => {
        try {
            const processedCount = processRecurringTransactions();
            if (processedCount > 0) {
                console.log(`[CRON] Processed ${processedCount} recurring transactions.`);
            }
        } catch (err: any) {
            console.error(`[CRON] Error processing recurring transactions:`, err.message);
        }
    }, 60000);

    // CRONJOB: Check monthly AI reports (Runs every hour)
    setInterval(async () => {
        try {
            const date = new Date();
            // Run on the 1st of the month
            if (date.getDate() === 1) {
                let year = date.getFullYear();
                let month = date.getMonth(); // last month
                if (month === 0) {
                    month = 12;
                    year -= 1;
                }

                const users = getAllUsers();
                let count = 0;
                for (const user of users) {
                    const sent = await generateAndSendMonthlyAIReport(user.id, year, month);
                    if (sent) count++;
                    // Add small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 1000));
                }
                if (count > 0) {
                    console.log(`[CRON] Sent ${count} Monthly AI Reports.`);
                }
            }
        } catch (err: any) {
            console.error(`[CRON] Error sending monthly AI reports:`, err.message);
        }
    }, 3600000); // Check every hour
});
