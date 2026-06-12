// scripts/migrations/probes/probe-cf-jwt-binding/worker-src.js
var API_BASE = "https://api.entu.app";
var DB = "polyphony";
async function mintJwt(apiKey) {
  const url = `${API_BASE}/auth?db=${DB}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`auth failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  return { token: body.token, latencyMs };
}
async function useJwt(jwt) {
  const url = `${API_BASE}/${DB}/entity?_type.string=season&props=_id&limit=1`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` }
  });
  const latencyMs = Date.now() - t0;
  if (res.ok) {
    await res.json();
  } else {
    await res.text();
  }
  return { ok: res.ok, status: res.status, latencyMs };
}
var worker_src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isStale = url.searchParams.has("stale");
    let mintOk = false;
    let mintLatencyMs = null;
    let token = null;
    let mintError = null;
    if (!isStale) {
      try {
        const mint = await mintJwt(env.ENTU_API_KEY);
        token = mint.token;
        mintOk = true;
        mintLatencyMs = mint.latencyMs;
      } catch (err) {
        mintError = String(err);
      }
    } else {
      token = request.headers.get("X-Stale-Token");
      if (!token) {
        return new Response(
          JSON.stringify({ error: "stale mode requires X-Stale-Token header" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    let useOk = false;
    let useStatus = null;
    let useLatencyMs = null;
    let useError = null;
    if (token) {
      try {
        const use = await useJwt(token);
        useOk = use.ok;
        useStatus = use.status;
        useLatencyMs = use.latencyMs;
      } catch (err) {
        useError = String(err);
      }
    }
    const payload = {
      mode: isStale ? "stale" : "same-invocation",
      sameInvocation: !isStale,
      mintOk: isStale ? null : mintOk,
      mintLatencyMs,
      mintError,
      useOk,
      useStatus,
      useLatencyMs,
      useError,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  worker_src_default as default
};
