
const nodemailer = require("nodemailer");
require("dotenv").config();

const SendEmail = async (emailTemplate, data) => {
  try {
    if (!process.env.EMAILID || !process.env.EMAILPASSWORD) {
      throw new Error("EMAILID or EMAILPASSWORD is missing in .env");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAILID,
        pass: process.env.EMAILPASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAILID,
      to: data.email,
      subject: data.subject,
      html: emailTemplate(data),
    };

    const result = await transporter.sendMail(mailOptions);

    console.log("OTP email sent:", result.messageId);

    return result;
  } catch (error) {
    console.error("Nodemailer error:", error);
    throw error;
  }
};

module.exports = { SendEmail };
