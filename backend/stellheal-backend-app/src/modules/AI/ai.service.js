import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class AiService {

    buildPrompt(type, payload) {
        const prompts = {
            diagnosis: `Ти — AI-асистент лікаря в медичній системі StellHeal.
Пацієнт: вік ${payload.age || '?'} років.
Скарги: ${payload.complaints || ''}
Анамнез: ${payload.anamnesis || ''}
Об'єктивний стан: ${payload.objectiveStatus || ''}
${payload.images?.length ? 'До повідомлення додані фото результатів аналізів пацієнта — врахуй їх при формуванні діагнозу.' : ''}

Запропонуй найбільш вірогідний клінічний діагноз (1-2 речення з кодом МКХ-10).
Відповідай українською, коротко і по суті.`,

            medications: `Ти — AI-асистент лікаря в медичній системі StellHeal.
Пацієнт: ${payload.patientName || ''}, вік: ${payload.age || '?'}.
Діагноз: ${payload.diagnosis || ''}
Скарги: ${payload.complaints || ''}
Доступні препарати: ${payload.availableMeds || 'не вказано'}

Запропонуй 2-3 препарати з дозуванням та кратністю для цього діагнозу.
Формат кожного рядка: "Назва — доза — разів на день — днів".
Відповідай українською, коротко.`,

            recommendations: `Ти — AI-асистент лікаря в медичній системі StellHeal.
Діагноз: ${payload.diagnosis || ''}
Призначені препарати: ${payload.medications || 'не вказано'}
Скарги: ${payload.complaints || ''}

Склади короткі практичні рекомендації щодо лікування (режим, дієта, активність, повторний огляд).
2-4 пункти, українською, без зайвого.`,

            // ── Уточнюючі питання до вже отриманої AI-підказки ──────────────
            chat: `Ти — AI-асистент лікаря в медичній системі StellHeal.

Контекст пацієнта:
${payload.context || ''}

Попередня відповідь AI:
${payload.previousAnswer || ''}

Лікар задає уточнююче питання:
${payload.question || ''}

Відповідай українською, коротко і конкретно. Якщо питання медичне — надай практичну відповідь. Не повторюй попередню відповідь повністю.`,
        };

        return prompts[type] || null;
    }

    async streamRecommendation(type, payload, res) {
        const prompt = this.buildPrompt(type, payload);
        if (!prompt) throw new Error(`Невідомий тип: ${type}`);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const stream = await groq.chat.completions.create({
            model:      'llama-3.3-70b-versatile',
            max_tokens: 500,
            stream:     true,
            messages:   [{ role: 'user', content: prompt }],
        });

        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    }
}