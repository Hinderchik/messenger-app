import { sendVerificationEmail } from './_email.js';

export default async function handler(req, res) {
    const result = await sendVerificationEmail('test@example.com', 'TestUser', 'test-token-123');
    res.json({ sent: result, message: result ? 'Email sent' : 'Failed' });
}
