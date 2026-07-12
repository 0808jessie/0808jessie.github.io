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

type Item = {
  id: string;

  text: string;

  weight: number;
};

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

const STORAGE_KEY = "decide-now-history";

const GEMINI_KEY_STORAGE_KEY = "decide-now-gemini-key";

const MAX_LEN = 50;

type GeminiDecisionPayload = {
  suggestedAdvantages: Array<{ text: string; score: number }>;

  suggestedDisadvantages: Array<{ text: string; score: number }>;

  iceAssessment: {
    impact: number;

    confidence: number;

    ease: number;

    reasoning: string;
  };

  sandboxFeedback: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type AiTag = {
  text: string;

  weight: number;

  tone?: "amber" | "teal";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseGeminiPayload(rawText: string | undefined): GeminiDecisionPayload {
  if (!rawText) {
    throw new Error("Gemini 沒有回傳任何內容。");
  }

  // 使用正則表達式精準提取 JSON 區塊，避免 Markdown 外框干擾

  const match = rawText.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("無法從 AI 回應中解析出正確的 JSON 格式。");
  }

  const cleaned = match[0];

  const parsed = JSON.parse(cleaned) as any;

  // 強化轉型邏輯，預防 AI 回傳字串型態的數字

  const parseNum = (val: any, fallback: number) => {
    const n = Number(val);

    return isNaN(n) ? fallback : n;
  };

  const suggestedAdvantages = Array.isArray(parsed.suggestedAdvantages)
    ? parsed.suggestedAdvantages.map((item: any) => ({
        text: typeof item?.text === "string" ? item.text : "未知的優勢",

        score: clamp(parseNum(item?.score, 3), 1, 5),
      }))
    : [];

  const suggestedDisadvantages = Array.isArray(parsed.suggestedDisadvantages)
    ? parsed.suggestedDisadvantages.map((item: any) => ({
        text: typeof item?.text === "string" ? item.text : "未知的風險",

        score: clamp(parseNum(item?.score, 3), 1, 5),
      }))
    : [];

  const ice = parsed.iceAssessment;

  const iceAssessment = {
    impact: clamp(parseNum(ice?.impact, 5), 1, 10),

    confidence: clamp(parseNum(ice?.confidence, 5), 1, 10),

    ease: clamp(parseNum(ice?.ease, 5), 1, 10),

    reasoning: typeof ice?.reasoning === "string" ? ice.reasoning : "無核心理由。",
  };

  const sandboxFeedback = typeof parsed.sandboxFeedback === "string" ? parsed.sandboxFeedback : "";

  return {
    suggestedAdvantages,

    suggestedDisadvantages,

    iceAssessment,

    sandboxFeedback,
  };
}

export default function App() {
  const [draft, setDraft] = useState("");

  const [topic, setTopic] = useState<string | null>(null);

  const [pros, setPros] = useState<Item[]>([]);

  const [cons, setCons] = useState<Item[]>([]);

  const [loading, setLoading] = useState(false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const [sandboxFeedback, setSandboxFeedback] = useState("");

  const [aiTagPool, setAiTagPool] = useState<{ pros: AiTag[]; cons: AiTag[] }>({
    pros: [],

    cons: [],
  });

  const [ice, setIce] = useState<{ impact: number; confidence: number; ease: number }>({
    impact: 5,

    confidence: 5,

    ease: 5,
  });

  const [apiKeyInput, setApiKeyInput] = useState(() => {
    if (typeof window === "undefined") return "";

    return window.localStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? "";
  });

  const envApiKey = "";

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw) as HistoryEntry[];

      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(GEMINI_KEY_STORAGE_KEY, apiKeyInput);
  }, [apiKeyInput]);

  const currentIceScore = ice.impact * ice.confidence * ice.ease;

  const activeQuestion = topic ?? draft;

  const prosScore = useMemo(
    () => pros.reduce((s, i) => s + (i.text.trim() ? Math.abs(i.weight) : 0), 0),

    [pros],
  );

  const consScore = useMemo(
    () => cons.reduce((s, i) => s + (i.text.trim() ? Math.abs(i.weight) : 0), 0),

    [cons],
  );

  const total = prosScore + consScore;

  const prosPct = total === 0 ? 50 : (prosScore / total) * 100;

  const diff = prosScore - consScore;

  const denom = Math.max(total, 1);

  const lean = diff / denom;

  let barColor = "var(--primary)";

  if (lean > 0.2) barColor = "var(--success)";
  else if (lean < -0.2) barColor = "var(--destructive)";

  const verdict =
    total === 0
      ? "等待輸入"
      : lean > 0.2
        ? "傾向：值得推進"
        : lean < -0.2
          ? "傾向：建議暫緩"
          : "傾向：拉鋸中";

  const confirmTopic = () => {
    const v = draft.trim();

    if (!v) return;

    setTopic(v);

    setPros([]);

    setCons([]);

    setAiTagPool({ pros: [], cons: [] });

    setAnalysis(null);

    setAnalysisError(null);

    setSandboxFeedback("");

    setFeedback(null);

    const key = apiKeyInput.trim() || envApiKey;

    if (key) {
      void runAnalysis(v, [], []);
    }
  };

  const resetTopic = () => {
    setTopic(null);

    setPros([]);

    setCons([]);

    setAiTagPool({ pros: [], cons: [] });

    setAnalysis(null);

    setAnalysisError(null);

    setSandboxFeedback("");

    setFeedback(null);

    setDraft("");
  };

  const addItem = (side: "pros" | "cons") => {
    const item: Item = { id: uid(), text: "", weight: 3 };

    if (side === "pros") setPros((p) => [...p, item]);
    else setCons((c) => [...c, item]);
  };

  const updateItem = (side: "pros" | "cons", id: string, patch: Partial<Item>) => {
    const upd = (list: Item[]) => list.map((i) => (i.id === id ? { ...i, ...patch } : i));

    if (side === "pros") setPros(upd);
    else setCons(upd);
  };

  const removeItem = (side: "pros" | "cons", id: string) => {
    if (side === "pros") setPros((l) => l.filter((i) => i.id !== id));
    else setCons((l) => l.filter((i) => i.id !== id));
  };

  const addPresetTag = (side: "pros" | "cons", tag: AiTag) => {
    const item: Item = {
      id: uid(),

      text: tag.text,

      weight: side === "pros" ? tag.weight : -tag.weight,
    };

    if (side === "pros") setPros((p) => [...p, item]);
    else setCons((c) => [...c, item]);
  };

  const saveDecision = () => {
    if (!topic) {
      toast.error("請先設定決策命題後再封存。");

      return;
    }

    const nextEntry: HistoryEntry = {
      id: uid(),

      topic,

      pros: pros.map((item) => ({ ...item })),

      cons: cons.map((item) => ({ ...item })),

      ice: { ...ice },

      iceScore: currentIceScore,

      savedAt: new Date().toLocaleString("zh-TW", {
        year: "numeric",

        month: "2-digit",

        day: "2-digit",

        hour: "2-digit",

        minute: "2-digit",
      }),
    };

    setHistory((prev) => {
      const nextHistory = [nextEntry, ...prev].slice(0, 8);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
      }

      return nextHistory;
    });

    toast.success("已將此決策封存至歷史日誌。", { description: nextEntry.savedAt });
  };

  const copyReport = async () => {
    if (!topic) {
      toast.error("請先設定決策命題後再複製報告。", { description: "先輸入一個命題再試一次。" });

      return;
    }

    const prosCount = pros.filter((item) => item.text.trim()).length;

    const consCount = cons.filter((item) => item.text.trim()).length;

    const reportText = [
      "決策命題：" + topic,

      "ICE 綜合分數：" + currentIceScore,

      "優點/機會：" + prosCount + " 項",

      "缺點/風險：" + consCount + " 項",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(reportText);

      toast.success("報告已複製到剪貼簿。", { description: "可直接貼到你想分享的地方。" });
    } catch {
      toast.error("複製失敗，請手動選取內容複製。", { description: "你也可以直接使用右鍵貼上。" });
    }
  };

  const restoreHistoryEntry = (entry: HistoryEntry) => {
    setTopic(entry.topic);

    setDraft(entry.topic);

    setPros(entry.pros.map((item) => ({ ...item })));

    setCons(entry.cons.map((item) => ({ ...item })));

    setIce({ ...entry.ice });

    setAnalysis(null);

    setFeedback(null);

    setLoading(false);

    setSidebarOpen(true);

    toast.success("已還原歷史決策內容。", { description: entry.savedAt });
  };

  const canAnalyze = !!topic;

  const runAnalysis = async (
    topicOverride?: string,
    prosOverride?: Item[],
    consOverride?: Item[],
  ) => {
    const activeTopic = (topicOverride ?? topic)?.trim();

    const prosForPrompt = prosOverride ?? pros;

    const consForPrompt = consOverride ?? cons;

    if (!activeTopic) {
      toast.error("缺少決策命題", { description: "請先輸入決策命題，再進行 AI 分析。" });

      return;
    }

    const key = apiKeyInput.trim() || envApiKey;

    if (!key) {
      toast.error("缺少 API Key", { description: "請回首頁輸入您的 Gemini API Key！" });

      return;
    }

    setLoading(true);

    setAnalysis(null);

    setAnalysisError(null);

    setSandboxFeedback("");

    setFeedback(null);

    try {
      // 重新設計更嚴謹、且以變數佔位符取代實際字串的 Prompt，避免 AI 偷懶照抄格式

      const promptLines = [
        "你是資深產品經理與敏捷教練。請根據下方的【決策命題】以及使用者【目前已整理的優缺點】，進行深度思考，並嚴格輸出可被 JSON.parse() 解析的純 JSON 物件。",

        "請務必提供具體、切合該命題情境的真實反饋，絕對不要照抄格式範例中的預設文字！",

        "",

        "=== JSON 輸出格式規範 ===",

        "請完全遵守以下結構，但必須將裡面的文字與數值替換為「針對此命題實際評估後的真實內容與分數」：",

        "{",

        '  "suggestedAdvantages": [{"text": "(請根據命題生成具體的優點1)", "score": 4}, {"text": "(請根據命題生成具體的優點2)", "score": 3}, {"text": "(具體優點3)", "score": 3}],',

        '  "suggestedDisadvantages": [{"text": "(請根據命題生成具體的風險1)", "score": 4}, {"text": "(請根據命題生成具體的風險2)", "score": 3}, {"text": "(具體風險3)", "score": 3}],',

        '  "iceAssessment": {',

        '    "impact": "(請根據命題評估影響力，填寫1-10的整數數字)",',

        '    "confidence": "(請根據命題評估信心度，填寫1-10的整數數字)",',

        '    "ease": "(請根據命題評估容易度，填寫1-10的整數數字)",',

        '    "reasoning": "(解釋你給出這組 ICE 分數的核心理由，20字內)"',

        "  },",

        '  "sandboxFeedback": "(給出80字內針對此決策的 PM 盲點警示與具體行動建議)"',

        "}",

        "",

        "=== 嚴格要求 ===",

        "1. 絕對只輸出 JSON 物件，不要任何 Markdown 標記或額外文字。",

        "2. suggestedAdvantages 與 suggestedDisadvantages 請強制「各生成 3 到 5 個不同且具體的項目」，必須替換掉範例文字。",

        "3. ICE 的三個分數 (impact, confidence, ease) 請務必根據命題的實際困難度與回報進行「動態真實打分 (1-10)」，不要總是照抄範例。",

        "",

        "=== 當前決策資訊 ===",

        "決策命題：" + activeTopic,

        "目前使用者已整理的優點：" +
          (prosForPrompt

            .filter((item) => item.text.trim())

            .map((item) => item.text + " (權重 " + item.weight + ")")

            .join("；") || "無"),

        "目前使用者已整理的缺點：" +
          (consForPrompt

            .filter((item) => item.text.trim())

            .map((item) => item.text + " (權重 " + item.weight + ")")

            .join("；") || "無"),
      ];

      const promptText = promptLines.join("\n");

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
          encodeURIComponent(key),

        {
          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],

            generationConfig: {
              temperature: 0.6, // 提高溫度以確保生成具體不同內容

              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error("API 請求失敗 (" + response.status + "): " + errorBody);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      const payload = parseGeminiPayload(responseText);

      const generatedAnalysis: Analysis = {
        blindspot: "AI 盲點提示：" + payload.sandboxFeedback,

        weightCheck: "AI 權重校正核心理由：" + payload.iceAssessment.reasoning,

        nextStep:
          "建議優先聚焦於「" +
          (payload.suggestedAdvantages[0]?.text ?? "關鍵優勢") +
          "」，並同步預留「" +
          (payload.suggestedDisadvantages[0]?.text ?? "主要風險") +
          "」的應變空間。",

        sandboxFeedback: payload.sandboxFeedback,
      };

      setAnalysis(generatedAnalysis);

      setSandboxFeedback(payload.sandboxFeedback);

      setAiTagPool({
        pros: payload.suggestedAdvantages.map((item) => ({
          text: item.text,

          weight: item.score,

          tone: "teal",
        })),

        cons: payload.suggestedDisadvantages.map((item) => ({
          text: item.text,

          weight: item.score,

          tone: "amber",
        })),
      });

      setIce({
        impact: payload.iceAssessment.impact,

        confidence: payload.iceAssessment.confidence,

        ease: payload.iceAssessment.ease,
      });

      toast.success("AI 決策分析已完成！", {
        description: "已為您動態產生多組標籤與最新沙盒反饋與 ICE 分數。",
      });
    } catch (error) {
      console.error("Gemini analysis failed", error);

      const message =
        error instanceof Error ? error.message : "請確認 API Key 是否正確且網路連線正常。";

      setAnalysisError(message);

      toast.error("AI 分析失敗", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const filledPros = pros.filter((i) => i.text.trim());

  const filledCons = cons.filter((i) => i.text.trim());

  const totalItems = filledPros.length + filledCons.length;

  const confidence = totalItems === 0 ? 0 : totalItems < 3 ? 45 : totalItems > 5 ? 90 : 70;

  const confidenceMeta =
    totalItems < 3
      ? {
          color: "var(--warning)",

          label: "線索不足",

          note: "因您提供的決策線索較少，此評估可能存在主觀偏誤。",
        }
      : totalItems > 5
        ? {
            color: "var(--success)",

            label: "評估精準",

            note: "已全面交叉比對您輸入的各項利弊權重，評估精準度高。",
          }
        : {
            color: "var(--primary)",

            label: "評估中等",

            note: "建議再補充 1-2 項關鍵利弊，可讓 AI 推理更立體。",
          };

  const topPro = [...filledPros].sort((a, b) => b.weight - a.weight)[0];

  const topCon = [...filledCons].sort((a, b) => b.weight - a.weight)[0];

  const sendFeedback = (kind: "up" | "down") => {
    setFeedback(kind);

    toast.success("感謝回饋", { description: "您的意見將幫助決策模型持續進化。" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:flex-row">
        {sidebarOpen && (
          <aside className="w-full rounded-3xl border border-border bg-card/80 p-4 shadow-xl backdrop-blur lg:sticky lg:top-6 lg:h-fit lg:w-80">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  History
                </p>

                <h3 className="text-base font-semibold text-foreground">歷史決策日誌</h3>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-full border border-border bg-[#F4F1EA] p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="收合側邊欄"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <HistorySidebar entries={history} onRestore={restoreHistoryEntry} />
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
                style={{
                  background: "linear-gradient(135deg, var(--primary), oklch(0.55 0.2 260))",
                }}
              >
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight">DecideNow</h1>

                <p className="text-xs text-muted-foreground">AI 決策矩陣 · 盲點偵測</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-[#F4F1EA] px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                )}
                📁 歷史決策日誌
              </button>

              <div className="hidden items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                量化利弊 · 揭露盲點 · 找到第三條路
              </div>
            </div>
          </header>

          {!topic ? (
            <section className="rounded-3xl border border-border bg-card/60 p-6 shadow-2xl backdrop-blur sm:p-10">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  第一步 · 定義你的命題
                </div>

                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  你正在糾結什麼決定？
                </h2>

                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  寫下一句話，DecideNow 會幫你把它拆解成可量化的優缺點矩陣。
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 80))}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") confirmTopic();
                    }}
                    maxLength={80}
                    placeholder="請輸入你正在糾結的決策命題..."
                    className="flex-1 rounded-xl border border-border bg-background/70 px-4 py-3.5 text-base text-foreground shadow-inner outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />

                  <button
                    onClick={confirmTopic}
                    disabled={!draft.trim()}
                    className="rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    開始分析 →
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  {["開學後每週實習 16 小時", "買一台入門級無反相機", "換到新創公司"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft(s)}
                      className="rounded-full border border-border bg-background/40 px-3 py-1 transition-all hover:border-primary/60 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-background/40 p-4 text-left">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                    Gemini API Key（選填，用於啟用 AI 自動判斷）
                  </label>

                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="輸入 Gemini API Key"
                    className="mt-2 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm text-foreground shadow-inner outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />

                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {apiKeyInput.trim()
                      ? "已偵測到 API Key：送出命題後，AI 會自動產生優缺點標籤並判斷 ICE 分數，您仍可隨時手動調整。"
                      : "未輸入 API Key 時，需自行新增優缺點；之後隨時可回來輸入 Key，並於下方點擊「AI 盲點偵測」手動觸發判斷。"}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="mb-8 flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-lg">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Target className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                    你的決策命題
                  </div>

                  <h2 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                    {topic}
                  </h2>
                </div>

                <button
                  onClick={resetTopic}
                  className="shrink-0 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-destructive/50 hover:text-foreground"
                >
                  <X className="mr-1 inline h-3.5 w-3.5" />
                  重設
                </button>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <Column
                  side="pros"
                  title="優點 / 機會"
                  items={pros}
                  onAdd={() => addItem("pros")}
                  onUpdate={(id, patch) => updateItem("pros", id, patch)}
                  onRemove={(id) => removeItem("pros", id)}
                  tagPool={aiTagPool.pros}
                  topic={activeQuestion}
                  onAddTag={(tag) => addPresetTag("pros", tag)}
                />

                <Column
                  side="cons"
                  title="缺點 / 風險"
                  items={cons}
                  onAdd={() => addItem("cons")}
                  onUpdate={(id, patch) => updateItem("cons", id, patch)}
                  onRemove={(id) => removeItem("cons", id)}
                  tagPool={aiTagPool.cons}
                  topic={activeQuestion}
                  onAddTag={(tag) => addPresetTag("cons", tag)}
                />
              </section>

              <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      即時加權決策儀表
                    </div>

                    <div className="mt-1 text-lg font-semibold">{verdict}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!apiKeyInput.trim() && (
                      <span className="text-[11px] text-muted-foreground">
                        尚未設定 API Key，請按「重設」回首頁輸入
                      </span>
                    )}

                    <button
                      onClick={() => void runAnalysis()}
                      disabled={!canAnalyze || loading}
                      className="group relative overflow-hidden rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="flex items-center gap-2">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI 評估中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />✨ AI 盲點偵測
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span
                      className="flex items-center gap-1.5 font-medium"
                      style={{ color: "var(--success)" }}
                    >
                      <TrendingUp className="h-4 w-4" /> 優點加權 {prosScore}
                    </span>

                    <span
                      className="flex items-center gap-1.5 font-medium"
                      style={{ color: "var(--destructive)" }}
                    >
                      缺點加權 {consScore} <TrendingDown className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-background/70 ring-1 ring-inset ring-border">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${prosPct}%`,

                        background: `linear-gradient(90deg, ${barColor}, color-mix(in oklab, ${barColor} 60%, white))`,

                        boxShadow: `0 0 20px color-mix(in oklab, ${barColor} 50%, transparent)`,
                      }}
                    />

                    <div
                      className="absolute top-0 h-full w-px bg-foreground/40"
                      style={{ left: "50%" }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Pros {prosPct.toFixed(0)}%</span>

                    <span>50% 均衡線</span>

                    <span>Cons {(100 - prosPct).toFixed(0)}%</span>
                  </div>
                </div>
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.03)] animate-fade-in">
                <header
                  className="flex items-center justify-between border-b border-border px-6 py-4"
                  style={{
                    background:
                      "linear-gradient(90deg, color-mix(in oklab, var(--primary) 10%, transparent), transparent)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />

                    <h3 className="text-sm font-semibold tracking-wide">AI 決策反饋面板</h3>
                  </div>

                  {analysis && (
                    <button
                      onClick={() => setAnalysis(null)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="關閉"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </header>

                {analysis && (
                  <DiagnosisSummary
                    confidence={confidence}
                    color={confidenceMeta.color}
                    label={confidenceMeta.label}
                    note={confidenceMeta.note}
                    topicSummary={topic!}
                    itemCount={totalItems}
                  />
                )}

                <div className="p-6">
                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
                      ))}
                    </div>
                  ) : analysis ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <InsightCard
                          icon={<Search className="h-4 w-4" />}
                          title="盲點偵測"
                          emoji="🔍"
                          body={analysis.blindspot}
                          accent="var(--primary)"
                          grounding={
                            topPro
                              ? "基於您輸入的：【" +
                                topPro.text +
                                " (" +
                                topPro.weight +
                                "分)】進行交叉推理"
                              : null
                          }
                        />

                        <InsightCard
                          icon={<Scale className="h-4 w-4" />}
                          title="權重合理性評估"
                          emoji="⚖️"
                          body={analysis.weightCheck}
                          accent="var(--destructive)"
                          grounding={
                            topCon
                              ? "基於您輸入的：【" +
                                topCon.text +
                                " (" +
                                topCon.weight +
                                "分)】進行權重校正"
                              : topPro
                                ? "基於您輸入的：【" +
                                  topPro.text +
                                  " (" +
                                  topPro.weight +
                                  "分)】進行權重校正"
                                : null
                          }
                        />

                        <InsightCard
                          icon={<Lightbulb className="h-4 w-4" />}
                          title="行動替代方案"
                          emoji="💡"
                          body={analysis.nextStep}
                          accent="var(--success)"
                          grounding={null}
                        />
                      </div>

                      <PMDecisionSandbox
                        ice={ice}
                        onIceChange={(patch) => setIce((s) => ({ ...s, ...patch }))}
                        topic={topic!}
                        topCon={topCon}
                        sandboxFeedback={sandboxFeedback || analysis?.sandboxFeedback || ""}
                      />

                      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                        <span className="mr-1">這則分析對您有幫助嗎？</span>

                        <button
                          onClick={() => sendFeedback("up")}
                          disabled={feedback !== null}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-all hover:border-[color:var(--success)] hover:text-[color:var(--success)] disabled:cursor-not-allowed"
                          style={
                            feedback === "up"
                              ? {
                                  borderColor: "var(--success)",

                                  color: "var(--success)",

                                  background:
                                    "color-mix(in oklab, var(--success) 10%, transparent)",
                                }
                              : undefined
                          }
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          有幫助
                        </button>

                        <button
                          onClick={() => sendFeedback("down")}
                          disabled={feedback !== null}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-all hover:border-[color:var(--destructive)] hover:text-[color:var(--destructive)] disabled:cursor-not-allowed"
                          style={
                            feedback === "down"
                              ? {
                                  borderColor: "var(--destructive)",

                                  color: "var(--destructive)",

                                  background:
                                    "color-mix(in oklab, var(--destructive) 10%, transparent)",
                                }
                              : undefined
                          }
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                          沒抓到重點
                        </button>
                      </div>
                    </>
                  ) : analysisError ? (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <div
                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                        style={{
                          background: "color-mix(in oklab, var(--destructive) 12%, transparent)",

                          color: "var(--destructive)",
                        }}
                      >
                        <ShieldAlert className="h-7 w-7" />
                      </div>

                      <h4
                        className="text-base font-semibold"
                        style={{ color: "var(--destructive)" }}
                      >
                        AI 分析失敗
                      </h4>

                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        請確認 API Key 是否正確、額度是否充足，或稍後再試一次。以下為詳細錯誤訊息：
                      </p>

                      <pre className="mt-3 max-w-md whitespace-pre-wrap break-words rounded-lg border border-border bg-background/60 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
                        {analysisError}
                      </pre>

                      <button
                        onClick={() => void runAnalysis()}
                        disabled={!canAnalyze}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-[#F4F1EA] px-4 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/30 hover:bg-[#efe8dc]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        重新嘗試 AI 分析
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <div
                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                        style={{
                          background:
                            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 15%, transparent), color-mix(in oklab, var(--primary) 5%, transparent))",

                          color: "var(--primary)",
                        }}
                      >
                        <Wand2 className="h-7 w-7" />
                      </div>

                      <h4 className="text-base font-semibold">引導式提示</h4>

                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        當您列完優缺點並拉好權重滑桿後，點擊右上方的『AI 盲點偵測』，
                        我將為您指出當局者迷的盲點與替代方案。
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                <button
                  onClick={saveDecision}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-[#F4F1EA] px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-[#efe8dc]"
                >
                  <Archive className="h-4 w-4" />
                  💾 封存此決策
                </button>

                <button
                  onClick={copyReport}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-[#F4F1EA] px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-[#efe8dc]"
                >
                  <Copy className="h-4 w-4" />
                  📋 複製報告
                </button>
              </div>
            </>
          )}

          <footer className="mt-16 text-center text-xs text-muted-foreground">
            DecideNow · 前端原型 · 由 Gemini AI 驅動的決策引擎
          </footer>
        </div>
      </div>
    </div>
  );
}

function HistorySidebar({
  entries,

  onRestore,
}: {
  entries: HistoryEntry[];

  onRestore: (entry: HistoryEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-[#F4F1EA]/70 p-5 text-center text-sm leading-relaxed text-muted-foreground">
        暫無歷史紀錄。當你封存一次決策後，這裡就會出現完整的時間軸。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => onRestore(entry)}
          className="w-full rounded-2xl border border-border bg-background/80 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Archive className="h-3.5 w-3.5" />

            {entry.savedAt}
          </div>

          <div className="mt-2 text-sm font-semibold text-foreground">{entry.topic}</div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>ICE {entry.iceScore}</span>

            <span>{entry.pros.length + entry.cons.length} 項因子</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function DiagnosisSummary({
  confidence,

  color,

  label,

  note,

  topicSummary,

  itemCount,
}: {
  confidence: number;

  color: string;

  label: string;

  note: string;

  topicSummary: string;

  itemCount: number;
}) {
  const size = 72;

  const stroke = 7;

  const r = (size - stroke) / 2;

  const c = 2 * Math.PI * r;

  const offset = c - (confidence / 100) * c;

  return (
    <div
      className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center"
      style={{
        background: `color-mix(in oklab, ${color} 5%, transparent)`,
      }}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms ease-out" }}
          />
        </svg>

        <div
          className="absolute inset-0 flex items-center justify-center text-sm font-bold"
          style={{ color }}
        >
          {confidence}%
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color }} />

          <span className="text-sm font-semibold">AI 分析信心指數</span>

          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              color,

              background: `color-mix(in oklab, ${color} 15%, transparent)`,
            }}
          >
            {label}
          </span>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>

        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          命題：<span className="text-foreground/80">{topicSummary}</span> · 交叉比對 {itemCount}{" "}
          條線索
        </p>
      </div>
    </div>
  );
}

function Column({
  side,

  title,

  items,

  onAdd,

  onUpdate,

  onRemove,

  tagPool,

  topic,

  onAddTag,
}: {
  side: "pros" | "cons";

  title: string;

  items: Item[];

  onAdd: () => void;

  onUpdate: (id: string, patch: Partial<Item>) => void;

  onRemove: (id: string) => void;

  tagPool: AiTag[];

  topic: string;

  onAddTag: (tag: AiTag) => void;
}) {
  const isPros = side === "pros";

  const accent = isPros ? "var(--success)" : "var(--destructive)";

  const prefix = isPros ? "✨" : "⚠️";

  const sign = isPros ? "+" : "-";

  return (
    <div
      className="flex flex-col rounded-2xl border border-border bg-card/60 p-5 shadow-lg backdrop-blur transition-all"
      style={{
        boxShadow: `0 10px 30px -20px color-mix(in oklab, ${accent} 60%, transparent)`,
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          />

          <h3 className="text-base font-bold tracking-tight" style={{ color: accent }}>
            {title}
          </h3>

          <span className="ml-1 rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {items.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/30 p-5 text-center text-sm text-muted-foreground">
            暫無資料，點擊下方按鈕新增，或從 AI 預設標籤池挑選 ↓
          </div>
        )}

        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            accent={accent}
            onChange={(patch) => onUpdate(item.id, patch)}
            onRemove={() => onRemove(item.id)}
            placeholder={isPros ? "例如：能累積實務經驗" : "例如：通勤時間過長"}
          />
        ))}
      </div>

      <button
        onClick={onAdd}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-all hover:border-solid hover:bg-background/40 hover:text-foreground"
        style={{ borderColor: `color-mix(in oklab, ${accent} 40%, transparent)` }}
      >
        <Plus className="h-4 w-4" />
        新增項目
      </button>

      <div className="mt-4 border-t border-dashed border-border/60 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" style={{ color: accent }} />
          AI 動態標籤池 · 點擊即可疊加
        </div>

        {tagPool.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
            輸入命題後，AI 會根據情境自動產生適合的優缺點標籤。
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tagPool.map((tag) => {
              const toneClass =
                tag.tone === "amber"
                  ? "border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.16)]"
                  : tag.tone === "teal"
                    ? "border-teal-500 bg-teal-50 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.16)]"
                    : "border-border bg-[#F4F1EA] text-muted-foreground";

              return (
                <button
                  key={tag.text}
                  onClick={() => onAddTag(tag)}
                  className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all hover:-translate-y-0.5 active:scale-95 ${toneClass}`}
                  title={`${prefix} ${tag.text}（${sign}${tag.weight} 分）`}
                >
                  <span>
                    {prefix} {tag.text}
                  </span>

                  <span
                    className="rounded-sm bg-white/70 px-1 text-[10px] font-bold tabular-nums"
                    style={{ color: accent }}
                  >
                    {sign}

                    {tag.weight}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,

  accent,

  placeholder,

  onChange,

  onRemove,
}: {
  item: Item;

  accent: string;

  placeholder: string;

  onChange: (patch: Partial<Item>) => void;

  onRemove: () => void;
}) {
  return (
    <div className="group rounded-xl border border-border bg-background/50 p-3 transition-all hover:border-border/80">
      <div className="flex items-center gap-2">
        <input
          value={item.text}
          maxLength={MAX_LEN}
          onChange={(e) => onChange({ text: e.target.value.slice(0, MAX_LEN) })}
          placeholder={placeholder}
          className="flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <button
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          aria-label="刪除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 px-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">權重</span>

        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={Math.abs(item.weight)}
          onChange={(e) =>
            onChange({ weight: item.weight < 0 ? -Number(e.target.value) : Number(e.target.value) })
          }
          className="flex-1 accent-current"
          style={{ color: accent }}
        />

        <span
          className="w-8 rounded-md py-0.5 text-center text-xs font-bold"
          style={{
            color: accent,

            background: `color-mix(in oklab, ${accent} 15%, transparent)`,
          }}
        >
          {item.weight < 0 ? `-${Math.abs(item.weight)}` : item.weight}
        </span>
      </div>

      <div className="mt-1 flex justify-between px-2 text-[10px] text-muted-foreground">
        <span>微不足道</span>

        <span>決定性</span>
      </div>

      <div className="mt-1 px-2 text-right text-[10px] text-muted-foreground">
        {item.text.length}/{MAX_LEN}
      </div>
    </div>
  );
}

function InsightCard({
  icon,

  emoji,

  title,

  body,

  accent,

  grounding,
}: {
  icon: ReactNode;

  emoji: string;

  title: string;

  body: string;

  accent: string;

  grounding?: string | null;
}) {
  return (
    <div
      className="flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5"
      style={{
        boxShadow: `0 12px 30px -20px color-mix(in oklab, ${accent} 45%, transparent)`,
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `color-mix(in oklab, ${accent} 15%, transparent)`,

            color: accent,
          }}
        >
          {icon}
        </span>

        <h4 className="text-sm font-semibold tracking-tight">
          <span className="mr-1">{emoji}</span>

          {title}
        </h4>
      </div>

      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>

      {grounding && (
        <div
          className="mt-4 flex items-start gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-[11px] leading-snug"
          style={{
            borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,

            color: "var(--muted-foreground)",

            background: `color-mix(in oklab, ${accent} 4%, transparent)`,
          }}
        >
          <Link2 className="mt-0.5 h-3 w-3 shrink-0" style={{ color: accent }} />

          <span>{grounding}</span>
        </div>
      )}
    </div>
  );
}

function PMDecisionSandbox({
  ice,

  onIceChange,

  topic,

  topCon,

  sandboxFeedback,
}: {
  ice: { impact: number; confidence: number; ease: number };

  onIceChange: (patch: Partial<{ impact: number; confidence: number; ease: number }>) => void;

  topic: string;

  topCon: Item | undefined;

  sandboxFeedback: string;
}) {
  const score = ice.impact * ice.confidence * ice.ease;

  const verdict =
    score >= 700
      ? {
          tone: "var(--success)",

          emoji: "🌟",

          title: "Strong Buy · 高價值決策",

          body: "高價值、低阻力，建議立即採信並執行，快速啟動 MVP 驗證。",
        }
      : score >= 400
        ? {
            tone: "var(--warning)",

            emoji: "⚖️",

            title: "Hold · 具備可行性",

            body: "具備可行性，但需進一步評估潛在風險與替代方案後再全速投入。",
          }
        : {
            tone: "var(--destructive)",

            emoji: "🛑",

            title: "Sell · 回報過低",

            body: "回報過低或執行難度過高，建議重新審視命題或尋找替代方案。",
          };

  const aiPlanB =
    sandboxFeedback || `針對「${topic}」先定義一個最小實驗與停損門檻，再決定是否繼續投入。`;

  return (
    <div className="mt-6 rounded-2xl border border-border p-5" style={{ background: "#F4F6F9" }}>
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in oklab, var(--primary) 12%, transparent)",

            color: "var(--primary)",
          }}
        >
          <Rocket className="h-4 w-4" />
        </span>

        <h3 className="text-sm font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
          🧪 PM 決策沙盒 · Decision Sandbox
        </h3>

        <span className="ml-auto text-[11px] text-muted-foreground">引入真實 PM 決策框架</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4" style={{ color: "var(--primary)" }} />

            <h4 className="text-sm font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              ICE 決策矩陣評估
            </h4>

            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
              Impact × Confidence × Ease
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <IceSlider
              label="Impact 影響力"
              hint="能帶來多大的正面效益"
              value={ice.impact}
              onChange={(v) => onIceChange({ impact: v })}
              color="var(--primary)"
            />

            <IceSlider
              label="Confidence 信心度"
              hint="效益成真的把握程度"
              value={ice.confidence}
              onChange={(v) => onIceChange({ confidence: v })}
              color="var(--success)"
            />

            <IceSlider
              label="Ease 容易度"
              hint="分數越高 = 越容易、成本越低"
              value={ice.ease}
              onChange={(v) => onIceChange({ ease: v })}
              color="var(--warning)"
            />
          </div>

          <div
            className="mt-4 flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: `color-mix(in oklab, ${verdict.tone} 10%, transparent)` }}
          >
            <span className="text-xs text-muted-foreground">ICE 綜合分數</span>

            <span className="text-2xl font-extrabold tabular-nums" style={{ color: verdict.tone }}>
              {score}

              <span className="ml-1 text-xs font-medium text-muted-foreground">/ 1000</span>
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed">
            <span className="text-base leading-none">{verdict.emoji}</span>

            <div>
              <div className="font-bold" style={{ color: verdict.tone }}>
                {verdict.title}
              </div>

              <p className="mt-0.5 text-muted-foreground">{verdict.body}</p>
            </div>
          </div>

          <div
            className="mt-3 rounded-lg border p-3 text-[11px] leading-relaxed text-muted-foreground"
            style={{
              borderColor: "#EAE5D9",

              background: "#FBF7EE",
            }}
          >
            <div className="mb-1.5 font-semibold text-foreground/80">💡 ICE 決策矩陣備註</div>

            <div>
              • 計算公式：
              <span className="font-semibold text-foreground/75">
                ICE 總分 = 影響力 (1-10) × 信心度 (1-10) × 容易度 (1-10)
              </span>
              。分數越高，代表該決策越值得優先執行。
            </div>

            <div className="mt-1.5">• 分數級距參考：</div>

            <ul className="mt-0.5 space-y-0.5 pl-3">
              <li>
                <span style={{ color: "var(--success)" }}>🌟 700 - 1000 分</span>
                ：高價值、低阻力，建議立即採信並執行（Strong Buy）。
              </li>

              <li>
                <span style={{ color: "var(--warning)" }}>⚖️ 400 - 699 分</span>
                ：具備可行性，但需進一步評估潛在風險與替代方案（Hold）。
              </li>

              <li>
                <span style={{ color: "var(--destructive)" }}>🛑 1 - 399 分</span>
                ：回報過低或執行難度過高，建議重新審視命題（Sell）。
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="mb-3 flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" style={{ color: "var(--destructive)" }} />

            <h4 className="text-sm font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              風險緩釋與 Plan B 應變計畫
            </h4>
          </div>

          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: "color-mix(in oklab, var(--destructive) 30%, transparent)",

              background: "color-mix(in oklab, var(--destructive) 5%, transparent)",
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--destructive)" }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              🚨 最大風險
            </div>

            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
              {topCon ? topCon.text : "當前矩陣中尚未列出風險因子"}

              {topCon && (
                <span className="ml-1 text-xs text-muted-foreground">
                  （權重 {topCon.weight} 分）
                </span>
              )}
            </p>
          </div>

          <div
            className="mt-3 rounded-lg border p-3"
            style={{
              borderColor: "color-mix(in oklab, var(--success) 35%, transparent)",

              background: "color-mix(in oklab, var(--success) 6%, transparent)",
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--success)" }}
            >
              <Zap className="h-3.5 w-3.5" />
              💡 PM 應變計畫 (Plan B)
            </div>

            <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{aiPlanB}</p>
          </div>

          <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/70">💬 教練提醒：</span>
            制定 Plan B 不是悲觀，而是讓你敢於全力推進 Plan A 的心理安全網。
          </div>
        </div>
      </div>
    </div>
  );
}

function IceSlider({
  label,

  hint,

  value,

  onChange,

  color,
}: {
  label: string;

  hint: string;

  value: number;

  onChange: (v: number) => void;

  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>
            {label}
          </div>

          <div className="text-[10px] text-muted-foreground">{hint}</div>
        </div>

        <span
          className="rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
          style={{
            color,

            background: `color-mix(in oklab, ${color} 15%, transparent)`,
          }}
        >
          {value}
        </span>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full"
        style={{ accentColor: color }}
      />
    </div>
  );
}
