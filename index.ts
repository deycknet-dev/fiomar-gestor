// Supabase Edge Function: consulta-placa
// Recebe { placa } do app, consulta o serviço de placas contratado e devolve { veiculo }.
// A chave do serviço fica em "secrets" do Supabase e nunca vai para o GitHub.
//
// Secrets (supabase secrets set ...):
//   PLACA_API_URL   endereço da consulta; use {placa} e, se precisar, {token}
//                   ex.: https://api.exemplo.com/veiculo?placa={placa}&token={token}
//   PLACA_API_TOKEN chave/token do serviço
//   PLACA_API_AUTH  (opcional) cabeçalho de autenticação, ex.: Authorization: Bearer {token}
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// procura o primeiro valor de um campo, em qualquer nível do JSON, aceitando vários nomes
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
function find(obj: any, names: string[]): string {
  const want = names.map(norm);
  const walk = (o: any): string => {
    if (!o || typeof o !== "object") return "";
    for (const [k, v] of Object.entries(o)) {
      if (want.includes(norm(k)) && v != null && typeof v !== "object" && String(v).trim() !== "") return String(v).trim();
    }
    for (const v of Object.values(o)) { const r = walk(v); if (r) return r; }
    return "";
  };
  return walk(obj);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // só quem está logado E liberado no app (wab_members) pode consultar
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) return json({ error: "Faça login novamente." }, 401);
    const { data: m } = await sb.from("wab_members").select("email").eq("email", user.email.toLowerCase()).maybeSingle();
    if (!m) return json({ error: "Conta sem acesso liberado." }, 403);

    const { placa } = await req.json();
    const p = String(placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p)) return json({ error: "Placa inválida." }, 400);

    const tpl = Deno.env.get("PLACA_API_URL"), token = Deno.env.get("PLACA_API_TOKEN") ?? "";
    if (!tpl) return json({ error: "Serviço de placas não configurado." }, 501);
    const url = tpl.replace("{placa}", p).replace("{token}", encodeURIComponent(token));
    const headers: Record<string, string> = { Accept: "application/json" };
    const auth = Deno.env.get("PLACA_API_AUTH");
    if (auth?.includes(":")) { const i = auth.indexOf(":"); headers[auth.slice(0, i).trim()] = auth.slice(i + 1).replace("{token}", token).trim(); }

    const r = await fetch(url, { headers });
    if (r.status === 404) return json({ veiculo: null });
    if (!r.ok) return json({ error: "O serviço de placas não respondeu (" + r.status + ")." }, 502);
    const raw = await r.json();

    const veiculo = {
      marca: find(raw, ["marca", "brand", "make"]),
      modelo: find(raw, ["modelo", "model", "marcaModelo"]),
      anoModelo: find(raw, ["anoModelo", "ano_modelo", "modelYear"]),
      anoFabricacao: find(raw, ["anoFabricacao", "ano_fabricacao", "ano", "year"]),
      cor: find(raw, ["cor", "color"]),
      combustivel: find(raw, ["combustivel", "fuel"]),
      cilindrada: find(raw, ["cilindrada", "cilindradas", "displacement"]),
      chassi: find(raw, ["chassi", "chassis"]),
      uf: find(raw, ["uf", "estado"]),
      municipio: find(raw, ["municipio", "cidade"]),
    };
    if (!veiculo.marca && !veiculo.modelo) return json({ veiculo: null });
    return json({ veiculo });
  } catch (e) {
    return json({ error: "Erro ao consultar a placa." }, 500);
  }
});
