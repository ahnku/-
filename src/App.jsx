import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  GripVertical,
  Settings,
  Sun,
  Moon,
  Download,
  Upload,
  X,
  Phone,
  User,
  Save,
  LogOut,
  Calendar,
  Star,
  Pencil,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { AuthProvider, useAuth } from "./useAuth";
import LoginScreen from "./LoginScreen";

// 페이지를 닫는 순간에도 저장 요청이 끊기지 않도록, fetch(keepalive)로 직접 보낼 때 필요한 값
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

function useLocalState(key, defaultValue) {
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
    window.addEventListener("workjournal-force-save", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("workjournal-force-save", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [key]);

  return [state, setState];
}

function useCloudState(key, defaultValue, userId) {
  const [state, setState] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);
  const saveTimer = useRef(null);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const { data, error } = await supabase
        .from("app_data")
        .select("value")
        .eq("user_id", userId)
        .eq("key", key)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setState(data.value);
      else setState(defaultValue);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId]);

  // 다른 창/기기에서 같은 항목을 수정하면, 여기도 실시간으로 최신 내용을 받아온다.
  // (Supabase 대시보드에서 app_data 테이블의 Realtime을 켜둬야 동작한다)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`app_data_${key}_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_data",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || row.key !== key) return;
          // 방금 이 창에서 직접 저장한 내용이 그대로 되돌아온 것뿐이면(메아리),
          // 타이핑 중 커서가 끝으로 튀는 걸 막기 위해 아무것도 하지 않는다.
          const isSameAsLocal =
            JSON.stringify(row.value) === JSON.stringify(stateRef.current);
          if (isSameAsLocal) return;
          skipNextSaveRef.current = true;
          setState(row.value);
        }
      )
      .subscribe((status, err) => {
        console.log(`[realtime:${key}]`, status, err || "");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, key]);

  const save = () => {
    if (!userId) return;
    supabase
      .from("app_data")
      .upsert(
        {
          user_id: userId,
          key,
          value: stateRef.current,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      )
      .then(({ error }) => {
        if (error) console.error("저장 실패:", error);
      });
  };

  // 탭을 닫거나 새로고침하는 순간엔 일반 요청이 도중에 끊길 수 있어서,
  // 브라우저가 페이지를 닫아도 끝까지 전송을 보장하는 fetch(keepalive)로 대신 보낸다.
  const flushKeepalive = () => {
    if (!userId || !SUPABASE_URL) return;
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token) return;
      try {
        fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify([
            {
              user_id: userId,
              key,
              value: stateRef.current,
              updated_at: new Date().toISOString(),
            },
          ]),
        });
      } catch (e) {
        console.error("긴급 저장 실패:", e);
      }
    });
  };

  useEffect(() => {
    if (!loaded || !userId) return;
    // 방금 다른 창에서 받아온 내용을 그대로 되돌려 보내는 걸 막는다 (무한 루프 방지)
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 400);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded, userId, key]);

  useEffect(() => {
    const handleForceSave = () => save();
    const handleLeaving = () => flushKeepalive();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushKeepalive();
    };
    window.addEventListener("workjournal-force-save", handleForceSave);
    window.addEventListener("beforeunload", handleLeaving);
    window.addEventListener("pagehide", handleLeaving);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("workjournal-force-save", handleForceSave);
      window.removeEventListener("beforeunload", handleLeaving);
      window.removeEventListener("pagehide", handleLeaving);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  return [state, setState, loaded];
}

function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center px-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-slate-700 dark:text-slate-200 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm font-medium px-3.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="text-sm font-medium px-3.5 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
        active
          ? "border-slate-900 text-slate-900 dark:text-slate-100"
          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 cursor-grab" />
      {children}
    </button>
  );
}

function MiniCalendarPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : new Date();
    d.setDate(1);
    return d;
  });
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const openPicker = () => {
    const d = value ? new Date(value) : new Date();
    d.setDate(1);
    setViewDate(d);
    setOpen((v) => !v);
  };

  const handlePick = (dateKey) => {
    onChange(dateKey);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={openPicker}
        className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
      >
        <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
        <span className="font-medium">{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => changeMonth(-1)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {formatMonthLabel(viewDate)}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_LABELS.map((w, idx) => (
              <div
                key={w}
                className={`text-center text-[10px] font-medium py-0.5 ${
                  idx === 0
                    ? "text-red-500"
                    : idx === 6
                    ? "text-blue-500"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} />;
              const dateKey = dateKeyOf(year, month, day);
              const weekday = (firstWeekday + day - 1) % 7;
              const isSelected = dateKey === value;
              const isToday = dateKey === todayKey();
              let color = "text-slate-600 dark:text-slate-400";
              if (weekday === 0) color = "text-red-500";
              else if (weekday === 6) color = "text-blue-500";
              return (
                <button
                  key={dateKey}
                  onClick={() => handlePick(dateKey)}
                  className={`h-7 rounded text-xs flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : isToday
                      ? "bg-indigo-50 dark:bg-indigo-950 font-semibold"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className={isSelected ? "text-white" : color}>{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// entries/setEntries는 부모(WorkJournalApp)에서 클라우드 상태로 관리해서 props로 내려온다.
function JournalPanel({ focusDate, onFocusHandled, entries, setEntries }) {
  const [entryFontSize, setEntryFontSize] = useLocalState("work-journal-entry-font-size", 14);
  const [overrides, setOverrides] = useState({});
  const [lookupDate, setLookupDate] = useState(todayKey());
  const entryRefs = useRef({});
  const resizingRef = useRef({ date: null, startY: 0, startHeight: 0 });
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = useRef(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(null);
  const PAGE_SIZE = 7;
  const [page, setPage] = useState(0);

  const jumpToDate = (date, entriesList) => {
    const list = entriesList.some((e) => e.date === date)
      ? entriesList
      : [...entriesList, { date }];
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const idx = sorted.findIndex((e) => e.date === date);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
  };

  const DEFAULT_BOX_HEIGHT = 200;
  const MIN_BOX_HEIGHT = 100;
  const MAX_BOX_HEIGHT = 600;

  const getHeight = (entry) => entry.boxHeight || DEFAULT_BOX_HEIGHT;

  const updateHeight = (date, height) => {
    setEntries((prev) => prev.map((e) => (e.date === date ? { ...e, boxHeight: height } : e)));
  };

  const handleHeightDragStart = (date, currentHeight) => (e) => {
    resizingRef.current = { date, startY: e.clientY, startHeight: currentHeight };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { date, startY, startHeight } = resizingRef.current;
      if (!date) return;
      const delta = e.clientY - startY;
      const next = Math.min(MAX_BOX_HEIGHT, Math.max(MIN_BOX_HEIGHT, startHeight + delta));
      updateHeight(date, next);
    };
    const handleMouseUp = () => {
      resizingRef.current.date = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [totalPages, page]);

  const pagedEntries = sortedEntries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const isExpanded = (date) => {
    if (date in overrides) return overrides[date];
    return daysAgo(date) === 0;
  };

  const toggleExpand = (date) => {
    setOverrides((prev) => ({ ...prev, [date]: !isExpanded(date) }));
  };

  const updateText = (date, field, text) => {
    setEntries((prev) => prev.map((e) => (e.date === date ? { ...e, [field]: text } : e)));
  };

  const deleteEntry = (date) => {
    const entry = entries.find((e) => e.date === date);
    setEntries((prev) => prev.filter((e) => e.date !== date));
    if (entry) {
      setLastDeleted(entry);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 6000);
    }
  };

  const handleUndo = () => {
    if (!lastDeleted) return;
    setEntries((prev) => [...prev, lastDeleted]);
    setLastDeleted(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  useEffect(() => {
    if (!focusDate) return;
    jumpToDate(focusDate, entries);
    setEntries((prev) => {
      if (prev.some((e) => e.date === focusDate)) return prev;
      return [...prev, { date: focusDate, todayText: "", tomorrowText: "" }];
    });
    setOverrides((prev) => ({ ...prev, [focusDate]: true }));
    setTimeout(() => {
      entryRefs.current[focusDate]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDate]);

  const createNewTodayPage = () => {
    const key = todayKey();
    jumpToDate(key, entries);
    setEntries((prev) => {
      if (prev.some((e) => e.date === key)) return prev;
      return [...prev, { date: key, todayText: "", tomorrowText: "" }];
    });
    setOverrides((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      entryRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const runLookup = (dateKey) => {
    const exists = entries.some((e) => e.date === dateKey);
    jumpToDate(dateKey, entries);
    if (!exists) {
      setEntries((prev) => [...prev, { date: dateKey, todayText: "", tomorrowText: "" }]);
    }
    setOverrides((prev) => ({ ...prev, [dateKey]: true }));
    setTimeout(() => {
      entryRefs.current[dateKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleDatePick = (dateKey) => {
    setLookupDate(dateKey);
    runLookup(dateKey);
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-between mb-4 mt-5">
        <p className="text-sm text-slate-400 dark:text-slate-500">날짜별로 오늘업무와 내일업무를 기록해요.</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span>글자 크기</span>
            <button
              onClick={() => setEntryFontSize((v) => Math.max(11, v - 1))}
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              −
            </button>
            <span className="w-5 text-center tabular-nums">{entryFontSize}</span>
            <button
              onClick={() => setEntryFontSize((v) => Math.min(24, v + 1))}
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              +
            </button>
          </div>
          <button
            onClick={createNewTodayPage}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            오늘 페이지 작성
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-5">
        <MiniCalendarPicker value={lookupDate} onChange={handleDatePick} />
      </div>

      <div className="space-y-3">
        {sortedEntries.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
            아직 작성된 업무일지가 없어요. 위 버튼으로 오늘 페이지를 시작해보세요.
          </div>
        )}

        {pagedEntries.map((entry) => {
          const expanded = isExpanded(entry.date);
          const old = daysAgo(entry.date) >= 1;
          return (
            <div
              key={entry.date}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggleExpand(entry.date)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateLabel(entry.date)}
                  </span>
                  {old && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      {daysAgo(entry.date)}일 전
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setConfirmDeleteDate(entry.date)}
                    className="text-slate-300 dark:text-slate-600 hover:text-red-500 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleExpand(entry.date)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
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
                <div ref={(el) => (entryRefs.current[entry.date] = el)} className="px-4 pb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">오늘업무</span>
                      </div>
                      <textarea
                        value={entry.todayText}
                        onChange={(e) => updateText(entry.date, "todayText", e.target.value)}
                        placeholder="오늘 진행한(할) 업무를 적어보세요."
                        style={{ height: `${getHeight(entry)}px`, fontSize: `${entryFontSize}px` }}
                        className="w-full text-sm text-slate-700 dark:text-slate-300 outline-none resize-none border border-slate-100 dark:border-slate-700 rounded-lg p-3 focus:border-indigo-300 dark:focus:border-indigo-500 leading-relaxed"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">내일업무</span>
                      </div>
                      <textarea
                        value={entry.tomorrowText}
                        onChange={(e) => updateText(entry.date, "tomorrowText", e.target.value)}
                        placeholder="내일 예정된 업무를 적어보세요."
                        style={{ height: `${getHeight(entry)}px`, fontSize: `${entryFontSize}px` }}
                        className="w-full text-sm text-slate-700 dark:text-slate-300 outline-none resize-none border border-slate-100 dark:border-slate-700 rounded-lg p-3 focus:border-amber-300 dark:focus:border-amber-500 leading-relaxed"
                      />
                    </div>
                  </div>
                  <div
                    onMouseDown={handleHeightDragStart(entry.date, getHeight(entry))}
                    className="flex items-center justify-center h-3 cursor-row-resize group"
                    title="드래그해서 두 칸 높이를 함께 조절"
                  >
                    <div className="w-10 h-1 rounded-full bg-slate-200 group-hover:bg-slate-400 transition-colors" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-7 h-7 rounded-lg text-xs font-medium ${
                i === page
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        작성한 내용은 클라우드 계정에 자동 저장되어, 로그인하면 어느 기기에서든 볼 수 있어요. 오늘 기록만
        기본적으로 펼쳐져 있으며, 날짜 제목을 클릭하면 펼치거나 접을 수 있어요.
      </p>

      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>업무일지를 삭제했어요</span>
          <button
            onClick={handleUndo}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            실행취소
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteDate !== null}
        message="이 날의 업무일지를 삭제하시겠어요?"
        onCancel={() => setConfirmDeleteDate(null)}
        onConfirm={() => {
          deleteEntry(confirmDeleteDate);
          setConfirmDeleteDate(null);
        }}
      />
    </div>
  );
}

// memos/setMemos도 부모에서 클라우드 상태로 관리해서 props로 내려온다.
function MemoPanel({ focusMemoId, onFocusHandled, memos, setMemos }) {
  const memoRefs = useRef({});
  const resizingRef = useRef({ id: null, startY: 0, startHeight: 0 });
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = useRef(null);
  const [collapsed, setCollapsed] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const isCollapsed = (id) => Boolean(collapsed[id]);
  const toggleCollapse = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const DEFAULT_MEMO_HEIGHT = 160;
  const MIN_MEMO_HEIGHT = 80;
  const MAX_MEMO_HEIGHT = 600;

  const sortedMemos = [...memos].sort((a, b) => b.updatedAt - a.updatedAt);

  const getHeight = (memo) => memo.boxHeight || DEFAULT_MEMO_HEIGHT;

  const updateHeight = (id, height) => {
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, boxHeight: height } : m)));
  };

  const handleHeightDragStart = (id, currentHeight) => (e) => {
    resizingRef.current = { id, startY: e.clientY, startHeight: currentHeight };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { id, startY, startHeight } = resizingRef.current;
      if (!id) return;
      const delta = e.clientY - startY;
      const next = Math.min(MAX_MEMO_HEIGHT, Math.max(MIN_MEMO_HEIGHT, startHeight + delta));
      updateHeight(id, next);
    };
    const handleMouseUp = () => {
      resizingRef.current.id = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const addMemo = () => {
    const id = Date.now();
    setMemos((prev) => [{ id, text: "", updatedAt: id, boxHeight: DEFAULT_MEMO_HEIGHT }, ...prev]);
    setTimeout(() => memoRefs.current[id]?.focus(), 50);
  };

  const updateMemo = (id, text) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, updatedAt: Date.now() } : m))
    );
  };

  const deleteMemo = (id) => {
    const memo = memos.find((m) => m.id === id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
    if (memo) {
      setLastDeleted(memo);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 6000);
    }
  };

  const handleUndo = () => {
    if (!lastDeleted) return;
    setMemos((prev) => [lastDeleted, ...prev]);
    setLastDeleted(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  useEffect(() => {
    if (!focusMemoId) return;
    setCollapsed((prev) => ({ ...prev, [focusMemoId]: false }));
    setTimeout(() => {
      memoRefs.current[focusMemoId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      memoRefs.current[focusMemoId]?.focus();
    }, 100);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemoId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 mt-5">
        <p className="text-sm text-slate-400 dark:text-slate-500">날짜와 상관없이 자유롭게 적는 메모예요.</p>
        <button
          onClick={addMemo}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 메모
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {sortedMemos.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
            아직 메모가 없어요. 위 버튼으로 새 메모를 시작해보세요.
          </div>
        )}

        {sortedMemos.map((memo) => {
          const collapsedNow = isCollapsed(memo.id);
          return (
          <div
            key={memo.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                {collapsedNow && memo.text
                  ? memo.text.slice(0, 24)
                  : new Date(memo.updatedAt).toLocaleString("ko-KR", {
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setConfirmDeleteId(memo.id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleCollapse(memo.id)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
                  title={collapsedNow ? "펼치기" : "숨기기"}
                >
                  {collapsedNow ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {!collapsedNow && (
              <>
                <textarea
                  ref={(el) => (memoRefs.current[memo.id] = el)}
                  value={memo.text}
                  onChange={(e) => updateMemo(memo.id, e.target.value)}
                  placeholder="자유롭게 메모를 적어보세요."
                  style={{ height: `${getHeight(memo)}px` }}
                  className="w-full text-sm text-slate-700 dark:text-slate-300 outline-none resize-none leading-relaxed"
                />
                <div
                  onMouseDown={handleHeightDragStart(memo.id, getHeight(memo))}
                  className="flex items-center justify-center h-3 cursor-row-resize group -mb-1"
                  title="드래그해서 높이 조절"
                >
                  <div className="w-10 h-1 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-slate-300 transition-colors" />
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>

      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>메모를 삭제했어요</span>
          <button
            onClick={handleUndo}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            실행취소
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message="이 메모를 삭제하시겠어요?"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          deleteMemo(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}

// userId를 받아서 캘린더 메모를 사용자별 클라우드 상태로 관리한다.
function CalendarPanel({ userId }) {
  const [notes, setNotes] = useCloudState("work-journal-calendar-notes", {}, userId);
  const [noteHeights, setNoteHeights] = useLocalState("work-journal-calendar-note-heights", {});
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const resizingRef = useRef({ date: null, startY: 0, startHeight: 0 });

  const DEFAULT_NOTE_HEIGHT = 160;
  const MIN_NOTE_HEIGHT = 100;
  const MAX_NOTE_HEIGHT = 600;

  const getNoteHeight = (dateKey) => noteHeights[dateKey] || DEFAULT_NOTE_HEIGHT;

  const updateNoteHeight = (dateKey, height) => {
    setNoteHeights((prev) => ({ ...prev, [dateKey]: height }));
  };

  const handleHeightDragStart = (dateKey, currentHeight) => (e) => {
    resizingRef.current = { date: dateKey, startY: e.clientY, startHeight: currentHeight };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { date, startY, startHeight } = resizingRef.current;
      if (!date) return;
      const delta = e.clientY - startY;
      const next = Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, startHeight + delta));
      updateNoteHeight(date, next);
    };
    const handleMouseUp = () => {
      resizingRef.current.date = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

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
        <p className="text-sm text-slate-400 dark:text-slate-500">날짜를 클릭해서 그날의 메모를 남겨요.</p>
        <button
          onClick={goToday}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2"
        >
          오늘로 이동
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatMonthLabel(viewDate)}</span>
          <button
            onClick={() => changeMonth(1)}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((w, idx) => (
            <div
              key={w}
              className={`text-center text-[11px] font-medium py-1 ${
                idx === 0
                  ? "text-red-500"
                  : idx === 6
                  ? "text-blue-500"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
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

            let dayColor = "text-slate-600 dark:text-slate-400";
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
                    ? "bg-indigo-50 dark:bg-indigo-950 font-semibold"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <span className={isSelected ? "text-white" : isToday ? "text-indigo-700 dark:text-indigo-300" : dayColor}>
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
                      isSelected ? "bg-white dark:bg-slate-800" : "bg-indigo-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDateShort(selectedDate)}</p>
          {HOLIDAYS[selectedDate] && (
            <span className="text-[11px] font-medium text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
              {HOLIDAYS[selectedDate]}
            </span>
          )}
        </div>
        <textarea
          value={notes[selectedDate] || ""}
          onChange={(e) => updateNote(selectedDate, e.target.value)}
          placeholder="이 날의 메모를 적어보세요."
          style={{ height: `${getNoteHeight(selectedDate)}px` }}
          className="w-full text-sm text-slate-700 dark:text-slate-300 outline-none resize-none border border-slate-100 dark:border-slate-700 rounded-lg p-3 focus:border-slate-300 dark:focus:border-slate-500 leading-relaxed"
        />
        <div
          onMouseDown={handleHeightDragStart(selectedDate, getNoteHeight(selectedDate))}
          className="flex items-center justify-center h-3 cursor-row-resize group"
          title="드래그해서 높이 조절"
        >
          <div className="w-10 h-1 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-slate-300 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// userId를 받아서 즐겨찾기를 사용자별 클라우드 상태로 관리한다.
function FavoritesPanel({ userId }) {
  const [links, setLinks] = useCloudState("work-journal-favorites", [], userId);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const iconInputRef = useRef(null);

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

  const handleIconSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setPendingIcon(canvas.toDataURL("image/png"));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const addLink = () => {
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) return;
    const finalTitle = title.trim() || getDomain(finalUrl);
    setLinks((prev) => [
      ...prev,
      { id: Date.now(), title: finalTitle, url: finalUrl, customIcon: pendingIcon || null },
    ]);
    setTitle("");
    setUrl("");
    setPendingIcon(null);
  };

  const deleteLink = (id) => {
    const link = links.find((l) => l.id === id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
    if (link) {
      setLastDeleted(link);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 6000);
    }
  };

  const handleUndo = () => {
    if (!lastDeleted) return;
    setLinks((prev) => [...prev, lastDeleted]);
    setLastDeleted(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const togglePin = (id) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, pinned: !l.pinned } : l))
    );
  };

  const sortedLinks = [...links].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-5 mb-4">자주 쓰는 사이트를 추가해두고 바로 이동해요.</p>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-5 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => iconInputRef.current?.click()}
          title="아이콘 이미지 선택"
          className="shrink-0 h-9 w-9 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden self-center sm:self-auto"
        >
          {pendingIcon ? (
            <img src={pendingIcon} alt="" className="h-full w-full object-cover" />
          ) : (
            <Plus className="h-4 w-4 text-slate-300 dark:text-slate-600" />
          )}
        </button>
        <input
          ref={iconInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleIconSelect}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="이름 (예: 회사 그룹웨어)"
          className="flex-1 text-sm outline-none border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLink()}
          placeholder="URL (예: notion.so)"
          className="flex-1 text-sm outline-none border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2"
        />
        <button
          onClick={addLink}
          className="flex items-center justify-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
          아직 즐겨찾기가 없어요. 위에서 링크를 추가해보세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sortedLinks.map((link) => (
            <div
              key={link.id}
              className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:border-slate-300 transition-colors"
            >
              <button
                onClick={() => togglePin(link.id)}
                title={link.pinned ? "고정 해제" : "상단 고정"}
                className="absolute top-1.5 right-1.5 p-1"
              >
                <Star
                  className={`h-3.5 w-3.5 transition-colors ${
                    link.pinned
                      ? "fill-amber-400 text-amber-400"
                      : "fill-none text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
              <button
                onClick={() => setConfirmDeleteId(link.id)}
                className="absolute top-1.5 right-7 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-center gap-2 pt-1"
              >
                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                  {link.customIcon ? (
                    <img src={link.customIcon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${getDomain(link.url)}&sz=64`}
                      alt=""
                      className="h-5 w-5"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-full">
                  {link.title}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                  {getDomain(link.url)}
                </span>
              </a>
            </div>
          ))}
        </div>
      )}

      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>즐겨찾기를 삭제했어요</span>
          <button
            onClick={handleUndo}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            실행취소
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message="이 즐겨찾기를 삭제하시겠어요?"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          deleteLink(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}

// 클라우드(Supabase)에 저장되는 데이터 키 목록. 내보내기/가져오기 대상이다.
const CLOUD_KEYS = [
  "work-journal-entries",
  "work-journal-memos",
  "work-journal-calendar-notes",
  "work-journal-favorites",
  "work-journal-contacts",
];

// userId를 받아서 연락처를 사용자별 클라우드 상태로 관리한다.
function PhonebookPanel({ userId }) {
  const [contacts, setContacts] = useCloudState("work-journal-contacts", [], userId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState("");
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const existingCategories = useMemo(() => {
    const set = new Set(contacts.map((c) => c.category || "기타"));
    return Array.from(set);
  }, [contacts]);

  const addContact = () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return;
    setContacts((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: trimmedName,
        phone: trimmedPhone,
        category: category.trim() || "기타",
      },
    ]);
    setName("");
    setPhone("");
    setCategory("");
  };

  const deleteContact = (id) => {
    const contact = contacts.find((c) => c.id === id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (contact) {
      setLastDeleted(contact);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 6000);
    }
  };

  const handleUndo = () => {
    if (!lastDeleted) return;
    setContacts((prev) => [...prev, lastDeleted]);
    setLastDeleted(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const startEdit = (contact) => {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditPhone(contact.phone || "");
    setEditCategory(contact.category || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === editingId
          ? {
              ...c,
              name: trimmedName,
              phone: editPhone.trim(),
              category: editCategory.trim() || "기타",
            }
          : c
      )
    );
    setEditingId(null);
  };

  const filteredContacts = contacts.filter((c) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.category || "").toLowerCase().includes(q)
    );
  });

  const grouped = useMemo(() => {
    const map = {};
    filteredContacts.forEach((c) => {
      const key = c.category || "기타";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name, "ko"))
    );
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b, "ko"))
      .map((key) => ({ category: key, list: map[key] }));
  }, [filteredContacts]);

  return (
    <div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-5 mb-4">
        연락처를 카테고리별로 정리해두고 한눈에 찾아보세요.
      </p>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addContact()}
          placeholder="이름"
          className="flex-1 text-sm outline-none border border-slate-100 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addContact()}
          placeholder="전화번호"
          className="flex-1 text-sm outline-none border border-slate-100 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addContact()}
          placeholder="카테고리 (예: 회사)"
          list="phonebook-categories"
          className="flex-1 text-sm outline-none border border-slate-100 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-3 py-2"
        />
        <datalist id="phonebook-categories">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          onClick={addContact}
          className="flex items-center justify-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-5">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="이름, 번호, 카테고리로 찾기"
            className="flex-1 text-sm outline-none bg-transparent text-slate-700 dark:text-slate-200"
          />
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
          아직 등록된 연락처가 없어요. 위에서 추가해보세요.
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
          검색 결과가 없어요.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ category: cat, list }) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {cat}
                </span>
                <span className="text-[11px] text-slate-300 dark:text-slate-600">
                  {list.length}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {list.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between gap-2 px-4 py-2.5 ${
                      idx !== 0 ? "border-t border-slate-100 dark:border-slate-700" : ""
                    }`}
                  >
                    {editingId === c.id ? (
                      <>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            placeholder="이름"
                            autoFocus
                            className="text-sm outline-none border border-slate-200 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1"
                          />
                          <input
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            placeholder="전화번호"
                            className="text-sm outline-none border border-slate-200 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1"
                          />
                          <input
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            placeholder="카테고리"
                            className="text-sm outline-none border border-slate-200 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={saveEdit}
                            className="text-xs font-medium text-indigo-500 hover:text-indigo-600 px-2 py-1"
                          >
                            저장
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {c.name}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                              {c.phone || "번호 없음"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(c)}
                            title="수정"
                            className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5"
                              title="전화 걸기"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setConfirmDeleteId(c.id)}
                            className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1.5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>연락처를 삭제했어요</span>
          <button
            onClick={handleUndo}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            실행취소
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message="이 연락처를 삭제하시겠어요?"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          deleteContact(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}

const DEFAULT_TABS = [
  { id: "journal", label: "업무일지" },
  { id: "memo", label: "메모장" },
  { id: "calendar", label: "캘린더" },
  { id: "favorites", label: "즐겨찾기" },
  { id: "phonebook", label: "전화번호부" },
];

const MIN_WIDTH = 1040;
const MAX_WIDTH = Math.round(MIN_WIDTH * 1.5);

function WorkJournalApp({ userId, userEmail, onSignOut }) {
  const [tabs, setTabs] = useLocalState("work-journal-tab-order", DEFAULT_TABS);
  const [width, setWidth] = useLocalState("work-journal-width", MIN_WIDTH);
  const [darkMode, setDarkMode] = useLocalState("work-journal-dark-mode", false);
  const [fontScale, setFontScale] = useLocalState("work-journal-font-scale", 100);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFocusDate, setPendingFocusDate] = useState(null);
  const [pendingFocusMemoId, setPendingFocusMemoId] = useState(null);
  const fileInputRef = useRef(null);
  const [saveToast, setSaveToast] = useState(false);
  const saveToastTimerRef = useRef(null);

  // 업무일지/메모는 검색에서 함께 써야 해서 여기(최상위)에서 클라우드 상태로 관리하고 자식에게 내려준다.
  const [entries, setEntries] = useCloudState("work-journal-entries", [], userId);
  const [memos, setMemos] = useCloudState("work-journal-memos", [], userId);

  const triggerManualSave = () => {
    window.dispatchEvent(new Event("workjournal-force-save"));
    setSaveToast(true);
    if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
    saveToastTimerRef.current = setTimeout(() => setSaveToast(false), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isSaveShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSaveShortcut) {
        e.preventDefault();
        triggerManualSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { journal: [], memo: [] };
    const journal = entries
      .filter(
        (e) =>
          (e.todayText || "").toLowerCase().includes(q) ||
          (e.tomorrowText || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const memo = memos
      .filter((m) => (m.text || "").toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { journal, memo };
  }, [searchQuery, entries, memos]);

  const openJournalResult = (date) => {
    setActiveTab("journal");
    setPendingFocusDate(date);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const openMemoResult = (id) => {
    setActiveTab("memo");
    setPendingFocusMemoId(id);
    setSearchOpen(false);
    setSearchQuery("");
  };

  // 클라우드(Supabase)에 저장된 이 계정의 데이터를 모두 불러와서 파일로 내려받는다.
  const handleExport = async () => {
    const data = {};
    const { data: rows, error } = await supabase
      .from("app_data")
      .select("key, value")
      .eq("user_id", userId)
      .in("key", CLOUD_KEYS);
    if (error) {
      alert("내보내기에 실패했어요: " + error.message);
      return;
    }
    (rows || []).forEach((row) => {
      data[row.key] = row.value;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-journal-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSettingsOpen(false);
  };

  // 백업 파일을 클라우드(Supabase)에 다시 업로드한다. 완료되면 페이지를 새로고침해서 최신 상태를 반영한다.
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const rowsToUpsert = CLOUD_KEYS.filter((key) => data[key] !== undefined).map((key) => ({
          user_id: userId,
          key,
          value: data[key],
          updated_at: new Date().toISOString(),
        }));
        if (rowsToUpsert.length === 0) {
          alert("올바른 백업 파일이 아니에요.");
          return;
        }
        const { error } = await supabase
          .from("app_data")
          .upsert(rowsToUpsert, { onConflict: "user_id,key" });
        if (error) throw error;
        alert("데이터를 불러왔어요. 페이지를 새로고침할게요.");
        window.location.reload();
      } catch (err) {
        alert("가져오기에 실패했어요: " + (err.message || "알 수 없는 오류"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    setTabs((prev) => {
      const missing = DEFAULT_TABS.filter((dt) => !prev.some((t) => t.id === dt.id));
      if (missing.length === 0) return prev;
      return [...prev, ...missing];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (width < MIN_WIDTH) setWidth(MIN_WIDTH);
    else if (width > MAX_WIDTH) setWidth(MAX_WIDTH);
  }, [width, setWidth]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [fontScale]);
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
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex justify-center">
        <div className="relative w-full" style={{ maxWidth: `${width}px` }}>
          <div className="px-4 sm:px-6 py-8 sm:py-12">
            <div className="flex items-center justify-between mb-2">
              <div />
              <div className="flex items-center gap-1">
                <button
                  onClick={triggerManualSave}
                  title="저장 (Ctrl+S)"
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:text-slate-200"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSearchOpen(true)}
                  title="검색"
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:text-slate-200"
                >
                  <Search className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setSettingsOpen((v) => !v)}
                    title="설정"
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:text-slate-200"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  {settingsOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
                      <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 truncate border-b border-slate-100 dark:border-slate-700 mb-1">
                        {userEmail}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                        <span>글자 크기</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setFontScale((v) => Math.max(80, v - 10))}
                            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            −
                          </button>
                          <span className="w-9 text-center text-xs text-slate-400 tabular-nums">
                            {fontScale}%
                          </span>
                          <button
                            onClick={() => setFontScale((v) => Math.min(150, v + 10))}
                            className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                      <button
                        onClick={() => setDarkMode((v) => !v)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {darkMode ? "라이트 모드" : "다크 모드"}
                      </button>
                      <button
                        onClick={handleExport}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Download className="h-4 w-4" />
                        데이터 내보내기
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Upload className="h-4 w-4" />
                        데이터 가져오기
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleImportFile}
                      />
                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                      <button
                        onClick={onSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <LogOut className="h-4 w-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDrop={() => handleDrop(index)}
                className={dragOverIndex === index ? "bg-slate-100 dark:bg-slate-700 rounded-t-lg" : ""}
              >
                <TabButton active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </TabButton>
              </div>
            ))}
          </div>

          {activeTab === "journal" && (
            <JournalPanel
              focusDate={pendingFocusDate}
              onFocusHandled={() => setPendingFocusDate(null)}
              entries={entries}
              setEntries={setEntries}
            />
          )}
          {activeTab === "memo" && (
            <MemoPanel
              focusMemoId={pendingFocusMemoId}
              onFocusHandled={() => setPendingFocusMemoId(null)}
              memos={memos}
              setMemos={setMemos}
            />
          )}
          {activeTab === "calendar" && <CalendarPanel userId={userId} />}
          {activeTab === "favorites" && <FavoritesPanel userId={userId} />}
          {activeTab === "phonebook" && <PhonebookPanel userId={userId} />}
          </div>

          <div
            onMouseDown={handleResizeStart}
            title="드래그해서 폭 조절"
            className="hidden sm:flex absolute top-0 -right-3 h-full w-3 cursor-ew-resize items-center justify-center group z-10"
          >
            <div className="h-16 w-1 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-500 group-active:bg-slate-500 transition-colors" />
          </div>
        </div>
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-start justify-center pt-24 px-4 z-50"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="업무일지, 메모 검색..."
                className="flex-1 text-sm outline-none bg-transparent text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.trim() === "" && (
                <p className="text-sm text-slate-400 dark:text-slate-500 px-4 py-6 text-center">검색어를 입력하세요.</p>
              )}
              {searchQuery.trim() !== "" &&
                searchResults.journal.length === 0 &&
                searchResults.memo.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 px-4 py-6 text-center">
                    검색 결과가 없어요.
                  </p>
                )}
              {searchResults.journal.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 dark:text-slate-500">업무일지</div>
              )}
              {searchResults.journal.map((entry) => (
                <button
                  key={entry.date}
                  onClick={() => openJournalResult(entry.date)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {formatDateLabel(entry.date)}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {(entry.todayText || entry.tomorrowText || "").slice(0, 60)}
                  </div>
                </button>
              ))}
              {searchResults.memo.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 dark:text-slate-500">메모장</div>
              )}
              {searchResults.memo.map((memo) => (
                <button
                  key={memo.id}
                  onClick={() => openMemoResult(memo.id)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{memo.text.slice(0, 80)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {saveToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          저장했어요
        </div>
      )}
    </div>
  );
}

// 로그인 상태에 따라 로그인 화면 또는 실제 앱을 보여준다.
function AuthGate() {
  const { session, user, signOut } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <WorkJournalApp userId={user.id} userEmail={user.email} onSignOut={signOut} />;
}

// 최종적으로 내보내는 컴포넌트. AuthProvider로 감싸서 로그인 상태를 앱 전체에 전달한다.
export default function WorkJournalRoot() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}