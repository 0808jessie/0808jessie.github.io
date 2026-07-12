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
const MAX_LEN = 50;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type PresetTag = {
  text: string;
  weight: number;
  keywords: RegExp;
  highlightTone?: "amber" | "teal";
};

const PROS_TAGS: PresetTag[] = [
  { text: "發揮空間大", weight: 4, keywords: /新創|startup|公司/i, highlightTone: "amber" },
  { text: "組織扁平", weight: 3, keywords: /新創|startup|扁平/i, highlightTone: "amber" },
  {
    text: "提早累積實戰經驗",
    weight: 4,
    keywords: /實習|intern|工作|職|新創/i,
    highlightTone: "teal",
  },
  { text: "建立產業人脈", weight: 3, keywords: /實習|intern|工作|職|公司/i, highlightTone: "teal" },
  { text: "薪資具備彈性", weight: 3, keywords: /新創|公司|工作|職|薪/i },
];

const CONS_TAGS: PresetTag[] = [
  { text: "制度較不完善", weight: 4, keywords: /新創|startup/i, highlightTone: "amber" },
  { text: "資金風險較高", weight: 3, keywords: /新創|startup|公司/i, highlightTone: "amber" },
  { text: "課業與工作雙重壓力", weight: 4, keywords: /實習|intern|學|課/i, highlightTone: "teal" },
  {
    text: "通勤時間成本高",
    weight: 2,
    keywords: /實習|intern|工作|職|通勤/i,
    highlightTone: "teal",
  },
  { text: "加班頻率較高", weight: 3, keywords: /工作|職|公司|加班/i },
];

function analyze(topic: string): Analysis {
  const t = topic.toLowerCase();
  if (/實習|工作|職|intern|job/i.test(topic) || /實習|工作|職/.test(t)) {
    return {
      blindspot:
        "你目前主要關注在『職涯經驗』與『經濟收入』，但根據過往數據，你可能遺漏了『期末考週與專題發表期的雙重壓力』，以及『每日往返通勤的時間與精神隱性成本』。",
      weightCheck:
        "你將『獲得 1-2 年全職經驗』的權重拉到了 5 分。這是一項高期望投資，請務必在面試時確認該職缺是否具備扎實的導師制度（Mentorship），否則此 5 分的預期權重將面臨降級風險。",
      nextStep:
        "不要陷入去或不去的二分法。建議與雇主協商『前 4 週為壓力測試期』，若開學後課業負載過重，爭取轉換為每週 1 天遠端協作（Remote）的彈性模式。",
    };
  }
  if (/買|購|消費|購物|buy|purchase/i.test(topic)) {
    return {
      blindspot:
        "你高度聚焦在商品帶來的『立即性升級感』。請注意你是否忽略了後續的『維護保養成本、折舊率』，以及該物品在 3 個月後的『實際使用頻率』。",
      weightCheck:
        "你將『感性喜愛度』設為 5 分。建議冷靜 48 小時後重新評估，確認這是『剛需（Need）』還是『想要（Want）』。",
      nextStep:
        "建議先尋找租賃平台租借使用一週末，以最低成本驗證自己是否真的高頻率需要此物品，再決定是否購買全新品。",
    };
  }
  return {
    blindspot:
      "當前你列出的利弊多屬於短期可見因子。請試著將時間軸拉長至一年後，問自己：『一年後的我，還會在意現在這個缺點嗎？』",
    weightCheck:
      "目前的加權總分呈現高度拉鋸。這代表你試圖用理性的分數來掩飾感性的偏好，建議檢視分數最高的項目是否摻雜了情緒通膨。",
    nextStep:
      "若利弊完全對等，代表兩者皆非最佳解。試著列出第三種完全不在此範疇內的替代選項（Option C），打破僵局。",
  };
}

