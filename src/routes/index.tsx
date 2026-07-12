import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Archive,
  Brain,
  Copy,
  Gauge,
  LifeBuoy,
  Lightbulb,
  Link2,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from "lucide-react";

// --- Types ---
type Item = { id: string; text: string; weight: number };
type Analysis = {
  blindspot: string;
  weightCheck: string;
  nextStep: string;
  sandboxFeedback: string;
};
type HistoryEntry = {
  id: string;
  topic: string;
  pros: Item[];
  cons: Item[];
  ice: { impact: number; confidence: number; ease: number };
  iceScore: number;
  savedAt: string;
};
type AiTag = { text: string; weight: number; tone?: "amber" | "teal" };
type GeminiDecisionPayload = {
  suggestedAdvantages: Array<{ text: string; score: number }>;
  suggestedDisadvantages: Array<{ text: string; score: number }>;
  iceAssessment: { impact: number; confidence: number; ease: number; reasoning: string };
  sandboxFeedback: string;
};

// --- Constants & Helpers ---
const STORAGE_KEY = "decide-now-history";
const GEMINI_KEY_STORAGE_KEY = "decide-now-gemini-key";
const MAX_LEN = 50;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseGeminiPayload(rawText: string | undefined): GeminiDecisionPayload {
  if (!rawText) throw new Error("Gemini 沒有回傳內容。");
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("無法解析 JSON。");
  const parsed = JSON.parse(match[0]);
  const parseNum = (val: any, fallback: number) => {
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };
  return {
    suggestedAdvantages: Array.isArray(parsed.suggestedAdvantages)
      ? parsed.suggestedAdvantages.map((i: any) => ({
          text: i.text || "優勢",
          score: clamp(parseNum(i.score, 3), 1, 5),
        }))
      : [],
    suggestedDisadvantages: Array.isArray(parsed.suggestedDisadvantages)
      ? parsed.suggestedDisadvantages.map((i: any) => ({
          text: i.text || "風險",
          score: clamp(parseNum(i.score, 3), 1, 5),
        }))
      : [],
    iceAssessment: {
      impact: clamp(parseNum(parsed.iceAssessment?.impact, 5), 1, 10),
      confidence: clamp(parseNum(parsed.iceAssessment?.confidence, 5), 1, 10),
      ease: clamp(parseNum(parsed.iceAssessment?.ease, 5), 1, 10),
      reasoning: parsed.iceAssessment?.reasoning || "評估中。",
    },
    sandboxFeedback: parsed.sandboxFeedback || "請審慎決策。",
  };
}

export default function App() {
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [pros, setPros] = useState<Item[]>([]);
  const [cons, setCons] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [ice, setIce] = useState({ impact: 5, confidence: 5, ease: 5 });
  const [apiKeyInput, setApiKeyInput] = useState(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? "")
      : "",
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiTagPool, setAiTagPool] = useState<{ pros: AiTag[]; cons: AiTag[] }>({
    pros: [],
    cons: [],
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  const runAnalysis = async (targetTopic: string) => {
    if (!apiKeyInput.trim()) {
      toast.error("請先輸入 API Key");
      return;
    }
    setLoading(true);
    try {
      const prompt = `針對決策命題：「${targetTopic}」，你是專業 PM。請生成 3-5 個具體的優勢與風險標籤 (各給予 1-5 分權重)，評估 ICE 分數 (1-10) 並給出 80 字內盲點警示。請嚴格輸出 JSON。`;
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
      setAiTagPool({
        pros: payload.suggestedAdvantages.map((i) => ({
          text: i.text,
          weight: i.score,
          tone: "teal",
        })),
        cons: payload.suggestedDisadvantages.map((i) => ({
          text: i.text,
          weight: i.score,
          tone: "amber",
        })),
      });
      setIce(payload.iceAssessment);
      setAnalysis({
        blindspot: "AI 盲點：" + payload.sandboxFeedback,
        weightCheck: "權重校正：" + payload.iceAssessment.reasoning,
        nextStep: "優先處理：" + (payload.suggestedAdvantages[0]?.text || "核心優勢"),
        sandboxFeedback: payload.sandboxFeedback,
      });
    } catch (e) {
      toast.error("分析失敗，請檢查 API Key。");
    } finally {
      setLoading(false);
    }
  };

  const confirmTopic = () => {
    if (!draft.trim()) return;
    setTopic(draft);
    runAnalysis(draft);
  };

  // --- UI Components ---
  return (
    <div className="min-h-screen bg-background p-10">
      <div className="max-w-4xl mx-auto">
        {!topic ? (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold">DecideNow 決策矩陣</h1>
            <input
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                localStorage.setItem(GEMINI_KEY_STORAGE_KEY, e.target.value);
              }}
              placeholder="請輸入 Gemini API Key"
              className="w-full max-w-md p-3 border rounded-xl"
            />
            <div className="flex gap-2 justify-center">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="輸入你的決策命題..."
                className="w-full max-w-md p-3 border rounded-xl"
              />
              <button onClick={confirmTopic} className="bg-primary text-white px-6 rounded-xl">
                開始分析
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-2xl font-bold">{topic}</h2>
              <button onClick={() => setTopic(null)} className="text-xs text-red-500">
                重設
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-2xl">
                <h3 className="font-bold mb-3">優點</h3>
                {aiTagPool.pros.map((t) => (
                  <button
                    key={t.text}
                    onClick={() =>
                      setPros([...pros, { id: uid(), text: t.text, weight: t.weight }])
                    }
                    className="block w-full text-left p-2 hover:bg-teal-50 text-teal-700"
                  >
                    {t.text} (+{t.weight})
                  </button>
                ))}
                {pros.map((p) => (
                  <div key={p.id} className="text-sm border-b py-1">
                    {p.text}
                  </div>
                ))}
              </div>
              <div className="p-4 border rounded-2xl">
                <h3 className="font-bold mb-3">風險</h3>
                {aiTagPool.cons.map((t) => (
                  <button
                    key={t.text}
                    onClick={() =>
                      setCons([...cons, { id: uid(), text: t.text, weight: t.weight }])
                    }
                    className="block w-full text-left p-2 hover:bg-amber-50 text-amber-700"
                  >
                    {t.text} (-{t.weight})
                  </button>
                ))}
                {cons.map((c) => (
                  <div key={c.id} className="text-sm border-b py-1">
                    {c.text}
                  </div>
                ))}
              </div>
            </div>

            {analysis && (
              <div className="p-6 bg-slate-50 rounded-2xl border">
                <h3 className="font-bold mb-2">AI 洞察</h3>
                <p className="text-sm">{analysis.blindspot}</p>
                <div className="mt-4 flex gap-4 text-xs font-bold text-slate-500">
                  <span>Impact: {ice.impact}</span>
                  <span>Confidence: {ice.confidence}</span>
                  <span>Ease: {ice.ease}</span>
                </div>
              </div>
            )}

            {loading && <div className="text-center animate-pulse">AI 正在思考中</div>}
          </div>
        )}
      </div>
    </div>
  );
}
