import { useState, useEffect, useRef } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  GripVertical,
} from "lucide-react";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function daysAgo(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}

function dateKeyOf(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function formatMonthLabel(viewDate) {
  return viewDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 대한민국 공휴일 (관공서의 공휴일에 관한 규정 기준, 대체공휴일 포함)
// 음력 기반 명절(설날·추석·부처님오신날)은 매년 날짜가 달라지므로 연도별로 직접 등록해야 합니다.
// 아래는 2025~2026년 기준이며, 이후 연도는 공식 발표 확인 후 같은 형식으로 추가하면 됩니다.
const HOLIDAYS = {
  "2025-01-01": "신정",
  "2025-01-27": "임시공휴일(설날)",
  "2025-01-28": "설날",
  "2025-01-29": "설날",
  "2025-01-30": "설날",
  "2025-03-01": "삼일절",
  "2025-03-03": "대체공휴일(삼일절)",
  "2025-05-05": "어린이날·부처님오신날",
  "2025-05-06": "대체공휴일",
  "2025-06-03": "임시공휴일(대통령선거일)",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-06": "추석",
  "2025-10-07": "추석",
  "2025-10-08": "대체공휴일(추석)",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절",
  "2026-01-01": "신정",
  "2026-02-16": "설날",
  "2026-02-17": "설날",
  "2026-02-18": "설날",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-03": "전국동시지방선거일",
  "2026-06-06": "현충일",
  "2026-07-17": "제헌절",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석",
  "2026-09-25": "추석",
  "2026-09-26": "추석",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

// localStorage에 저장되는 state. 디바운스 저장 + 탭 종료/전환 시 즉시 저장까지 처리한다.
function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch (e) {
      console.error("불러오기 실패:", e);
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        console.error("저장 실패:", e);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, key]);

  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(key, JSON.stringify(stateRef.current));
      } catch (e) {
        console.error("저장 실패:", e);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [key]);

  return [state, setState];
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 text-slate-300 cursor-grab" />
      {children}
    </button>
  );
}

