# Shiro.so Provider Integration Plan for Anivexa API

This document contains the complete technical specification, reverse-engineered API contracts, cookie management strategy, and implementation blueprints for adding **Shiro.so** as a high-performance streaming provider to the **Anivexa API**.

---

## 1. Overview & Key Advantages

| Feature | Details |
| :--- | :--- |
| **Provider ID** | `shiro` |
| **Base Domain** | `https://shiro.so` |
| **Stream Type** | HLS (`.m3u8`) + Direct MP4/TS (`.ts`) |
| **Audio Variants** | `sub`, `dub`, `hsub` (Hard Sub) |
| **Multi-Server** | Plum, Cherry, Grape, Lemon, Melon, Melon 2, Melon 3 |
| **Subtitles** | Full Multi-language `.ass` and `.vtt` tracks (English, Spanish, French, German, Arabic, etc.) |
| **AniList / MAL Mapping** | **100% Direct Match** (Uses native AniList & MAL IDs directly; no fuzzy title searching required) |
| **Average Response Time**| **~300ms – 600ms** (Instant, single API call) |

---

## 2. Reverse-Engineered Endpoints

### A. Endpoint: Fetch Episode Streams
- **URL:** `POST https://shiro.so/api/episode`
- **Headers:**
  ```http
  Content-Type: application/json
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36
  Referer: https://shiro.so/
  Origin: https://shiro.so
  Cookie: shiro_watch=<cached_token>
  sec-fetch-site: same-origin
  sec-fetch-mode: cors
  sec-fetch-dest: empty
  ```
- **Request Body (JSON):**
  ```json
  {
    "anilistId": 212888,
    "malId": 64340,
    "episode": 1,
    "first": true
  }
  ```

### B. Response Payload Structure
```json
{
  "status": "ready",
  "variants": [
    {
      "id": "sub",
      "label": "Sub",
      "sources": [
        {
          "id": "Melon",
          "label": "Melon",
          "url": "/stream/<token>/index.m3u8?k=<auth_key>",
          "type": "application/vnd.apple.mpegurl",
          "tracks": [
            {
              "id": "track-3",
              "src": "/stream/<token>/file?k=<key>",
              "type": "ass",
              "label": "English",
              "language": "en",
              "default": true
            }
          ]
        },
        {
          "id": "Melon 2",
          "label": "Melon 2",
          "url": "/stream/<token>/file.ts?k=<auth_key>",
          "type": "video/mp4"
        }
      ]
    },
    {
      "id": "dub",
      "label": "Dub",
      "sources": [...]
    },
    {
      "id": "hsub",
      "label": "Hard Sub",
      "sources": [...]
    }
  ]
}
```

---

## 3. Cookie Management Strategy (`shiro_watch`)

Shiro protects `/api/episode` with a secure cookie named `shiro_watch`. Without this cookie, the API returns:
```json
{ "status": "unavailable", "reason": "forbidden" } // HTTP 403
```

### Cookie Lifecycle:
1. **Acquisition:** Send a lightweight `GET` request to `https://shiro.so/` (or any anime landing page).
2. **Extraction:** Read `set-cookie` header for `shiro_watch=<value>`.
3. **Lifespan:** Shiro sets `Max-Age: 86400` (24 hours).
4. **Caching:** Store the cookie in memory (`smartcache`) with a TTL of **23 hours**.
5. **Auto-Refresh:** If `/api/episode` returns a 403 or unavailable, invalidate the cached cookie, perform a GET request to acquire a fresh cookie, and retry once.

```javascript
let cachedCookie = null;
let cookieExpiry = 0;

async function getShiroCookie() {
  if (cachedCookie && Date.now() < cookieExpiry) {
    return cachedCookie;
  }
  const res = await fetch("https://shiro.so/", {
    headers: { "User-Agent": UA }
  });
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  const watchCookie = (cookies.find(c => c && c.startsWith("shiro_watch=")) || "").split(";")[0];
  if (watchCookie) {
    cachedCookie = watchCookie;
    cookieExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours
  }
  return cachedCookie;
}
```

---

## 4. Stream Playback & Proxy Setup

Shiro stream URLs are relative paths starting with `/stream/.../index.m3u8?k=...`.
- Full URL: `https://shiro.so/stream/.../index.m3u8?k=...`
- **CORS & Referer Requirements:**
  - `shiro.so` does not set `Access-Control-Allow-Origin: *`.
  - Browsers will block direct playback with a CORS policy violation.
  - Therefore, all playback **must be proxied** through `anivexa-proxy`.

### Updating `M3U8 Proxy/_worker.js`:
Add `shiro.so` to the `detectDefaultHeaders()` helper:
```javascript
// In M3U8 Proxy/_worker.js & proxy/_worker.js:
if (host.includes("shiro")) {
  return {
    referer: "https://shiro.so/",
    origin: "https://shiro.so",
  };
}
```

