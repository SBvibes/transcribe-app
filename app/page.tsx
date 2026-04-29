"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Screen = "paste" | "typing" | "results" | "recall" | "history";

type ErrorMark = {
  index: number;
  expected: string;
  actual: string;
  word: string;
};

type Stats = {
  wpm: number;
  accuracy: number;
  correct: number;
  typed: number;
  errors: number;
  elapsed: number;
  progress: number;
  consistency: number;
};

type HistoryItem = {
  id: string;
  passage: string;
  wpm: number;
  accuracy: number;
  errors: number;
  time: number;
  recall: string;
  timestamp: string;
};

const STORAGE_KEY = "transcribe.sessions.v1";
const MAX_PASSAGE_CHARS = 900;

const sampleText =
  "Photosynthesis is the process used by plants, algae, and certain bacteria to convert light energy into chemical energy. During this process, they use sunlight to synthesize foods from carbon dioxide and water. Photosynthesis occurs in the chloroplasts of plant cells, which contain the green pigment chlorophyll. This pigment helps to capture sunlight.";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function makePassage(value: string) {
  const cleaned = cleanText(value);
  if (cleaned.length <= MAX_PASSAGE_CHARS) return cleaned;
  const slice = cleaned.slice(0, MAX_PASSAGE_CHARS);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("?"), slice.lastIndexOf("!"));
  return slice.slice(0, lastStop > 280 ? lastStop + 1 : MAX_PASSAGE_CHARS).trim();
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function calculateStats(target: string, typed: string, elapsed: number): Stats {
  const typedChars = typed.length;
  let correct = 0;
  let errors = 0;

  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === target[index]) correct += 1;
    else errors += 1;
  }

  const minutes = Math.max(elapsed / 60, 1 / 60);
  const wpm = Math.round(typedChars / 5 / minutes);
  const accuracy = typedChars ? Math.round((correct / typedChars) * 100) : 100;
  const progress = target.length ? Math.round((typedChars / target.length) * 100) : 0;
  const consistency = Math.max(0, Math.min(100, Math.round(accuracy - Math.min(errors * 2, 18) + Math.min(progress / 8, 12))));

  return { wpm, accuracy, correct, typed: typedChars, errors, elapsed, progress, consistency };
}

function collectErrors(target: string, typed: string): ErrorMark[] {
  const marks: ErrorMark[] = [];
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] !== target[index]) {
      const start = target.lastIndexOf(" ", index) + 1;
      const nextSpace = target.indexOf(" ", index);
      const end = nextSpace === -1 ? target.length : nextSpace;
      marks.push({
        index,
        expected: target[index] ?? "",
        actual: typed[index] ?? "",
        word: target.slice(start, end)
      });
    }
  }
  return marks;
}

