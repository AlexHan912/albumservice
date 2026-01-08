// api/send.js
// Это код выполняется НА СЕРВЕРЕ. Клиент его не видит.

import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
    // Разрешаем только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Получаем данные от клиента (из app.js)
        const { imageBase64, caption } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // 2. Достаем секреты из настроек Vercel
        const BOT_TOKEN = process.env.TG_BOT_TOKEN;
        const CHAT_ID = process.env.TG_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Server misconfiguration (tokens missing)' });
        }

        // 3. Превращаем Base64 обратно в картинку (Buffer)
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 4. Формируем посылку для Телеграма
        const form = new FormData();
        form.append('chat_id', CHAT_ID);
        form.append('caption', caption);
        form.append('document', imageBuffer, {
            filename: 'cover_order.png',
            contentType: 'image/png',
        });

        // 5. Отправляем в Телеграм
        const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });

        const tgData = await tgResponse.json();

        if (!tgData.ok) {
            throw new Error(tgData.description);
        }

        // 6. Отвечаем клиенту, что все ок
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}
