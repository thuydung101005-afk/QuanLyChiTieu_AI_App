import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDvYlmWrjyHNx-FnhEjiTx_f_Y3lugoT_Y' });

async function test() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Reply exactly with "KEY_VALID"',
        });
        console.log("SUCCESS:", response.text);
    } catch(e) {
        console.error("ERROR:", e.message);
    }
}
test();
