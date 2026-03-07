import express from 'express';
import cors from 'cors';
import { initDb, getJars, getTransactions, addTransaction, getDatabaseInfoForAI, createJar, deleteJar, updateJar, addIncome, getUserById, deleteTransaction, getJarByConcept, updateTransactionJar, getJarByLocalHistory } from './database.js';
import { GoogleGenAI } from '@google/genai';
import "dotenv/config";
import axios from 'axios';
import authRoutes from './authRoutes.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Session validation endpoint (for localStorage auto-restore)
app.get('/api/auth/me', (req, res) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) return res.status(401).json({ error: 'No userId provided' });
        const user = getUserById(userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json({ valid: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize SQLite database
initDb();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Endpoints
app.get('/api/jars', (req, res) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) {
            return res.status(400).json({ error: "Missing User ID" });
        }
        const jars = getJars(userId);
        res.json(jars);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/jars', (req, res) => {
    try {
        const { userId, name, allocation_percent, color, icon, concept_type, sourceJarId } = req.body;
        if (!userId || !name || allocation_percent === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const jarId = `${userId}_${Date.now()}`; // Unique custom jar id

        createJar({
            id: jarId,
            user_id: userId,
            name,
            allocation_percent,
            color: color || '#ccc',
            icon: icon || 'piggy-bank',
            concept_type: concept_type || 'GIAO_DICH_KHAC'
        }, sourceJarId);

        res.status(201).json({ success: true, id: jarId });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/jars/:id', (req, res) => {
    try {
        const jarId = req.params.id;
        const { userId, name, allocation_percent } = req.body;

        if (!userId) return res.status(400).json({ error: "Missing User ID" });

        updateJar(jarId, userId, name, allocation_percent);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/jars/:id', (req, res) => {
    try {
        const jarId = req.params.id;
        const userId = req.query.userId as string;

        if (!userId) return res.status(400).json({ error: "Missing User ID" });

        deleteJar(jarId, userId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions', (req, res) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) {
            return res.status(400).json({ error: "Missing User ID" });
        }
        const transactions = getTransactions(userId);
        res.json(transactions);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/predict', async (req, res) => {
    try {
        const { description, userId } = req.body;

        if (!description || !userId) {
            return res.status(400).json({ error: "Missing description or User ID" });
        }

        // Fetch dynamic jars for this user
        const jars = getJars(userId);
        if (!jars || jars.length === 0) {
            return res.status(400).json({ error: "User has no custom jars configured." });
        }

        // 1. Send description to Python Microservice (Global Concept Architecture)
        const pythonResponse = await axios.post('http://127.0.0.1:8000/predict', {
            text: description
        });

        const brain1Result = pythonResponse.data;

        // 2. Map Global Concept back to the User's specific Jar using Local History Override
        let predictedTargetJarId = jars[0].id; // Fallback

        // Step 1: Lọc Lịch sử Cá nhân (Local History)
        const historyMatch = getJarByLocalHistory(userId, brain1Result.predicted_concept, description);

        if (historyMatch) {
            // Đã từng có giao dịch chứa từ khóa này
            predictedTargetJarId = historyMatch.jar_id;
        } else {
            // Step 2: Nếu chưa có lịch sử, lấy hũ đầu tiên cùng Concept (Default Jar)
            const mappedJar = getJarByConcept(userId, brain1Result.predicted_concept);
            if (mappedJar) {
                predictedTargetJarId = mappedJar.id;
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
app.post('/api/transactions/confirm', (req, res) => {
    try {
        const { amount, description, jar_id, category_id, userId, predicted_jar_id } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "Missing User ID" });
        }

        const id = Date.now().toString();

        addTransaction({
            id,
            amount,
            description,
            category_id: category_id || jar_id, // fallback
            date: new Date().toISOString(),
            jar_id
        });

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

        res.status(201).json({
            success: true,
            id
        });
    } catch (err: any) {
        console.error("Save Transaction Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Income Route
app.post('/api/incomes', (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        if (!userId || !amount) {
            return res.status(400).json({ error: "Missing User ID or amount" });
        }

        addIncome(userId, amount, description);
        res.status(201).json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a transaction (and reverse jar balance)
app.delete('/api/transactions/:id', (req, res) => {
    try {
        const txId = req.params.id;
        const userId = req.query.userId as string;
        if (!userId) return res.status(400).json({ error: 'Missing User ID' });

        deleteTransaction(txId);
        res.json({ success: true });
    } catch (err: any) {
        console.error('Delete Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Auto-Learning Endpoint: Update Transaction Jar
app.put('/api/transactions/:id/jar', async (req, res) => {
    try {
        const txId = req.params.id;
        const { newJarId, userId } = req.body;

        if (!userId || !newJarId) return res.status(400).json({ error: 'Missing Data' });

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

app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "Missing User ID" });
        }

        const dbInfo = getDatabaseInfoForAI(userId);

        const prompt = `Bạn là một trợ lý ảo hình quả trứng dễ thương tên là Egg-u, giúp quản lý chi tiêu theo phương pháp 6 chiếc lọ.
Đây là dữ liệu tài chính hiện tại của người dùng:
Các lọ (Jars): ${JSON.stringify(dbInfo.jars, null, 2)}
Giao dịch gần đây: ${JSON.stringify(dbInfo.recentTransactions, null, 2)}

Trả lời câu hỏi sau của người dùng một cách thân thiện, xưng hô là "Bé Trứng" hoặc "Tớ" và gọi người dùng là "bạn" hoặc "cậu": 
"${message}"

Trả lời phải ngắn gọn (dưới 4 câu) và có kèm 1-2 từ khoá gợi ý câu hỏi tiếp theo ở cuối dưới dạng [Gợi ý: "Câu hỏi 1", "Câu hỏi 2"].`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
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
});
