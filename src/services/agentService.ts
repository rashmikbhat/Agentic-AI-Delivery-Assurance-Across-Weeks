
import { GoogleGenAI } from "@google/genai";
import { RiskAlert, AgentAction, WeekBucket } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return null or handle silently if key is missing to avoid crashing the whole module
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export const analyzeDeliveryRisk = async (factoryState: any) => {
  const prompt = `
    You are an Agentic AI for a Manufacturing Delivery Assurance system.
    Current Factory State: ${JSON.stringify(factoryState)}
    
    Tasks:
    1. Assess OTIF risk for W1, W2, W3, and W4.
    2. Identify specific bottlenecks or issues (Equipment, WIP, Mix).
    3. Generate follow-up messages for department owners.
    4. Propose trade-off actions (e.g., re-prioritize W1 IoT for W2 Auto).
    
    Return a JSON response with:
    {
      "risks": [
        { "id": "id", "week": "W1", "type": "Capacity", "severity": "high", "productFamily": "Family", "reason": "...", "evidence": "..." }
      ],
      "actions": [
        { "id": "id", "type": "follow-up", "target": "Maintenance Manager", "message": "...", "status": "pending" }
      ],
      "summary": "Brief overall status"
    }
  `;

  try {
    const ai = getAI();
    if (!ai) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "";
    // Simplified parsing for demo
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Invalid AI response");
  } catch (error) {
    console.error("AI Analysis failed:", error);
    // Fallback logic for demo if API key is missing/failed
    return {
      risks: [
        { id: "r1", week: "W1", type: "Equipment", severity: "high", productFamily: "Automotive Power", reason: "Tool group L-400 at 70% availability", evidence: "OEE data showing 4h downtime today" }
      ],
      actions: [
        { id: "a1", type: "follow-up", target: "John (Maintenance)", message: "Requesting ETA for Tool #4 recovery in L-400 group.", status: "completed" },
        { id: "a2", type: "recommendation", target: "Planner IE", message: "Expedite Lot #X99 to bypass queue at Step 40.", status: "pending" }
      ],
      summary: "W1 risk elevated due to bottleneck downtime. W3-W4 appear stable but require mix balancing."
    };
  }
};
