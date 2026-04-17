import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDvYlmWrjyHNx-FnhEjiTx_f_Y3lugoT_Y' });

async function test() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.0-flash',
            contents: 'say hello',
        });
        console.log("SUCCESS:", response.text);
    } catch(e) {
        console.error("ERROR 3.0 FLASH:", e.message);
    }
}
test();
