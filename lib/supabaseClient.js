import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Debugging logs
console.log("Supabase URL:", supabaseUrl || "❌ Not Loaded");
console.log("Supabase Key:", supabaseKey ? "✅ Loaded" : "❌ Missing");

export const supabase = createClient(supabaseUrl, supabaseKey);