export function DecideNow() {
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [pros, setPros] = useState<Item[]>([]);
  const [cons, setCons] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [ice, setIce] = useState<{ impact: number; confidence: number; ease: number }>({
    impact: 5,
    confidence: 5,
    ease: 5,
  });
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

  // Dynamic bar color based on lean
  const diff = prosScore - consScore;
  const denom = Math.max(total, 1);
  const lean = diff / denom; // -1..1
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
    setAnalysis(null);
  };

  const resetTopic = () => {
    setTopic(null);
    setPros([]);
    setCons([]);
    setAnalysis(null);
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

  const addPresetTag = (side: "pros" | "cons", tag: PresetTag) => {
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

    const reportText = `決策命題：${topic}\nICE 綜合分數：${currentIceScore}\n優點/機會：${pros.filter((item) => item.text.trim()).length} 項\n缺點/風險：${cons.filter((item) => item.text.trim()).length} 項`;

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

  const canAnalyze = !!topic && pros.some((i) => i.text.trim()) && cons.some((i) => i.text.trim());

  const runAnalysis = () => {
    if (!canAnalyze) {
      toast.error("請至少各輸入一項優缺點，才能進行盲點分析。");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setFeedback(null);
    setTimeout(() => {
      setAnalysis(analyze(topic!));
      setLoading(false);
    }, 1500);
  };

  // Confidence + grounding derived from user input
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
    toast.success("感謝您的反饋，這將讓決策教練越變越聰明！");
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
          {/* Header */}
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

          {/* Topic input */}
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
              </div>
            </section>
          ) : (
            <>
              {/* Locked topic */}
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

              {/* Matrix */}
              <section className="grid gap-5 lg:grid-cols-2">
                <Column
                  side="pros"
                  title="優點 / 機會"
                  items={pros}
                  onAdd={() => addItem("pros")}
                  onUpdate={(id, patch) => updateItem("pros", id, patch)}
                  onRemove={(id) => removeItem("pros", id)}
                  tagPool={PROS_TAGS}
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
                  tagPool={CONS_TAGS}
                  topic={activeQuestion}
                  onAddTag={(tag) => addPresetTag("cons", tag)}
                />
              </section>

              {/* Dashboard */}
              <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      即時加權決策儀表
                    </div>
                    <div className="mt-1 text-lg font-semibold">{verdict}</div>
                  </div>
                  <button
                    onClick={runAnalysis}
                    disabled={!canAnalyze || loading}
                    className="group relative overflow-hidden rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="flex items-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI 正在思考…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          AI 盲點偵測
                        </>
                      )}
                    </span>
                  </button>
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

              {/* Analysis Panel — always visible after topic locked */}
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

                {/* Diagnosis summary — always show when analysis exists */}
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
                              ? `基於您輸入的：【${topPro.text} (${topPro.weight}分)】進行交叉推理`
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
                              ? `基於您輸入的：【${topCon.text} (${topCon.weight}分)】進行權重校正`
                              : topPro
                                ? `基於您輸入的：【${topPro.text} (${topPro.weight}分)】進行權重校正`
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

                      {/* PM Decision Sandbox */}
                      <PMDecisionSandbox
                        ice={ice}
                        onIceChange={(patch) => setIce((s) => ({ ...s, ...patch }))}
                        topic={topic!}
                        topCon={topCon}
                      />

                      {/* Feedback loop */}
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
                  ) : (
                    /* Placeholder empty state */
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
            DecideNow · 前端原型 · 由規則引擎模擬 AI 反饋
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
  tagPool: PresetTag[];
  topic: string;
  onAddTag: (tag: PresetTag) => void;
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

      {/* Persistent AI preset tag pool */}
      <div className="mt-4 border-t border-dashed border-border/60 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" style={{ color: accent }} />
          AI 預設標籤池 · 點擊即可疊加
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tagPool.map((tag) => {
            const highlighted = tag.keywords.test(topic);
            const toneClass =
              highlighted && tag.highlightTone === "amber"
                ? "border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.16)] animate-pulse"
                : highlighted && tag.highlightTone === "teal"
                  ? "border-teal-500 bg-teal-50 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.16)] animate-pulse"
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
                  className={`rounded-sm px-1 text-[10px] font-bold tabular-nums ${highlighted ? "bg-white/80" : "bg-white/60"}`}
                  style={{ color: accent }}
                >
                  {sign}
                  {tag.weight}
                </span>
              </button>
            );
          })}
        </div>
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
}: {
  ice: { impact: number; confidence: number; ease: number };
  onIceChange: (patch: Partial<{ impact: number; confidence: number; ease: number }>) => void;
  topic: string;
  topCon: Item | undefined;
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

  const isJob = /實習|工作|職|intern|job/i.test(topic);
  const riskLabel = topCon
    ? `${topCon.text}（權重 ${topCon.weight} 分）`
    : "當前矩陣中權重最高的負面因子";
  const planB = isJob
    ? "與主管約定前兩週為試運行期，若每週 16 小時嚴重影響課業，於第 3 週啟動『每週 1 天改為遠端非同步協作』的緩衝方案。"
    : "設定一個停損點（Trigger Point），例如執行 4 週後若轉換率或滿意度未達預期，立即召開回顧會議（Retrospective）並切換至替代方案 C。";

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
        {/* ICE Framework */}
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

          {/* ICE algorithm note card */}
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

        {/* Risk Mitigation & Plan B */}
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
              {isJob ? "因要兼顧研究所導致精力耗盡" : "當前矩陣中權重最高的負面因子"}
              <span className="ml-1 text-xs text-muted-foreground">（{riskLabel}）</span>
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
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{planB}</p>
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
