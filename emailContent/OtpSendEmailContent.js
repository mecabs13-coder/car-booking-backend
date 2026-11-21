function OtpSendEmailContent(data) {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <p>Hello ${data.name},</p>
            <p>Thank you for using Deepfake Product! To complete your process, please use the following One Time Password (OTP):</p>
            <h3 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px;">${data.otp}</h3>
            <p>This OTP is valid for ${data.expiry} minutes. Please do not share this OTP with anyone.</p>
            <p>If you did not request this OTP, please ignore this email.</p>
            <p>Best regards,</p>
            <p>The Deepfake Team</p>
        </div>
    `;

    return htmlContent;
}

module.exports = OtpSendEmailContent;