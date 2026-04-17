import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDvYlmWrjyHNx-FnhEjiTx_f_Y3lugoT_Y' });

async function checkModels() {
    try {
        const response = await ai.models.list(); // Or similar depending on SDK
        // wait @google/genai syntax: 
        // Not all keys can list. Let's just try to call gemini-3.0-flash
        try {
            await ai.models.generateContent({
                model: 'gemini-3.0-flash',
                contents: 'Hello'
            });
            console.log("3.0-flash works!");
        } catch(e) {
            console.log("3.0-flash FAILED:", e.message);
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
checkModels();
