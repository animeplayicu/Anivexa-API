import { getMedia } from "../core/anilist.js";
import { episodeMeta, expectedCount, json } from "../core/new-provider-utils.js";

const BASE = "https://shiro.so";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

let cachedCookie = null;
let cookieExpiry = 0;

/**
 * Acquire and cache the shiro_watch security cookie.
 * /anime/x/1 reliably sets the shiro_watch cookie in Set-Cookie header.
 */
export async function getShiroCookie(forceRefresh = false) {
  if (!forceRefresh && cachedCookie && Date.now() < cookieExpiry) {
    return cachedCookie;
  }

  const candidateUrls = [`${BASE}/anime/x/1`, `${BASE}/`];
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const cookies = typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
      const match = (cookies.find(c => c && c.startsWith("shiro_watch=")) || "").split(";")[0];
      if (match) {
        cachedCookie = match;
        cookieExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours
        return cachedCookie;
      }
    } catch (err) {
      console.error(`[shiro] Failed to acquire cookie from ${url}:`, err.message);
    }
  }

  return cachedCookie;
}

/**
 * Call Shiro POST /api/episode to fetch streams and subtitle tracks.
 */
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
    cookie = await getShiroCookie(true);
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

/**
 * Return episode lists (sub, dub, hsub) for an anime.
 */
export async function getEpisodes(anilistId, ctx = {}) {
  const media = ctx.media ?? await getMedia(anilistId);
  const malId = media?.idMal ?? anilistId;
  const localCtx = { ...ctx, media };

  // Probe episode 1 to check availability and supported audio variants
  const variants = await fetchShiroEpisode(anilistId, malId, 1);
  if (!variants || !variants.length) {
    throw new Error(`Shiro: no episodes available for AniList ${anilistId}`);
  }

  const hasSub = variants.some(v => v.id === "sub") || true;
  const hasDub = variants.some(v => v.id === "dub");
  const hasHsub = variants.some(v => v.id === "hsub");

  const total = expectedCount(media, ctx.anizip) || media?.episodes || 1;

  const sub = [];
  const dub = [];
  const hsub = [];

  for (let num = 1; num <= total; num++) {
    const meta = episodeMeta(num, localCtx);
    const title = meta.title || `Episode ${num}`;
    const base = {
      number: num,
      title,
      duration: meta.duration,
      filler: meta.filler || false,
      recap: false,
      uncensored: false,
      description: meta.description || null,
      image: meta.image || null,
      airDate: meta.airDate || null
    };

    if (hasSub) {
      sub.push({
        id: `watch/shiro/${anilistId}/sub/shiro-${num}`,
        audio: "sub",
        ...base
      });
    }
    if (hasDub) {
      dub.push({
        id: `watch/shiro/${anilistId}/dub/shiro-${num}`,
        audio: "dub",
        ...base
      });
    }
    if (hasHsub) {
      hsub.push({
        id: `watch/shiro/${anilistId}/hsub/shiro-${num}`,
        audio: "hsub",
        ...base
      });
    }
  }

  return {
    meta: {
      id: String(anilistId),
      title: media?.title?.english || media?.title?.romaji || null,
      source: "shiro",
      matchScore: 1,
      numbering: "standard",
      episodeOffset: 0,
    },
    episodes: {
      sub,
      dub,
      ...(hasHsub ? { hsub } : {})
    }
  };
}

/**
 * Handle /watch/shiro/:id/:audio/shiro-:ep
 */
export async function handleWatch(anilistId, audio, epNum, ctx = {}) {
  const media = ctx.media ?? await getMedia(anilistId).catch(() => null);
  const malId = media?.idMal ?? anilistId;
  const variants = await fetchShiroEpisode(anilistId, malId, epNum);

  const matchedVariant =
    variants.find(v => v.id === audio) ||
    variants.find(v => v.id === "sub") ||
    variants[0];

  if (!matchedVariant) {
    return json({ error: `Shiro ${audio} not available for ep ${epNum}` }, 404);
  }

  const streams = [];
  const ref = `${BASE}/`;

  for (const src of (matchedVariant.sources || [])) {
    const fullUrl = src.url.startsWith("http") ? src.url : `${BASE}${src.url}`;
    const isM3u8 = fullUrl.includes(".m3u8");
    const isTs = fullUrl.includes(".ts") || fullUrl.includes(".mp4");
    const tracks = (src.tracks || []).map(t => ({
      url: t.src.startsWith("http") ? t.src : `${BASE}${t.src}`,
      label: t.label,
      language: t.language,
      format: t.type || "ass",
      default: Boolean(t.default)
    }));

    streams.push({
      url: fullUrl,
      type: isM3u8 ? "hls" : (isTs ? "mp4" : "hls"),
      server: src.label || src.id,
      audio,
      headers: {
        Referer: "https://shiro.so/",
        Origin: "https://shiro.so"
      },
      subtitles: tracks,
      priority: streams.length === 0 ? 5 : 4,
      isActive: streams.length === 0
    });
  }

  // Deduplicate all subtitles for top-level subtitles field
  const allSubtitles = [];
  for (const s of streams) {
    for (const sub of (s.subtitles || [])) {
      if (!allSubtitles.some(x => x.url === sub.url)) {
        allSubtitles.push(sub);
      }
    }
  }

  return json({
    anilistId: Number(anilistId),
    episode: Number(epNum),
    audio,
    stream_url: streams[0]?.url || null,
    streams,
    subtitles: allSubtitles,
    headers: {
      Referer: "https://shiro.so/",
      Origin: "https://shiro.so"
    },
    downloads: []
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    const m = url.pathname.match(/^\/watch\/shiro\/(\d+)\/(sub|dub|hsub)\/shiro-(\d+)\/?$/);
    if (m) {
      try {
        return await handleWatch(m[1], m[2], m[3]);
      } catch (err) {
        return json({ error: err.message, stack: err.stack }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};