function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("paste");
  const [sourceText, setSourceText] = useState("");
  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [recall, setRecall] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  const elapsed = startedAt ? ((finishedAt ?? now) - startedAt) / 1000 : 0;
  const stats = useMemo(() => calculateStats(passage, typed, elapsed), [passage, typed, elapsed]);
  const errors = useMemo(() => collectErrors(passage, typed), [passage, typed]);
  const wordCount = cleanText(sourceText).split(" ").filter(Boolean).length;
  const charCount = cleanText(sourceText).length;

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  useEffect(() => {
    if (screen !== "typing" || finishedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(timer);
  }, [screen, finishedAt]);

  useEffect(() => {
    if (screen === "typing") typingAreaRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (screen === "typing" && passage && typed.length >= passage.length && !finishedAt) {
      setFinishedAt(Date.now());
      setScreen("results");
    }
  }, [screen, passage, typed, finishedAt]);

  function startSession(text = sourceText) {
    const nextPassage = makePassage(text);
    if (!nextPassage) return;
    setPassage(nextPassage);
    setTyped("");
    setStartedAt(Date.now());
    setFinishedAt(null);
    setRecall("");
    setScreen("typing");
  }

  function resetSession() {
    setTyped("");
    setStartedAt(Date.now());
    setFinishedAt(null);
    setScreen("typing");
  }

  function newSession() {
    setSourceText("");
    setPassage("");
    setTyped("");
    setStartedAt(null);
    setFinishedAt(null);
    setRecall("");
    setScreen("paste");
  }

  function submitRecall() {
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      passage,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      errors: stats.errors,
      time: stats.elapsed,
      recall: recall.trim(),
      timestamp: new Date().toISOString()
    };
    const next = [item, ...getHistory()].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setHistory(next);
    setScreen("history");
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (screen !== "typing") return;
    if (!startedAt) setStartedAt(Date.now());

    if (event.key === "Tab") {
      event.preventDefault();
      resetSession();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setFinishedAt(Date.now());
      setScreen("results");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      setTyped((value) => value.slice(0, -1));
      return;
    }

    if (event.key.length === 1 && typed.length < passage.length) {
      event.preventDefault();
      setTyped((value) => value + event.key);
    }
  }

  return (
    <main className="shell">
      <Nav screen={screen} setScreen={setScreen} canShowHistory={history.length > 0} onNew={newSession} onEnd={() => setScreen("results")} active={screen === "typing"} />

      {screen === "paste" && (
        <PasteScreen
          sourceText={sourceText}
          setSourceText={setSourceText}
          wordCount={wordCount}
          charCount={charCount}
          onStart={() => startSession()}
          onSample={() => {
            setSourceText(sampleText);
            startSession(sampleText);
          }}
        />
      )}

      {screen === "typing" && (
        <TypingScreen
          passage={passage}
          typed={typed}
          stats={stats}
          errors={errors}
          onKeyDown={handleKeyDown}
          refObject={typingAreaRef}
          onReset={resetSession}
          onFinish={() => {
            setFinishedAt(Date.now());
            setScreen("results");
          }}
        />
      )}

      {screen === "results" && (
        <ResultsScreen stats={stats} errors={errors} passage={passage} onNew={newSession} onPractice={resetSession} onRecall={() => setScreen("recall")} />
      )}

      {screen === "recall" && (
        <RecallScreen stats={stats} recall={recall} setRecall={setRecall} onBack={() => setScreen("results")} onSubmit={submitRecall} />
      )}

      {screen === "history" && <HistoryScreen history={history} onClear={clearHistory} onNew={newSession} />}
    </main>
  );
}

function Nav({
  screen,
  setScreen,
  canShowHistory,
  onNew,
  onEnd,
  active
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  canShowHistory: boolean;
  onNew: () => void;
  onEnd: () => void;
  active: boolean;
}) {
  return (
    <header className="topbar">
      <div className="flex items-center gap-8">
        <button className="brand" onClick={onNew} aria-label="Start new session">
          transcribe<span className="brand-dot">.</span>
        </button>
        <nav className="hidden items-center gap-4 md:flex">
          <button className={`nav-link ${screen !== "history" ? "nav-link-active" : ""}`} onClick={onNew}>
            Practice
          </button>
          <button className={`nav-link ${screen === "history" ? "nav-link-active" : ""}`} onClick={() => setScreen("history")}>
            History
          </button>
        </nav>
      </div>
      {active ? (
        <button className="btn btn-danger px-4 py-2" onClick={onEnd}>
          End Session
        </button>
      ) : (
        <button className="btn btn-ghost px-4 py-2" onClick={canShowHistory ? () => setScreen("history") : onNew}>
          {canShowHistory ? "History" : "New Session"}
        </button>
      )}
    </header>
  );
}

