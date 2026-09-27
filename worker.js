/**
 * Cloudflare Worker: TradingView Scanner CORS Proxy
 *
 * Deploy:
 *   wrangler deploy worker.js
 *
 * After deployment, copy the Worker URL into index.html:
 *   const CLOUDFLARE_WORKER_URL = "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev";
 */

const TRADINGVIEW_URL = "https://scanner.tradingview.com/india/scan";

const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(),
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return json(
        { error: "Method not allowed. Use POST." },
        405
      );
    }

    try {
      const body = await request.text();

      // Basic validation so the Worker only proxies scanner requests.
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      if (!parsed || !parsed.symbols || !Array.isArray(parsed.columns)) {
        return json({ error: "Invalid TradingView scanner payload." }, 400);
      }

      const tvResponse = await fetch(TRADINGVIEW_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Origin": "https://www.tradingview.com",
          "Referer": "https://www.tradingview.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        },
        body,
      });

      const responseText = await tvResponse.text();

      return new Response(responseText, {
        status: tvResponse.status,
        headers: corsHeaders(),
      });
    } catch (error) {
      return json(
        {
          error: "Unable to reach TradingView.",
          details: error instanceof Error ? error.message : String(error),
        },
        502
      );
    }
  },
};
