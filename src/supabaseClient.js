import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase 환경변수가 설정되지 않았어요. .env 파일(로컬) 또는 Vercel 환경변수(배포)에 " +
      "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 등록해주세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
