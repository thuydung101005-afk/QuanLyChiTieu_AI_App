import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'FinBrain App <onboarding@resend.dev>';

function buildOtpEmail(otp: string, type: 'verify' | 'reset', username?: string): string {
    const isVerify = type === 'verify';
    const title = isVerify ? 'Xác minh tài khoản' : 'Đặt lại mật khẩu';
    const subtitle = isVerify
        ? 'Cảm ơn bạn đã đăng ký FinBrain! Nhập mã bên dưới để kích hoạt tài khoản.'
        : 'Nhập mã bên dưới để đặt lại mật khẩu của bạn.';
    const color = isVerify ? '#FF7FA3' : '#a78bfa';

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FFF5F8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(255,127,163,0.15);max-width:480px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${color} 0%,#ff9ec2 100%);padding:36px 40px 28px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">🐣</div>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">FinBrain</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${username ? `<p style="color:#333;font-size:15px;margin:0 0 8px;">Xin chào <strong>${username}</strong>,</p>` : ''}
              <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 28px;">${subtitle}</p>

              <!-- OTP Box -->
              <div style="background:#FFF0F5;border:2px dashed ${color};border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Mã xác nhận của bạn</p>
                <div style="font-size:44px;font-weight:900;letter-spacing:12px;color:${color};font-family:monospace;">${otp}</div>
                <p style="margin:10px 0 0;color:#999;font-size:12px;">⏱ Mã có hiệu lực trong <strong>5 phút</strong></p>
              </div>

              <p style="color:#888;font-size:12px;line-height:1.6;margin:0;text-align:center;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.<br/>
                Đừng chia sẻ mã này với bất kỳ ai.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#FFF5F8;padding:20px 40px;text-align:center;border-top:1px solid #FFE5E5;">
              <p style="margin:0;color:#bbb;font-size:11px;">© 2025 FinBrain AI App · Quản lý chi tiêu thông minh</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(to: string, otp: string, type: 'verify' | 'reset', username?: string): Promise<void> {
    const subject = type === 'verify'
        ? '🐣 FinBrain - Mã xác minh tài khoản của bạn'
        : '🔐 FinBrain - Mã đặt lại mật khẩu';

    const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject,
        html: buildOtpEmail(otp, type, username),
    });

    if (error) {
        throw new Error(`Resend error: ${error.message}`);
    }
}
