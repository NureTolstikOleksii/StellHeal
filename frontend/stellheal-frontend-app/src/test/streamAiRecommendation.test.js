import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.mock('../utils/api.js', () => ({
    default: {
        defaults: { baseURL: 'http://localhost:4200/api' }
    }
}));

import { streamAiRecommendation } from '../services/patientService.js';

function makeStream(chunks) {
    const encoder = new TextEncoder();
    let index = 0;
    return {
        getReader: () => ({
            read: async () => {
                if (index < chunks.length) {
                    return { done: false, value: encoder.encode(chunks[index++]) };
                }
                return { done: true, value: undefined };
            }
        })
    };
}

function mockFetch(status, bodyStream) {
    global.fetch = vi.fn().mockResolvedValue({
        ok:   status === 200,
        status,
        body: bodyStream,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('accessToken', 'test-token');
});


describe('streamAiRecommendation', () => {

    it('calls fetch with correct URL and method', async () => {
        mockFetch(200, makeStream(['data: [DONE]\n']));

        await streamAiRecommendation('diagnosis', { age: 30 }, vi.fn());

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:4200/api/ai/recommend',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('sends Authorization header with access token', async () => {
        mockFetch(200, makeStream(['data: [DONE]\n']));

        await streamAiRecommendation('diagnosis', {}, vi.fn());

        const headers = fetch.mock.calls[0][1].headers;
        expect(headers['Authorization']).toBe('Bearer test-token');
    });

    it('sends Content-Type: application/json header', async () => {
        mockFetch(200, makeStream(['data: [DONE]\n']));

        await streamAiRecommendation('diagnosis', {}, vi.fn());

        const headers = fetch.mock.calls[0][1].headers;
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('sends type and payload in request body', async () => {
        mockFetch(200, makeStream(['data: [DONE]\n']));

        const payload = { age: 45, complaints: 'Headache' };
        await streamAiRecommendation('diagnosis', payload, vi.fn());

        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.type).toBe('diagnosis');
        expect(body.payload).toEqual(payload);
    });

    it('throws error when response is not ok', async () => {
        mockFetch(500, makeStream([]));

        await expect(
            streamAiRecommendation('diagnosis', {}, vi.fn())
        ).rejects.toThrow('AI error: 500');
    });

    it('throws error on 401 response', async () => {
        mockFetch(401, makeStream([]));

        await expect(
            streamAiRecommendation('diagnosis', {}, vi.fn())
        ).rejects.toThrow('AI error: 401');
    });

    it('calls onChunk for each text chunk received', async () => {
        mockFetch(200, makeStream([
            'data: {"text":"Hello"}\n\n',
            'data: {"text":" world"}\n\n',
            'data: [DONE]\n',
        ]));

        const onChunk = vi.fn();
        await streamAiRecommendation('diagnosis', {}, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(2);
        expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
        expect(onChunk).toHaveBeenNthCalledWith(2, ' world');
    });

    it('stops processing when [DONE] received', async () => {
        mockFetch(200, makeStream([
            'data: {"text":"First"}\n\n',
            'data: [DONE]\n',
            'data: {"text":"Should not appear"}\n\n',
        ]));

        const onChunk = vi.fn();
        await streamAiRecommendation('diagnosis', {}, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('First');
    });

    it('ignores lines without "data: " prefix', async () => {
        mockFetch(200, makeStream([
            'event: message\n',
            'data: {"text":"Valid"}\n\n',
            'data: [DONE]\n',
        ]));

        const onChunk = vi.fn();
        await streamAiRecommendation('diagnosis', {}, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('Valid');
    });

    it('ignores chunks without "text" field', async () => {
        mockFetch(200, makeStream([
            'data: {"other":"value"}\n\n',
            'data: {"text":"Valid"}\n\n',
            'data: [DONE]\n',
        ]));

        const onChunk = vi.fn();
        await streamAiRecommendation('diagnosis', {}, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('Valid');
    });

    it('handles invalid JSON in data line gracefully', async () => {
        mockFetch(200, makeStream([
            'data: {invalid json}\n\n',
            'data: {"text":"After error"}\n\n',
            'data: [DONE]\n',
        ]));

        const onChunk = vi.fn();
        // Should not throw
        await expect(
            streamAiRecommendation('diagnosis', {}, onChunk)
        ).resolves.not.toThrow();

        expect(onChunk).toHaveBeenCalledWith('After error');
    });

    it('handles multiple chunks in single buffer read', async () => {
        mockFetch(200, makeStream([
            'data: {"text":"A"}\n\ndata: {"text":"B"}\n\ndata: [DONE]\n',
        ]));

        const onChunk = vi.fn();
        await streamAiRecommendation('diagnosis', {}, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(2);
        expect(onChunk).toHaveBeenNthCalledWith(1, 'A');
        expect(onChunk).toHaveBeenNthCalledWith(2, 'B');
    });

    it('passes abort signal to fetch', async () => {
        mockFetch(200, makeStream(['data: [DONE]\n']));

        const controller = new AbortController();
        await streamAiRecommendation('diagnosis', {}, vi.fn(), controller.signal);

        const fetchOptions = fetch.mock.calls[0][1];
        expect(fetchOptions.signal).toBe(controller.signal);
    });

    it('works with all supported types', async () => {
        const types = ['diagnosis', 'medications', 'recommendations', 'chat'];

        for (const type of types) {
            mockFetch(200, makeStream(['data: [DONE]\n']));
            const onChunk = vi.fn();
            await streamAiRecommendation(type, {}, onChunk);

            const body = JSON.parse(fetch.mock.calls.at(-1)[1].body);
            expect(body.type).toBe(type);
        }
    });
});