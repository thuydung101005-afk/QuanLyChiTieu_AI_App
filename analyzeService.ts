/**
 * Brain 2 — Tầng Phân tích (Analytical Layer)
 * ============================================
 * KHÔNG động vào logic AI Phân loại (Brain 1).
 * Chỉ ĐỌC dữ liệu, áp rule thống kê, ghi vào bảng kiem_vuong.
 *
 * Các phát hiện hiện tại:
 *  • SPIKE       — Giao dịch đột biến so với lịch sử cùng loại
 *  • BURN_RATE   — Hũ sắp cháy ngân sách trước cuối tháng
 *
 * Chạy reactive (sau mỗi addTransaction) — không cần cron.
 */

import {
  createKiemVuong,
  getSimilarTransactionsForSpike,
  getJarSpendingThisMonth,
} from './database.js';

// ─── Util: Median (chống outlier tốt hơn mean) ─────────────────────────────
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── 1. SPIKE DETECTION ────────────────────────────────────────────────────
// Phát hiện giao dịch đột biến: amount > 2.5x median của các giao dịch tương tự
export interface SpikeResult {
  isSpike: boolean;
  ratio?: number;
  median?: number;
  message?: string;
}

export function runSpikeCheck(
  userId: string,
  tx: { id: string; amount: number; description: string; jar_id: string }
): SpikeResult {
  try {
    const similar = getSimilarTransactionsForSpike(userId, tx.description, tx.jar_id, 90);

    // Loại trừ chính giao dịch vừa thêm (nếu có)
    const past = similar.filter(s => s.amount !== tx.amount).map(s => s.amount);

    if (past.length < 3) return { isSpike: false }; // Không đủ data để so sánh

    const med = median(past);
    if (med <= 0) return { isSpike: false };

    const ratio = tx.amount / med;
    const SPIKE_THRESHOLD = 2.5;

    if (ratio < SPIKE_THRESHOLD) return { isSpike: false };

    // Tạo KiemVuong
    const severity: 'medium' | 'high' = ratio >= 5 ? 'high' : 'medium';
    const message = `"${tx.description}" hôm nay là ${tx.amount.toLocaleString()}đ, đắt gấp ${ratio.toFixed(1)} lần mức bình thường (${med.toLocaleString()}đ).`;
    const suggestion = ratio >= 5
      ? 'Cậu kiểm tra lại xem có nhập nhầm số không nhé!'
      : 'Có vẻ hôm nay tiêu hơi mạnh tay, để ý chút nha~';

    createKiemVuong({
      user_id: userId,
      type: 'SPIKE',
      severity,
      jar_id: tx.jar_id,
      tx_id: tx.id,
      period_key: tx.id, // mỗi tx_id là 1 spike duy nhất
      title: '🔥 Giao dịch đột biến',
      message,
      suggestion,
      evidence: { tx_id: tx.id, amount: tx.amount, median: med, ratio: Number(ratio.toFixed(2)) }
    });

    return { isSpike: true, ratio, median: med, message };
  } catch (err: any) {
    console.error('[Brain2-Spike] Error:', err.message);
    return { isSpike: false };
  }
}

// ─── 2. BURN RATE FORECAST ─────────────────────────────────────────────────
// Dự báo hũ sắp cháy ngân sách trước cuối tháng
export function runBurnRateCheck(
  userId: string,
  jar: { id: string; name: string; balance: number; allocation_percent: number }
): boolean {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Cần ít nhất 5 ngày trong tháng để dự báo có ý nghĩa
    if (dayOfMonth < 5) return false;

    const spent = getJarSpendingThisMonth(jar.id, year, month);
    const totalBudget = jar.balance + spent; // số tiền hũ có ban đầu trong tháng

    if (totalBudget <= 0) return false;

    const dailyAvg = spent / dayOfMonth;
    const projectedSpend = dailyAvg * daysInMonth;
    const projectedRatio = projectedSpend / totalBudget;

    // Cảnh báo nếu dự báo > 110% ngân sách
    if (projectedRatio < 1.1) return false;

    const severity: 'medium' | 'high' = projectedRatio >= 1.3 ? 'high' : 'medium';
    const remainingDays = daysInMonth - dayOfMonth;
    const willRunOutInDays = jar.balance > 0 ? Math.ceil(jar.balance / dailyAvg) : 0;

    const message = jar.balance > 0
      ? `Hũ "${jar.name}" cứ đà này còn ~${willRunOutInDays} ngày nữa là cạn (còn ${remainingDays} ngày mới hết tháng).`
      : `Hũ "${jar.name}" đã cạn ngân sách giữa tháng rồi! Đã chi ${spent.toLocaleString()}đ.`;

    const suggestion = severity === 'high'
      ? 'Tớ khuyên cậu giảm tốc độ chi ở hũ này, hoặc nạp thêm tiền nhé.'
      : 'Cân nhắc tiết chế chi tiêu ở hũ này trong những ngày còn lại nha~';

    createKiemVuong({
      user_id: userId,
      type: 'BURN_RATE',
      severity,
      jar_id: jar.id,
      period_key: `${year}-${month.toString().padStart(2, '0')}:${jar.id}`, // 1 cảnh báo / hũ / tháng
      title: '🔥 Hũ sắp cháy ngân sách',
      message,
      suggestion,
      evidence: {
        jar_name: jar.name,
        spent,
        total_budget: totalBudget,
        days_passed: dayOfMonth,
        days_in_month: daysInMonth,
        projected_spend: Math.round(projectedSpend),
        projected_ratio: Number(projectedRatio.toFixed(2))
      }
    });

    return true;
  } catch (err: any) {
    console.error('[Brain2-BurnRate] Error:', err.message);
    return false;
  }
}
