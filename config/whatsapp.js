const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsAppMessage = async (to, message) => {
    try {
        await client.messages.create({
            body: message,
            from: "whatsapp:+14155238886", // Twilio sandbox number
            to: `whatsapp:${to}`
        });
    } catch (error) {
        console.error("WhatsApp Error:", error.message);
    }
};

module.exports = { sendWhatsAppMessage };