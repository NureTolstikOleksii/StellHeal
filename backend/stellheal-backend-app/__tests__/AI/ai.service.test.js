import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStream } = vi.hoisted(() => ({
    mockStream: vi.fn(),
}));

vi.mock('groq-sdk', () => ({
    default: class MockGroq {
        constructor() {
            this.chat = {
                completions: { create: mockStream }
            };
        }
    }
}));

import { AiService } from '../../src/modules/AI/ai.service.js';

const makeRes = () => {
    const written = [];
    return {
        setHeader:    vi.fn(),
        flushHeaders: vi.fn(),
        write:        vi.fn((chunk) => written.push(chunk)),
        end:          vi.fn(),
        _written:     written,
    };
};

async function* makeStream(chunks) {
    for (const text of chunks) {
        yield { choices: [{ delta: { content: text } }] };
    }
}

let service;
beforeEach(() => { vi.clearAllMocks(); service = new AiService(); });


describe('buildPrompt', () => {

    it('returns null for unknown type', () => {
        expect(service.buildPrompt('unknown', {})).toBeNull();
    });

    it('builds diagnosis prompt with patient data', () => {
        const prompt = service.buildPrompt('diagnosis', {
            age: 45, complaints: 'Headache', anamnesis: 'None', objectiveStatus: 'Normal'
        });
        expect(prompt).toContain('45');
        expect(prompt).toContain('Headache');
        expect(prompt).toContain('МКХ-10');
    });

    it('includes image note in diagnosis prompt when images provided', () => {
        const withImages    = service.buildPrompt('diagnosis', { images: ['img1.jpg'] });
        const withoutImages = service.buildPrompt('diagnosis', { images: [] });
        expect(withImages).toContain('фото результатів аналізів');
        expect(withoutImages).not.toContain('фото результатів аналізів');
    });

    it('uses "?" for missing age in diagnosis prompt', () => {
        const prompt = service.buildPrompt('diagnosis', {});
        expect(prompt).toContain('? років');
    });

    it('builds medications prompt with diagnosis and available meds', () => {
        const prompt = service.buildPrompt('medications', {
            patientName: 'John Doe', age: 30,
            diagnosis: 'Flu', availableMeds: 'Aspirin, Ibuprofen'
        });
        expect(prompt).toContain('John Doe');
        expect(prompt).toContain('Flu');
        expect(prompt).toContain('Aspirin, Ibuprofen');
        expect(prompt).toContain('Назва — доза — разів на день — днів');
    });

    it('uses "не вказано" when availableMeds missing in medications prompt', () => {
        const prompt = service.buildPrompt('medications', { diagnosis: 'Flu' });
        expect(prompt).toContain('не вказано');
    });

    it('builds recommendations prompt with diagnosis and medications', () => {
        const prompt = service.buildPrompt('recommendations', {
            diagnosis: 'Flu', medications: 'Aspirin', complaints: 'Fever'
        });
        expect(prompt).toContain('Flu');
        expect(prompt).toContain('Aspirin');
        expect(prompt).toContain('Fever');
        expect(prompt).toContain('рекомендації');
    });

    it('builds chat prompt with context and question', () => {
        const prompt = service.buildPrompt('chat', {
            context:        'Patient 45 years old',
            previousAnswer: 'AI suggested flu',
            question:       'What about antibiotics?'
        });
        expect(prompt).toContain('Patient 45 years old');
        expect(prompt).toContain('AI suggested flu');
        expect(prompt).toContain('What about antibiotics?');
    });

    it('handles missing chat fields gracefully', () => {
        const prompt = service.buildPrompt('chat', {});
        expect(prompt).toBeDefined();
        expect(prompt).not.toBeNull();
    });
});

describe('streamRecommendation', () => {

    it('throws error for unknown type', async () => {
        const res = makeRes();
        await expect(service.streamRecommendation('unknown', {}, res))
            .rejects.toThrow('Невідомий тип: unknown');
    });

    it('sets SSE headers before streaming', async () => {
        const res = makeRes();
        mockStream.mockResolvedValue(makeStream(['Hello']));

        await service.streamRecommendation('diagnosis', { age: 30 }, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
        expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
        expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
        expect(res.flushHeaders).toHaveBeenCalledOnce();
    });

    it('writes each chunk as SSE data event', async () => {
        const res = makeRes();
        mockStream.mockResolvedValue(makeStream(['Hello', ' world']));

        await service.streamRecommendation('diagnosis', { age: 30 }, res);

        expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ text: 'Hello' })}\n\n`);
        expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ text: ' world' })}\n\n`);
    });

    it('sends [DONE] event and ends response after stream', async () => {
        const res = makeRes();
        mockStream.mockResolvedValue(makeStream(['text']));

        await service.streamRecommendation('diagnosis', {}, res);

        expect(res.write).toHaveBeenLastCalledWith('data: [DONE]\n\n');
        expect(res.end).toHaveBeenCalledOnce();
    });

    it('skips empty chunks without writing', async () => {
        const res = makeRes();
        async function* streamWithEmpty() {
            yield { choices: [{ delta: { content: '' } }] };
            yield { choices: [{ delta: { content: 'real text' } }] };
        }
        mockStream.mockResolvedValue(streamWithEmpty());

        await service.streamRecommendation('diagnosis', {}, res);

        const dataWrites = res._written.filter(w => w !== 'data: [DONE]\n\n');
        expect(dataWrites).toHaveLength(1);
        expect(dataWrites[0]).toContain('real text');
    });

    it('calls groq with correct model and stream=true', async () => {
        const res = makeRes();
        mockStream.mockResolvedValue(makeStream([]));

        await service.streamRecommendation('recommendations', {
            diagnosis: 'Flu', medications: 'Aspirin'
        }, res);

        expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({
            model:      'llama-3.3-70b-versatile',
            max_tokens: 500,
            stream:     true,
        }));
    });

    it('passes built prompt as user message to groq', async () => {
        const res = makeRes();
        mockStream.mockResolvedValue(makeStream([]));

        await service.streamRecommendation('chat', {
            context: 'patient info', question: 'Any risks?'
        }, res);

        const call = mockStream.mock.calls[0][0];
        expect(call.messages[0].role).toBe('user');
        expect(call.messages[0].content).toContain('patient info');
        expect(call.messages[0].content).toContain('Any risks?');
    });
});