function JournalPanel() {
  const [entries, setEntries] = usePersistedState("work-journal-entries", []);
  const [overrides, setOverrides] = useState({});
  const [lookupDate, setLookupDate] = useState(todayKey());
  const entryRefs = useRef({});

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const isExpanded = (date) => {
    if (date in overrides) return overrides[date];
    return daysAgo(date) < 2; // 오늘, 어제는 기본 펼침 / 2일 전부터는 기본 숨김
  };

  const toggleExpand = (date) => {
    setOverrides((prev) => ({ ...prev, [date]: !isExpanded(date) }));
  };

  const updateText = (date, field, text) => {
    setEntries((prev) => prev.map((e) => (e.date === date ? { ...e, [field]: text } : e)));
  };

  const deleteEntry = (date) => {
    setEntries((prev) => prev.filter((e) => e.date !== date));
  };

  const createNewTodayPage = () => {
    const key = todayKey();
    setEntries((prev) => {
      if (prev.some((e) => e.date === key)) return prev;
      return [...prev, { date: key, todayText: "", tomorrowText: "" }];
    });
    setOverrides((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      entryRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleLookup = () => {
    const exists = entries.some((e) => e.date === lookupDate);
    if (!exists) {
      setEntries((prev) => [...prev, { date: lookupDate, todayText: "", tomorrowText: "" }]);
    }
    setOverrides((prev) => ({ ...prev, [lookupDate]: true }));
    setTimeout(() => {
      entryRefs.current[lookupDate]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 mt-5">
        <p className="text-sm text-slate-400">날짜별로 오늘업무와 내일업무를 기록해요.</p>
        <button
          onClick={createNewTodayPage}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          오늘 페이지 작성
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-5">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="date"
          value={lookupDate}
          onChange={(e) => setLookupDate(e.target.value)}
          className="flex-1 text-sm outline-none text-slate-700"
        />
        <button
          onClick={handleLookup}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 px-2"
        >
          조회
        </button>
      </div>

      <div className="space-y-3">
        {sortedEntries.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400">
            아직 작성된 업무일지가 없어요. 위 버튼으로 오늘 페이지를 시작해보세요.
          </div>
        )}

        {sortedEntries.map((entry) => {
          const expanded = isExpanded(entry.date);
          const old = daysAgo(entry.date) >= 2;
          return (
            <div
              key={entry.date}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggleExpand(entry.date)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <span className="text-sm font-semibold text-slate-800">
                    {formatDateLabel(entry.date)}
                  </span>
                  {old && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      {daysAgo(entry.date)}일 전
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteEntry(entry.date)}
                    className="text-slate-300 hover:text-red-500 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleExpand(entry.date)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {expanded && (
                <div
                  ref={(el) => (entryRefs.current[entry.date] = el)}
                  className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                      <span className="text-xs font-semibold text-slate-500">오늘업무</span>
                    </div>
                    <textarea
                      value={entry.todayText}
                      onChange={(e) => updateText(entry.date, "todayText", e.target.value)}
                      placeholder="오늘 진행한(할) 업무를 적어보세요."
                      rows={8}
                      className="w-full text-sm text-slate-700 outline-none resize-none border border-slate-100 rounded-lg p-3 focus:border-indigo-300 leading-relaxed"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold text-slate-500">내일업무</span>
                    </div>
                    <textarea
                      value={entry.tomorrowText}
                      onChange={(e) => updateText(entry.date, "tomorrowText", e.target.value)}
                      placeholder="내일 예정된 업무를 적어보세요."
                      rows={8}
                      className="w-full text-sm text-slate-700 outline-none resize-none border border-slate-100 rounded-lg p-3 focus:border-amber-300 leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400 leading-relaxed">
        작성한 내용은 이 브라우저에 자동 저장됩니다. 2일 이전 기록은 기본적으로 접혀 있으며,
        날짜 제목을 클릭하면 펼치거나 접을 수 있어요.
      </p>
    </div>
  );
}

function MemoPanel() {
  const [memos, setMemos] = usePersistedState("work-journal-memos", []);
  const memoRefs = useRef({});

  const sortedMemos = [...memos].sort((a, b) => b.updatedAt - a.updatedAt);

  const addMemo = () => {
    const id = Date.now();
    setMemos((prev) => [{ id, text: "", updatedAt: id }, ...prev]);
    setTimeout(() => memoRefs.current[id]?.focus(), 50);
  };

  const updateMemo = (id, text) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, updatedAt: Date.now() } : m))
    );
  };

  const deleteMemo = (id) => {
    setMemos((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 mt-5">
        <p className="text-sm text-slate-400">날짜와 상관없이 자유롭게 적는 메모예요.</p>
        <button
          onClick={addMemo}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 메모
        </button>
      </div>

      <div className="space-y-3">
        {sortedMemos.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400">
            아직 메모가 없어요. 위 버튼으로 새 메모를 시작해보세요.
          </div>
        )}

        {sortedMemos.map((memo) => (
          <div
            key={memo.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(memo.updatedAt).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button
                onClick={() => deleteMemo(memo.id)}
                className="text-slate-300 hover:text-red-500 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              ref={(el) => (memoRefs.current[memo.id] = el)}
              value={memo.text}
              onChange={(e) => updateMemo(memo.id, e.target.value)}
              placeholder="자유롭게 메모를 적어보세요."
              rows={5}
              className="w-full text-sm text-slate-700 outline-none resize-none leading-relaxed"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarPanel() {
  const [notes, setNotes] = usePersistedState("work-journal-calendar-notes", {});
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);

  const changeMonth = (delta) => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    setViewDate(d);
    setSelectedDate(todayKey());
  };

  const updateNote = (dateKey, text) => {
    setNotes((prev) => ({ ...prev, [dateKey]: text }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mt-5 mb-4">
        <p className="text-sm text-slate-400">날짜를 클릭해서 그날의 메모를 남겨요.</p>
        <button
          onClick={goToday}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 px-2"
        >
          오늘로 이동
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800">{formatMonthLabel(viewDate)}</span>
          <button
            onClick={() => changeMonth(1)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-[11px] font-medium text-slate-400 py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`blank-${idx}`} />;
            const dateKey = dateKeyOf(year, month, day);
            const weekday = (firstWeekday + day - 1) % 7;
            const holidayName = HOLIDAYS[dateKey];
            const hasNote = Boolean(notes[dateKey]?.trim());
            const isToday = dateKey === todayKey();
            const isSelected = dateKey === selectedDate;

            let dayColor = "text-slate-600";
            if (weekday === 0 || holidayName) dayColor = "text-red-500";
            else if (weekday === 6) dayColor = "text-blue-500";

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                title={holidayName || undefined}
                className={`relative h-12 rounded-lg text-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : isToday
                    ? "bg-indigo-50 font-semibold"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className={isSelected ? "text-white" : isToday ? "text-indigo-700" : dayColor}>
                  {day}
                </span>
                {holidayName && !isSelected && (
                  <span className="text-[9px] leading-none text-red-500 truncate max-w-[36px]">
                    {holidayName.split("(")[0]}
                  </span>
                )}
                {hasNote && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-indigo-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-slate-800">{formatDateShort(selectedDate)}</p>
          {HOLIDAYS[selectedDate] && (
            <span className="text-[11px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              {HOLIDAYS[selectedDate]}
            </span>
          )}
        </div>
        <textarea
          value={notes[selectedDate] || ""}
          onChange={(e) => updateNote(selectedDate, e.target.value)}
          placeholder="이 날의 메모를 적어보세요."
          rows={6}
          className="w-full text-sm text-slate-700 outline-none resize-none border border-slate-100 rounded-lg p-3 focus:border-slate-300 leading-relaxed"
        />
      </div>
    </div>
  );
}

function FavoritesPanel() {
  const [links, setLinks] = usePersistedState("work-journal-favorites", []);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const normalizeUrl = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const getDomain = (raw) => {
    try {
      return new URL(raw).hostname.replace(/^www\./, "");
    } catch {
      return raw;
    }
  };

  const addLink = () => {
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) return;
    const finalTitle = title.trim() || getDomain(finalUrl);
    setLinks((prev) => [...prev, { id: Date.now(), title: finalTitle, url: finalUrl }]);
    setTitle("");
    setUrl("");
  };

  const deleteLink = (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div>
      <p className="text-sm text-slate-400 mt-5 mb-4">자주 쓰는 사이트를 추가해두고 바로 이동해요.</p>

      <div className="bg-white border border-slate-200 rounded-lg p-3 mb-5 flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="이름 (예: 회사 그룹웨어)"
          className="flex-1 text-sm outline-none border border-slate-100 rounded-lg px-3 py-2"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLink()}
          placeholder="URL (예: notion.so)"
          className="flex-1 text-sm outline-none border border-slate-100 rounded-lg px-3 py-2"
        />
        <button
          onClick={addLink}
          className="flex items-center justify-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400">
          아직 즐겨찾기가 없어요. 위에서 링크를 추가해보세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="group relative bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors"
            >
              <button
                onClick={() => deleteLink(link.id)}
                className="absolute top-1.5 right-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-center gap-2 pt-1"
              >
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${getDomain(link.url)}&sz=64`}
                    alt=""
                    className="h-5 w-5"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 truncate w-full">
                  {link.title}
                </span>
                <span className="text-[10px] text-slate-400 truncate w-full">
                  {getDomain(link.url)}
                </span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_TABS = [
  { id: "journal", label: "업무일지" },
  { id: "memo", label: "메모장" },
  { id: "calendar", label: "캘린더" },
  { id: "favorites", label: "즐겨찾기" },
];

const MIN_WIDTH = 672; // 기존 기본 폭 (max-w-2xl 상당)
const MAX_WIDTH = Math.round(MIN_WIDTH * 1.5);

export default function WorkJournalApp() {
  const [tabs, setTabs] = usePersistedState("work-journal-tab-order", DEFAULT_TABS);
  const [width, setWidth] = usePersistedState("work-journal-width", MIN_WIDTH);
  const [activeTab, setActiveTab] = useState("journal");
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(width);

  const handleResizeStart = (e) => {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // 중앙 정렬 레이아웃이라 한쪽으로 끈 거리의 2배만큼 전체 폭이 늘어난다
      const delta = (e.clientX - resizeStartX.current) * 2;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartWidth.current + delta));
      setWidth(next);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setWidth]);

  const handleDragStart = (index) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (index, e) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index) => {
    const from = dragIndexRef.current;
    setDragOverIndex(null);
    if (from === null || from === index) return;
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      <div className="relative w-full" style={{ maxWidth: `${width}px` }}>
        <div className="px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDrop={() => handleDrop(index)}
                className={dragOverIndex === index ? "bg-slate-100 rounded-t-lg" : ""}
              >
                <TabButton active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </TabButton>
              </div>
            ))}
          </div>

          {activeTab === "journal" && <JournalPanel />}
          {activeTab === "memo" && <MemoPanel />}
          {activeTab === "calendar" && <CalendarPanel />}
          {activeTab === "favorites" && <FavoritesPanel />}
        </div>

        <div
          onMouseDown={handleResizeStart}
          title="드래그해서 폭 조절"
          className="hidden sm:flex absolute top-0 -right-3 h-full w-3 cursor-ew-resize items-center justify-center group z-10"
        >
          <div className="h-16 w-1 rounded-full bg-slate-200 group-hover:bg-slate-400 group-active:bg-slate-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}