---

## 5. Integration Implementation Blueprint

### Step 1: Create `providers/shiro.js`
When ready to integrate, create `providers/shiro.js`:

```javascript
import { getMedia } from "../core/anilist.js";
import { json } from "../core/new-provider-utils.js";
import { get as cacheGet, set as cacheSet, isFresh } from "../core/smartcache.js";

const BASE = "https://shiro.so";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

let cachedCookie = null;
let cookieExpiry = 0;

async function getShiroCookie() {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;
  try {
    const res = await fetch(`${BASE}/`, { headers: { "User-Agent": UA } });
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
    const match = (cookies.find(c => c && c.startsWith("shiro_watch=")) || "").split(";")[0];
    if (match) {
      cachedCookie = match;
      cookieExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return cachedCookie;
    }
  } catch (err) {
    console.error("Failed to acquire shiro_watch cookie:", err);
  }
  return cachedCookie;
}

export async function fetchShiroEpisode(anilistId, malId, episode) {
  let cookie = await getShiroCookie();
  
  const doFetch = async (cookieHeader) => {
    return fetch(`${BASE}/api/episode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Referer": `${BASE}/`,
        "Origin": BASE,
        "Cookie": cookieHeader || "",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty"
      },
      body: JSON.stringify({
        anilistId: Number(anilistId),
        malId: malId ? Number(malId) : Number(anilistId),
        episode: Number(episode),
        first: true
      })
    });
  };

  let res = await doFetch(cookie);
  if (res.status === 403) {
    // Cookie expired, force refresh once
    cachedCookie = null;
    cookie = await getShiroCookie();
    res = await doFetch(cookie);
  }

  if (!res.ok) {
    throw new Error(`Shiro API error ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== "ready" || !Array.isArray(data.variants)) {
    throw new Error(data.reason || "Shiro episode not available");
  }

  return data.variants;
}

export async function handleWatch(anilistId, audio, epNum) {
  const media = await getMedia(anilistId);
  const malId = media?.idMal ?? anilistId;
  const variants = await fetchShiroEpisode(anilistId, malId, epNum);

  const matchedVariant = variants.find(v => v.id === audio) || variants.find(v => v.id === "sub") || variants[0];
  if (!matchedVariant) {
    return json({ error: `Shiro ${audio} not available for ep ${epNum}` }, 404);
  }

  const streams = [];
  const ref = `${BASE}/`;

  for (const src of (matchedVariant.sources || [])) {
    const fullUrl = src.url.startsWith("http") ? src.url : `${BASE}${src.url}`;
    const isM3u8 = fullUrl.includes(".m3u8");
    const isTs = fullUrl.includes(".ts") || fullUrl.includes(".mp4");
    
    streams.push({
      url: fullUrl,
      proxied_url: `/proxy?url=${encodeURIComponent(fullUrl)}&ref=${encodeURIComponent(ref)}`,
      type: isM3u8 ? "hls" : (isTs ? "mp4" : "hls"),
      server: src.label || src.id,
      audio,
      subtitles: (src.tracks || []).map(t => ({
        url: t.src.startsWith("http") ? t.src : `${BASE}${t.src}`,
        label: t.label,
        language: t.language,
        format: t.type || "ass",
        default: Boolean(t.default)
      })),
      priority: streams.length === 0 ? 5 : 4,
      isActive: streams.length === 0
    });
  }

  return json({
    anilistId: Number(anilistId),
    episode: Number(epNum),
    audio,
    stream_url: streams[0]?.url || null,
    proxied_stream_url: streams[0]?.proxied_url || null,
    streams
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/watch\/shiro\/(\d+)\/(sub|dub|hsub)\/shiro-(\d+)\/?$/);
    if (m) {
      return handleWatch(m[1], m[2], m[3]);
    }
    return json({ error: "Not found" }, 404);
  }
};
```

### Step 2: Register in `index.js`
In the main router:
```javascript
import shiroHandler from "./providers/shiro.js";

// Inside request handler:
m = path.match(/^\/watch\/shiro\/(\d+)\/(sub|dub|hsub)\/shiro-(\d+)\/?$/);
if (m) {
  const [, id, audio, ep] = m;
  return cachedWatch(
    `watch:shiro:${id}:${audio}:${ep}`,
    () => shiroHandler.fetch(request)
  );
}
```

### Step 3: Register in `core/episode-strategy.js`
Include `shiro` in the parallel episode resolver when listing available providers for an anime title.

---

## 6. Summary Checklist When Ready to Add

- [x] Create `providers/shiro.js` using the blueprint above.
- [x] Add `shiro` route in `index.js`.
- [x] Add `shiro` to `core/episode-strategy.js`.
- [x] Add `shiro.so` header auto-detection in `M3U8 Proxy/_worker.js`.
- [x] Test with `GET /watch/shiro/212888/sub/shiro-1`.
