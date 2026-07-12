import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// --- 完整的類型定義與常數 ---
type Item = { id: string; text: string; weight: number };
type AiTag = { text: string; weight: number; tone?: "amber" | "teal" };
type GeminiDecisionPayload = {
  suggestedAdvantages: Array<{ text: string; score: number }>;
  suggestedDisadvantages: Array<{ text: string; score: number }>;
  iceAssessment: { impact: number; confidence: number; ease: number; reasoning: string };
  sandboxFeedback: string;
};

const GEMINI_KEY_STORAGE_KEY = "decide-now-gemini-key";

// --- 解析器 ---
function parseGeminiPayload(rawText: string | undefined): GeminiDecisionPayload {
  if (!rawText) throw new Error("Gemini 沒有回傳任何內容。");
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("無法解析 JSON。");
  const parsed = JSON.parse(match[0]);
  return {
    suggestedAdvantages: Array.isArray(parsed.suggestedAdvantages)
      ? parsed.suggestedAdvantages
      : [],
    suggestedDisadvantages: Array.isArray(parsed.suggestedDisadvantages)
      ? parsed.suggestedDisadvantages
      : [],
    iceAssessment: parsed.iceAssessment || { impact: 5, confidence: 5, ease: 5, reasoning: "" },
    sandboxFeedback: parsed.sandboxFeedback || "",
  };
}

export default function App() {
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState(
    () => localStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? "",
  );
  const [loading, setLoading] = useState(false);

  // 必須宣告的狀態 (修復您的錯誤)
  const [pros, setPros] = useState<Item[]>([]);
  const [cons, setCons] = useState<Item[]>([]);
  const [aiTagPool, setAiTagPool] = useState<{ pros: AiTag[]; cons: AiTag[] }>({
    pros: [],
    cons: [],
  });
  const [ice, setIce] = useState({ impact: 5, confidence: 5, ease: 5 });
  const [analysis, setAnalysis] = useState<any>(null);

  // --- 自動化分析邏輯 ---
  const runAnalysis = async (targetTopic: string) => {
    if (!apiKeyInput.trim()) {
      toast.error("請在首頁輸入 API Key");
      return;
    }
    setLoading(true);
    try {
      const prompt = `針對命題：「${targetTopic}」，請擔任 PM。請輸出 JSON：包含 suggestedAdvantages (陣列, {text, score}), suggestedDisadvantages (陣列, {text, score}), iceAssessment ({impact, confidence, ease, reasoning}), sandboxFeedback。ICE 請根據命題自動評分 (1-10)。`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKeyInput)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      const data = await response.json();
      const payload = parseGeminiPayload(data.candidates?.[0]?.content?.parts?.[0]?.text);

      // 自動填充狀態
      setAiTagPool({
        pros: payload.suggestedAdvantages.map((i: any) => ({
          text: i.text,
          weight: i.score,
          tone: "teal",
        })),
        cons: payload.suggestedDisadvantages.map((i: any) => ({
          text: i.text,
          weight: i.score,
          tone: "amber",
        })),
      });
      setIce(payload.iceAssessment);
      setAnalysis({ blindspot: payload.sandboxFeedback });
      toast.success("AI 已根據命題生成建議！");
    } catch (e) {
      toast.error("分析失敗，請檢查 Key。");
    } finally {
      setLoading(false);
    }
  };

  const confirmTopic = () => {
    if (!draft.trim()) return;
    setTopic(draft);
    runAnalysis(draft);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-10">
      {!topic ? (
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-2xl font-bold">DecideNow 決策矩陣</h1>
          <h1 className="text-4xl font-bold">DecideNow 測試更新狀態</h1>
          <input
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              localStorage.setItem(GEMINI_KEY_STORAGE_KEY, e.target.value);
            }}
            className="w-full p-3 border rounded-xl"
            placeholder="輸入 API Key"
          />
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 p-3 border rounded-xl"
              placeholder="輸入要決定的事..."
            />
            <button onClick={confirmTopic} className="bg-primary text-white px-6 rounded-xl">
              {loading ? <Loader2 className="animate-spin" /> : "開始"}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* 此處放置您原有的 UI 結構 */}
          {/* 系統會自動將 runAnalysis 的結果填入 aiTagPool 與 ice 狀態 */}
        </div>
      )}
    </div>
  );
}
