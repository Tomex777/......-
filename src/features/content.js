import crypto from 'node:crypto';
import path from 'node:path';

const UA = 'Night/0.3 private WhatsApp assistant';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value ?? '').trim();
const encode = encodeURIComponent;

function randomOf(items) { return items.length ? items[Math.floor(Math.random() * items.length)] : null; }
function extFromUrl(value, fallback = 'bin') {
  try {
    const p = new URL(value).pathname;
    const ext = path.extname(p).slice(1).toLowerCase();
    return /^[a-z0-9]{2,5}$/.test(ext) ? ext : fallback;
  } catch { return fallback; }
}
function mimeFromExt(ext) {
  return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',pdf:'application/pdf'})[String(ext).toLowerCase()] || 'application/octet-stream';
}

export class ContentService {
  constructor({ config, fetchImpl = globalThis.fetch, logger = console } = {}) {
    this.config = config; this.fetchImpl = fetchImpl; this.logger = logger;
    this.lastJikanAt = 0;
  }

  async #fetch(url, options = {}) {
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch() is unavailable');
    const response = await this.fetchImpl(url, { redirect:'follow', ...options, headers:{ 'user-agent':UA, accept:'*/*', ...(options.headers || {}) } });
    return response;
  }

  async #json(url, options = {}) {
    const response = await this.#fetch(url, { ...options, headers:{ accept:'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`Request failed ${response.status}: ${text.slice(0,500)}`);
    try { return JSON.parse(text); } catch { throw new Error('Remote service returned invalid JSON'); }
  }

  async #jikan(pathname, params = {}) {
    const wait = Math.max(0, 360 - (Date.now() - this.lastJikanAt));
    if (wait) await sleep(wait);
    this.lastJikanAt = Date.now();
    const url = new URL(`https://api.jikan.moe/v4/${pathname.replace(/^\//,'')}`);
    for (const [k,v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v));
    return this.#json(url.toString());
  }

  #animeRow(item) {
    return {
      id:item.mal_id,
      title:item.title_english || item.title || item.title_japanese,
      type:item.type || null,
      episodes:item.episodes ?? null,
      status:item.status || null,
      score:item.score ?? null,
      year:item.year ?? null,
      image:item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || null,
      url:item.url || null,
      synopsis:item.synopsis || null
    };
  }
  #mangaRow(item) {
    return {
      id:item.mal_id,
      title:item.title_english || item.title || item.title_japanese,
      type:item.type || null,
      chapters:item.chapters ?? null,
      volumes:item.volumes ?? null,
      status:item.status || null,
      score:item.score ?? null,
      image:item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || null,
      url:item.url || null,
      synopsis:item.synopsis || null
    };
  }

  async anime({ mode = 'trending', query = '', limit = 10 } = {}) {
    const m = String(mode || 'trending').toLowerCase();
    let data;
    if (m === 'search') {
      if (!clean(query)) throw new Error('Anime search needs a title');
      data = await this.#jikan('anime', { q:query, limit, sfw:true, order_by:'popularity' });
    } else if (m === 'airing') data = await this.#jikan('seasons/now', { limit, sfw:true });
    else if (m === 'recent') data = await this.#jikan('seasons/now', { limit, sfw:true, order_by:'start_date', sort:'desc' });
    else if (m === 'popular') data = await this.#jikan('top/anime', { filter:'bypopularity', limit });
    else data = await this.#jikan('top/anime', { filter:'airing', limit });
    return (data?.data || []).slice(0, limit).map(x=>this.#animeRow(x));
  }

  async manga({ mode = 'trending', query = '', limit = 10 } = {}) {
    const m = String(mode || 'trending').toLowerCase();
    let data;
    if (m === 'search') {
      if (!clean(query)) throw new Error('Manga search needs a title');
      data = await this.#jikan('manga', { q:query, limit, sfw:true, order_by:'popularity' });
    } else if (m === 'recent' || m === 'new') data = await this.#jikan('manga', { order_by:'start_date', sort:'desc', limit, sfw:true });
    else if (m === 'popular') data = await this.#jikan('top/manga', { filter:'bypopularity', limit });
    else data = await this.#jikan('top/manga', { limit });
    return (data?.data || []).slice(0, limit).map(x=>this.#mangaRow(x));
  }

  async animeSnapshot(query) {
    const rows = await this.anime({ mode:'search', query, limit:1 });
    const item = rows[0];
    if (!item) throw new Error(`Anime not found: ${query}`);
    return { kind:'anime', query, id:item.id, title:item.title, episodes:item.episodes, status:item.status, score:item.score, url:item.url };
  }

  async mangaSnapshot(query) {
    const rows = await this.manga({ mode:'search', query, limit:1 });
    const item = rows[0];
    if (!item) throw new Error(`Manga not found: ${query}`);
    return { kind:'manga', query, id:item.id, title:item.title, chapters:item.chapters, volumes:item.volumes, status:item.status, score:item.score, url:item.url };
  }

  async meme({ dark = false } = {}) {
    const configured = clean(this.config?.get?.(dark ? 'REDDIT_DARK_MEME_SUBREDDITS' : 'REDDIT_MEME_SUBREDDITS', dark ? 'darkmemes,darkhumorandjokes' : 'memes,dankmemes,wholesomememes'));
    const subreddits = configured.split(',').map(x=>x.trim()).filter(Boolean);
    let lastError;
    for (const subreddit of [...subreddits].sort(()=>Math.random()-0.5)) {
      try {
        const data = await this.#json(`https://www.reddit.com/r/${encode(subreddit)}/hot.json?raw_json=1&limit=50`);
        const posts = (data?.data?.children || []).map(x=>x?.data).filter(Boolean).filter(post=>{
          const url = post.url_overridden_by_dest || post.url || '';
          return !post.stickied && !post.is_video && /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url);
        });
        const post = randomOf(posts);
        if (!post) continue;
        const mediaUrl = post.url_overridden_by_dest || post.url;
        return { title:post.title || (dark ? 'Dark meme' : 'Meme'), url:mediaUrl, sourceUrl:`https://www.reddit.com${post.permalink || ''}`, subreddit, over18:Boolean(post.over_18) };
      } catch (error) { lastError=error; }
    }
    throw lastError || new Error('No meme was available right now');
  }

  async gif(query) {
    const q = clean(query);
    if (!q) throw new Error('GIF search needs a query');
    const tenor = clean(this.config?.get?.('TENOR_API_KEY',''));
    if (tenor) {
      const data = await this.#json(`https://tenor.googleapis.com/v2/search?q=${encode(q)}&key=${encode(tenor)}&client_key=night&limit=20&media_filter=gif,tinygif,mp4`);
      const result = randomOf(data?.results || []);
      const media = result?.media_formats?.gif || result?.media_formats?.tinygif || result?.media_formats?.mp4;
      if (media?.url) return { title:result.content_description || q, url:media.url, sourceUrl:result.itemurl || null, provider:'tenor' };
    }
    const giphy = clean(this.config?.get?.('GIPHY_API_KEY',''));
    if (giphy) {
      const data = await this.#json(`https://api.giphy.com/v1/gifs/search?api_key=${encode(giphy)}&q=${encode(q)}&limit=25&rating=pg-13`);
      const result = randomOf(data?.data || []);
      const url = result?.images?.original?.url || result?.images?.downsized?.url;
      if (url) return { title:result.title || q, url, sourceUrl:result.url || null, provider:'giphy' };
    }
    const data = await this.#json(`https://www.reddit.com/r/reactiongifs/search.json?raw_json=1&restrict_sr=1&sort=relevance&t=all&q=${encode(q)}&limit=50`);
    const posts = (data?.data?.children || []).map(x=>x?.data).filter(Boolean).filter(p=>/\.gif(?:\?|$)/i.test(p.url || ''));
    const post = randomOf(posts);
    if (!post) throw new Error('No GIF found. Add TENOR_API_KEY or GIPHY_API_KEY for better results.');
    return { title:post.title || q, url:post.url, sourceUrl:`https://www.reddit.com${post.permalink || ''}`, provider:'reddit' };
  }

  async pinterest(query, { limit = 6 } = {}) {
    const q = clean(query);
    if (!q) throw new Error('Pinterest search needs a query');
    const response = await this.#fetch(`https://www.pinterest.com/search/pins/?q=${encode(q)}&rs=typed`, { headers:{ accept:'text/html,application/xhtml+xml' } });
    const html = await response.text();
    if (!response.ok) throw new Error(`Pinterest search failed: ${response.status}`);
    const found = new Map();
    const regex = /https:\\/\\/i\.pinimg\.com\\/[^"'<>\\s]+/g;
    for (const match of html.matchAll(regex)) {
      const url = match[0].replace(/\\u002F/g,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
      if (!/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) continue;
      const key = url.replace(/\/\d+x\//,'/originals/');
      found.set(key, key);
      if (found.size >= limit) break;
    }
    if (!found.size) throw new Error('Pinterest did not return usable media. It may be blocking automated search right now.');
    return [...found.values()].map(url=>({ title:q, url, sourceUrl:`https://www.pinterest.com/search/pins/?q=${encode(q)}` }));
  }

  async download(url, { maxBytes = null } = {}) {
    const value = clean(url);
    if (!/^https?:\/\//i.test(value)) throw new Error('A public http/https URL is required');
    const max = Number(maxBytes || this.config?.get?.('DOWNLOAD_MAX_BYTES', 64 * 1024 * 1024));
    const response = await this.#fetch(value, { headers:{ accept:'*/*' } });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared && declared > max) throw new Error(`Download is larger than ${Math.round(max/1024/1024)} MB`);
    const reader = response.body?.getReader?.();
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > max) throw new Error(`Download is larger than ${Math.round(max/1024/1024)} MB`);
      const mimeType = response.headers.get('content-type')?.split(';')[0] || mimeFromExt(extFromUrl(value));
      return { buffer, mimeType, fileName:path.basename(new URL(value).pathname) || `download.${extFromUrl(value)}` };
    }
    const chunks=[]; let size=0;
    while (true) {
      const { done, value:chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > max) { try { await reader.cancel(); } catch {} throw new Error(`Download is larger than ${Math.round(max/1024/1024)} MB`); }
      chunks.push(Buffer.from(chunk));
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0] || mimeFromExt(extFromUrl(value));
    let fileName = path.basename(new URL(value).pathname) || `download.${extFromUrl(value)}`;
    const disposition = response.headers.get('content-disposition') || '';
    const named = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)?.[1];
    if (named) try { fileName=decodeURIComponent(named.replace(/"/g,'')); } catch {}
    return { buffer:Buffer.concat(chunks), mimeType, fileName:fileName.slice(0,180) };
  }

  async urlSnapshot(url) {
    const response = await this.#fetch(clean(url), { headers:{ accept:'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' } });
    const text = (await response.text()).slice(0, 2_000_000);
    if (!response.ok) throw new Error(`Watch request failed: HTTP ${response.status}`);
    const normalized = text.replace(/\s+/g,' ').trim();
    return { hash:crypto.createHash('sha256').update(normalized).digest('hex'), status:response.status, length:normalized.length, checkedAt:Date.now() };
  }
}
