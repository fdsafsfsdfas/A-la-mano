const SUPABASE_URL = "https://hmnyqtuvtlwxnsruhyyl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vQvNYM81Pra-ALHu5kd5FA_PhcSyaMi";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);