function PasteScreen({
  sourceText,
  setSourceText,
  wordCount,
  charCount,
  onStart,
  onSample
}: {
  sourceText: string;
  setSourceText: (value: string) => void;
  wordCount: number;
  charCount: number;
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-74px)] max-w-6xl flex-col items-center px-6 py-16 text-center">
      <div className="rounded-md border border-line bg-white/[0.02] px-4 py-2 text-xs font-bold text-teal">Type. Learn. Remember.</div>
      <h1 className="mt-12 max-w-4xl text-4xl font-bold leading-tight text-white md:text-6xl">
        Type it. Learn it. <span className="text-gold">Remember it.</span>
      </h1>
      <p className="mt-8 max-w-3xl text-base leading-7 text-muted">
        Paste your notes, textbooks, or articles. Type them out to improve your skills while actively processing what you read.
      </p>

      <div className="panel mt-8 w-full max-w-4xl p-4 text-left">
        <textarea
          className="min-h-56 w-full resize-none bg-transparent p-2 text-base leading-7 text-white outline-none placeholder:text-muted"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="Paste your text here..."
        />
        <div className="flex flex-col gap-4 border-t border-white/5 pt-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {charCount} characters / {wordCount} words
          </span>
          <div className="flex gap-3">
            <button className="btn btn-ghost px-4 py-2" onClick={onSample}>
              Try Sample
            </button>
            <button className="btn btn-primary px-4 py-2" disabled={!charCount} onClick={onStart}>
              Start Typing →
            </button>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-muted">Your text stays private and never leaves your device.</p>
      <div className="mt-14 grid w-full max-w-5xl gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Improve Typing Speed", "Track WPM and accuracy in real time."],
          ["Learn Actively", "Reinforce ideas by typing what you read."],
          ["See Progress", "Save summaries and review sessions."],
          ["Distraction Free", "A clean, minimal interface so you can focus."]
        ].map(([title, body]) => (
          <div key={title} className="border-l border-gold/50 pl-5">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TypingScreen({
  passage,
  typed,
  stats,
  errors,
  onKeyDown,
  refObject,
  onReset,
  onFinish
}: {
  passage: string;
  typed: string;
  stats: Stats;
  errors: ErrorMark[];
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  refObject: React.RefObject<HTMLDivElement | null>;
  onReset: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="flex items-center gap-6">
        <span className="text-sm font-bold text-white">Progress</span>
        <span className="text-gold">{stats.progress}%</span>
        <div className="h-2 flex-1 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.min(stats.progress, 100)}%` }} />
        </div>
        <span className="hidden text-sm text-white md:inline">Time</span>
        <span className="text-teal">{formatTime(stats.elapsed)}</span>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_220px]">
        <div
          ref={refObject}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="min-h-[420px] cursor-text outline-none"
          aria-label="Typing area"
        >
          <div className="max-w-5xl text-2xl leading-[2.05] tracking-normal md:text-3xl">
            {passage.split("").map((char, index) => {
              const typedChar = typed[index];
              const isTyped = index < typed.length;
              const isWrong = isTyped && typedChar !== char;
              const isCurrent = index === typed.length;
              return (
                <span
                  key={`${char}-${index}`}
                  className={[
                    isTyped ? "text-white" : "text-white/25",
                    isWrong ? "decoration-redsoft underline decoration-2 underline-offset-8" : "",
                    isCurrent ? "border-l-2 border-teal pl-1 text-white/70" : ""
                  ].join(" ")}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>

        <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Metric label="WPM" value={stats.wpm} />
          <Metric label="Accuracy" value={`${stats.accuracy}%`} gold />
          <Metric label="Characters" value={`${stats.typed} / ${passage.length}`} small />
          <Metric label="Errors" value={errors.length} red />
        </aside>
      </div>

      <div className="mt-10 flex items-center justify-between text-sm text-muted">
        <button className="btn btn-ghost px-4 py-2" onClick={onReset}>
          Tab to reset
        </button>
        <button className="btn btn-ghost px-4 py-2" onClick={onFinish}>
          Skip Esc
        </button>
      </div>
    </section>
  );
}

function ResultsScreen({
  stats,
  errors,
  passage,
  onNew,
  onPractice,
  onRecall
}: {
  stats: Stats;
  errors: ErrorMark[];
  passage: string;
  onNew: () => void;
  onPractice: () => void;
  onRecall: () => void;
}) {
  const uniqueErrors = errors.slice(0, 8);
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="text-center">
        <p className="text-sm font-bold text-teal">Great work. You completed the session.</p>
        <h1 className="mt-5 text-5xl font-bold text-white">Test Complete</h1>
        <p className="mt-5 text-muted">You typed {stats.typed} characters in {formatTime(stats.elapsed)}.</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="WPM" value={stats.wpm} />
        <Metric label="Accuracy" value={`${stats.accuracy}%`} gold />
        <Metric label="Characters" value={stats.typed} />
        <Metric label="Errors" value={stats.errors} red />
        <Metric label="Time" value={formatTime(stats.elapsed)} />
        <Metric label="Consistency" value={`${stats.consistency}%`} gold />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="panel p-6">
          <h2 className="text-base font-bold text-white">Passage Review</h2>
          <p className="mt-5 max-h-48 overflow-auto text-sm leading-7 text-muted">{passage}</p>
        </div>
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Error Review</h2>
            <span className="text-sm text-redsoft">{errors.length} errors found</span>
          </div>
          <div className="mt-5 space-y-3">
            {uniqueErrors.length ? (
              uniqueErrors.map((error) => (
                <div key={`${error.index}-${error.actual}`} className="rounded-md border border-line bg-white/[0.02] p-4 text-sm">
                  <span className="mr-4 rounded border border-line px-2 py-1 text-muted">{error.index + 1}</span>
                  <span className="text-redsoft">{error.actual || "blank"}</span>
                  <span className="mx-5 text-muted">→</span>
                  <span className="text-white">{error.expected || "space"}</span>
                  <span className="ml-4 text-muted">in {error.word}</span>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-line bg-white/[0.02] p-4 text-sm text-teal">No typing errors recorded.</p>
            )}
          </div>
        </div>
      </div>

      <div className="panel mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-end">
        <button className="btn btn-ghost" onClick={onPractice}>
          Back to Practice
        </button>
        <button className="btn btn-ghost" onClick={onNew}>
          Start New Session
        </button>
        <button className="btn btn-primary" onClick={onRecall}>
          Continue to Recall →
        </button>
      </div>
    </section>
  );
}

function RecallScreen({
  stats,
  recall,
  setRecall,
  onBack,
  onSubmit
}: {
  stats: Stats;
  recall: string;
  setRecall: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12 text-center">
      <div className="flex items-center gap-6 text-left">
        <span className="font-bold text-white">Study & Recall</span>
        <span className="text-gold">3/3</span>
        <div className="h-2 flex-1 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gold" style={{ width: "100%" }} />
        </div>
        <span className="hidden text-sm text-white md:inline">Progress</span>
        <span className="text-teal">100%</span>
      </div>

      <h1 className="mt-16 text-4xl font-bold text-white">Let&apos;s make it stick.</h1>
      <p className="mt-5 text-muted">Answer the question below to reinforce what you&apos;ve learned.</p>

      <div className="panel mt-10 p-6 text-left">
        <p className="text-sm font-bold text-teal">Reflection Question</p>
        <h2 className="mt-6 text-2xl font-bold leading-relaxed text-white">What is the main idea of the passage you just typed?</h2>
        <p className="mt-2 text-muted">Summarize the key point in your own words.</p>
        <textarea
          className="mt-6 min-h-44 w-full resize-none rounded-md border border-teal/50 bg-transparent p-5 text-white outline-none placeholder:text-muted focus:border-teal"
          value={recall}
          onChange={(event) => setRecall(event.target.value)}
          placeholder="Type your answer here..."
        />
        <div className="mt-5 flex flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{recall.length} characters</span>
          <button className="btn btn-primary" disabled={!recall.trim()} onClick={onSubmit}>
            Submit Answer →
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Metric label="WPM" value={stats.wpm} />
        <Metric label="Accuracy" value={`${stats.accuracy}%`} gold />
        <Metric label="Errors" value={stats.errors} red />
        <Metric label="Time" value={formatTime(stats.elapsed)} />
      </div>

      <div className="mt-8 flex justify-end">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back to Results
        </button>
      </div>
    </section>
  );
}

function HistoryScreen({ history, onClear, onNew }: { history: HistoryItem[]; onClear: () => void; onNew: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-teal">Saved locally</p>
          <h1 className="mt-3 text-4xl font-bold text-white">History</h1>
          <p className="mt-4 max-w-2xl text-muted">Review completed typing sessions and recall answers saved on this device.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={onNew}>
            New Session
          </button>
          <button className="btn btn-danger" disabled={!history.length} onClick={onClear}>
            Clear History
          </button>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        {history.length ? (
          history.map((item) => (
            <article key={item.id} className="panel grid gap-5 p-5 md:grid-cols-[160px_1fr_220px]">
              <div>
                <p className="text-sm text-white">{new Date(item.timestamp).toLocaleDateString()}</p>
                <p className="mt-2 text-xs text-muted">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div>
                <p className="line-clamp-2 text-sm leading-6 text-stone-200">{item.passage}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{item.recall || "No recall answer saved."}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat label="WPM" value={item.wpm} />
                <MiniStat label="ACC" value={`${item.accuracy}%`} gold />
                <MiniStat label="ERR" value={item.errors} red />
              </div>
            </article>
          ))
        ) : (
          <div className="panel p-10 text-center">
            <h2 className="text-xl font-bold text-white">No sessions saved yet.</h2>
            <p className="mt-4 text-muted">Complete a typing session and submit recall to create your first history item.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, gold, red, small }: { label: string; value: string | number; gold?: boolean; red?: boolean; small?: boolean }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className={`metric-value ${gold ? "gold-value" : ""} ${red ? "red-value" : ""} ${small ? "text-xl text-white" : ""}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, gold, red }: { label: string; value: string | number; gold?: boolean; red?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-white/[0.02] p-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`mt-2 text-lg ${gold ? "text-gold" : red ? "text-redsoft" : "text-teal"}`}>{value}</p>
    </div>
  );
}
