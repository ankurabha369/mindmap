import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function generateMindMapFromContent(content: string, mimeType: string = 'text/plain') {
  const model = "gemini-2.5-flash";

  const prompt = `
    Analyze the following content and generate a mind map structure.
    Identify the main topic, subtopics, and their relationships.
    Return a JSON object with 'nodes' and 'edges'.
    
    - Nodes should have a unique 'id', a 'label' (short title), and a 'description' (detailed content).
    - Edges should have 'source' and 'target' matching the node ids.
    - Keep labels concise (under 10 words).
    - Descriptions can be longer (up to 50 words) to explain the concept.
    - Ensure there is a single root node if possible.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            label: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["id", "label", "description"],
        },
      },
      edges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING },
            target: { type: Type.STRING },
          },
          required: ["source", "target"],
        },
      },
    },
    required: ["nodes", "edges"],
  };

  try {
    const result = await getAI().models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: content, // base64 encoded string
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
