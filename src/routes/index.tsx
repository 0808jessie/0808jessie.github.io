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

// --- Types (保持原狀) ---
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

// --- Helper Functions (保持原狀) ---
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
  if (!rawText) throw new Error("Gemini 沒有回傳任何內容。");
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
          text: i.text || "優點",
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

  // 封存並還原邏輯 (保持原狀)... [此處省略部分重複邏輯，請保留您原始的 saveDecision 與 restoreHistoryEntry]

  const runAnalysis = async (targetTopic: string) => {
    if (!apiKeyInput.trim()) {
      toast.error("請在首頁輸入 API Key");
      return;
    }
    setLoading(true);
    try {
      const prompt = `針對決策命題：「${targetTopic}」，請擔任資深 PM 與敏捷教練。請生成 3-5 個具體的優勢與風險標籤 (各給予 1-5 分權重)，評估 ICE 分數 (1-10) 並說明理由，最後給出 80 字內盲點警示。請嚴格輸出 JSON 格式。`;
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
        nextStep: "建議優先：「" + (payload.suggestedAdvantages[0]?.text || "關鍵點") + "」",
        sandboxFeedback: payload.sandboxFeedback,
      });
      toast.success("AI 自動分析完成！");
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

  // --- 返回 UI (整合了首頁 API 輸入框) ---
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* 側邊欄與主要內容結構保持不變，將首頁邏輯放在 !topic 判斷中 */}
      {!topic ? (
        <section className="flex-1 flex flex-col items-center justify-center p-10">
          <h1 className="text-4xl font-bold mb-8">DecideNow 決策矩陣</h1>
          <input
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              localStorage.setItem(GEMINI_KEY_STORAGE_KEY, e.target.value);
            }}
            placeholder="請輸入 Gemini API Key"
            className="w-full max-w-sm p-4 border rounded-xl mb-4"
          />
          <div className="flex gap-2 w-full max-w-sm">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="輸入決策命題..."
              className="flex-1 p-4 border rounded-xl"
            />
            <button onClick={confirmTopic} className="bg-primary text-white px-6 rounded-xl">
              {loading ? <Loader2 className="animate-spin" /> : "開始"}
            </button>
          </div>
        </section>
      ) : (
        /* 此處放置您原先完整的矩陣內容 (包含 Column, ItemRow, DiagnosisSummary 等組件) */
        <div className="flex-1 p-10">
          <h2 className="text-2xl font-bold mb-6">
            {topic}{" "}
            <button
              onClick={() => setTopic(null)}
              className="text-xs text-muted-foreground underline"
            >
              重設
            </button>
          </h2>
          {/* ... 接續您原來的矩陣網格 UI ... */}
        </div>
      )}
    </div>
  );
}
