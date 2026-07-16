import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("가입 확인 이메일을 보냈어요. 메일함을 확인한 뒤 로그인해주세요.");
      }
    } catch (err) {
      setError(err.message || "오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-800 mb-1">업무일지</h1>
        <p className="text-sm text-slate-400 mb-5">
          {mode === "signin" ? "로그인해서 계속하기" : "새 계정 만들기"}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          autoComplete="email"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-2 outline-none focus:border-indigo-400"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 outline-none focus:border-indigo-400"
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        {message && <p className="text-xs text-emerald-600 mb-3">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setMessage("");
          }}
          className="w-full text-xs text-slate-400 mt-3 hover:text-slate-600"
        >
          {mode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </form>
    </div>
  );
}
