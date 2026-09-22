import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const schema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["income", "expense"] },
    amount: { type: ["integer", "null"] },
    category: { type: "string" },
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD jika jelas" },
    description: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["type","amount","category","merchant","date","description","confidence","reason"]
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY belum dipasang.");

    const body = await req.json();
    const message = String(body?.message || "").trim();
    const scope = body?.scope === "business" ? "business" : "personal";
    if (!message || message.length > 4000) {
      return new Response(JSON.stringify({ error: "Pesan kosong atau terlalu panjang." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `Anda adalah JFS AI Bookkeeper untuk Keuangan Pintar.
Ubah cerita pengguna menjadi SATU transaksi keuangan terstruktur.
Scope saat ini: ${scope === "business" ? "bisnis" : "personal"}.

Aturan:
1. type income jika uang masuk/diperoleh; expense jika uang keluar/dibayar.
2. amount adalah nominal transaksi yang dimaksud pengguna dalam rupiah sebagai integer.
3. Jangan mengarang nominal. Jika tidak jelas, amount=null dan confidence rendah.
4. date gunakan YYYY-MM-DD bila jelas. Kata "hari ini" berarti tanggal server saat ini; jika tidak dapat dipastikan, null.
5. category harus singkat dan relevan. Untuk bisnis gunakan kategori seperti Penjualan / Usaha, Stok Bahan Mentah, Tagihan & Utilitas, Servis & Perbaikan, Belanja Keperluan Rumah Bulanan, Lain-lain.
6. merchant adalah pihak/toko/pelanggan yang disebut, jika ada.
7. description adalah ringkasan natural yang siap masuk pembukuan.
8. confidence 0..1. Jangan menebak fakta penting.
9. Jangan membuat transaksi kedua. Jika pengguna hanya bertanya tanpa transaksi, amount=null dan confidence rendah.
10. reason singkat menjelaskan interpretasi.

Cerita pengguna:
${message}`;

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema }
        })
      }
    );

    const raw = await resp.text();
    if (!resp.ok) return new Response(JSON.stringify({ error: "JFS AI gagal memproses cerita.", detail: raw.slice(0, 1000) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const data = JSON.parse(raw);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    if (!text) throw new Error("AI tidak mengembalikan hasil.");
    const result = JSON.parse(text);

    result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
    if (result.amount != null) {
      result.amount = Math.round(Number(result.amount));
      if (!Number.isFinite(result.amount) || result.amount <= 0) result.amount = null;
    }
    if (result.date && !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) result.date = null;

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});