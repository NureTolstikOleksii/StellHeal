import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class AiService {

    buildPrompt(type, payload) {
        const prompts = {
            diagnosis: `Ти — AI-асистент лікаря в медичній системі StellHeal.
            Пацієнт: вік ${payload.age || '?'} років${payload.gender ? `, стать: ${payload.gender}` : ''}.
            Скарги: ${payload.complaints || 'не вказано'}
            Анамнез: ${payload.anamnesis || 'не вказано'}
            Об'єктивний стан: ${payload.objectiveStatus || 'не вказано'}
            Історія хвороб: ${payload.medicalHistory || 'не вказано'}
            ${payload.images?.length ? 'До повідомлення додані фото результатів аналізів пацієнта — врахуй їх при формуванні діагнозу.' : ''}
            
            Запропонуй найбільш вірогідний клінічний діагноз (1-2 речення з кодом МКХ-10).
            Відповідай українською, коротко і по суті.`,

            medications: `Ти — AI-асистент лікаря в медичній системі StellHeal.
            Пацієнт: вік ${payload.age || '?'} років${payload.gender ? `, стать: ${payload.gender}` : ''}.
            Діагноз: ${payload.diagnosis || 'не вказано'}
            Скарги: ${payload.complaints || 'не вказано'}
            Історія хвороб: ${payload.medicalHistory || 'не вказано'}
            Вже призначені препарати: ${payload.currentMedications || 'відсутні'}
            
            Запропонуй 2-3 препарати з дозуванням та кратністю для цього діагнозу.
            Не дублюй вже призначені препарати.
            Формат кожного рядка: "Назва — доза — разів на день — днів".
            Відповідай українською, коротко.`,

            recommendations: `Ти — AI-асистент лікаря в медичній системі StellHeal.
            Діагноз: ${payload.diagnosis || 'не вказано'}
            Призначені препарати: ${payload.medications || 'не вказано'}
            Скарги: ${payload.complaints || 'не вказано'}
            Історія хвороб: ${payload.medicalHistory || 'не вказано'}
            
            Склади короткі практичні рекомендації щодо лікування (режим, дієта, активність, повторний огляд).
            2-4 пункти, українською, без зайвого.`,

            chat: `Ти — AI-асистент лікаря в медичній системі StellHeal.
            Твоя роль — виключно медична підтримка.
            Не відповідай на запитання не пов'язані з медициною та лікуванням.
            
            Контекст пацієнта:
            - Вік: ${payload.age || '?'} років${payload.gender ? `, стать: ${payload.gender}` : ''}
            - Поточний діагноз: ${payload.diagnosis || 'не вказано'}
            - Скарги: ${payload.complaints || 'не вказано'}
            - Анамнез: ${payload.anamnesis || 'не вказано'}
            - Призначені препарати: ${payload.currentMedications || 'не вказано'}
            - Історія хвороб: ${payload.medicalHistory || 'не вказано'}
            
            Попередня відповідь AI:
            ${payload.previousAnswer || ''}
            
            Питання лікаря: ${payload.question || ''}
            
            Правила:
            - Відповідай лише на медичні питання стосовно цього пацієнта
            - Якщо питання не медичне — відповідай: "Я можу допомогти лише з медичними питаннями"
            - Не повторюй попередню відповідь повністю
            - Відповідай українською, коротко і конкретно`,
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