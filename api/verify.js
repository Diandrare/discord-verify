const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { user_id, cf_response } = req.body;

    if (!user_id || !cf_response) {
        return res.status(400).json({ message: 'Missing user_id or captcha response' });
    }

    // Ambil variabel dari Vercel Environment Variables
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const GUILD_ID = process.env.GUILD_ID;
    const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID;
    const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
    const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;

    try {
        // 1. Verifikasi Captcha dengan Cloudflare Turnstile API
        const captchaVerify = await axios.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            new URLSearchParams({
                secret: TURNSTILE_SECRET,
                response: cf_response
            })
        );

        if (!captchaVerify.data.success) {
            return res.status(400).json({ message: 'Captcha verification failed or expired.' });
        }

        // 2. Eksekusi Perubahan Role di Discord API Secara Langsung
        const discordHeaders = {
            Authorization: `Bot ${BOT_TOKEN.trim()}`,
            'Content-Type': 'application/json'
        };

        const baseUrl = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user_id}/roles`;

        // Hapus Unverified Role (jika ada)
        if (UNVERIFIED_ROLE_ID && UNVERIFIED_ROLE_ID !== '0') {
            await axios.delete(`${baseUrl}/${UNVERIFIED_ROLE_ID}`, { headers: discordHeaders }).catch(() => {});
        }

        // Tambah Member Role
        await axios.put(`${baseUrl}/${MEMBER_ROLE_ID}`, {}, { headers: discordHeaders });

        // Tambah Verified Role
        await axios.put(`${baseUrl}/${VERIFIED_ROLE_ID}`, {}, { headers: discordHeaders });

        return res.status(200).json({ success: true, message: 'Roles granted successfully!' });

    } catch (error) {
        console.error('Error during verification:', error.response?.data || error.message);
        return res.status(500).json({ 
            message: 'Failed to update roles in Discord. Make sure Bot Token and Role IDs are correct.' 
        });
    }
};
