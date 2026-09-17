const jikan = async path => {
  const res = await fetch(`https://api.jikan.moe/v4${path}`, { headers: { 'user-agent': 'Night/0.3' } });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  return res.json();
};

function cleanJikan(items = [], limit = 10) {
  return items.slice(0, limit).map(item => ({
    id: item.mal_id,
    title: item.title_english || item.title || item.name,
    type: item.type || null,
    score: item.score ?? null,
    status: item.status || null,
    episodes: item.episodes ?? null,
    chapters: item.chapters ?? null,
    url: item.url || null,
    image: item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || null
  }));
}

export async function animeList(mode='trending', query='') {
  if (mode === 'search') return cleanJikan((await jikan(`/anime?q=${encodeURIComponent(query)}&limit=10&sfw=true`)).data);
  if (mode === 'airing') return cleanJikan((await jikan('/top/anime?filter=airing&limit=10')).data);
  if (mode === 'recent') return cleanJikan((await jikan('/seasons/now?limit=10')).data);
  if (mode === 'popular') return cleanJikan((await jikan('/top/anime?filter=bypopularity&limit=10')).data);
  return cleanJikan((await jikan('/top/anime?limit=10')).data);
}

export async function mangaList(mode='trending', query='') {
  if (mode === 'search') return cleanJikan((await jikan(`/manga?q=${encodeURIComponent(query)}&limit=10&sfw=true`)).data);
  if (mode === 'recent') return cleanJikan((await jikan('/top/manga?filter=publishing&limit=10')).data);
  if (mode === 'popular') return cleanJikan((await jikan('/top/manga?filter=bypopularity&limit=10')).data);
  return cleanJikan((await jikan('/top/manga?limit=10')).data);
}

async function reddit(pathname) {
  const res = await fetch(`https://www.reddit.com${pathname}.json?raw_json=1`, { headers: { 'user-agent': 'Night/0.3 private assistant' } });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  return res.json();
}

export async function meme({dark=false,limit=10}={}) {
  const subs = dark ? ['darkmemes','cursedmemes','dankmemes'] : ['memes','dankmemes','wholesomememes'];
  for (const sub of subs) {
    try {
      const data = await reddit(`/r/${sub}/hot`);
      const items=(data?.data?.children||[]).map(x=>x.data).filter(x=>x && !x.stickied && (x.url_overridden_by_dest||x.url)).filter(x=>/\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(x.url_overridden_by_dest||x.url));
      if(items.length) return items.slice(0,limit).map(x=>({title:x.title,url:x.url_overridden_by_dest||x.url,permalink:`https://reddit.com${x.permalink}`,subreddit:x.subreddit}));
    } catch {}
  }
  return [];
}

export async function gifSearch(query,limit=8) {
  const key=String(process.env.TENOR_API_KEY||'').trim();
  if(!key) throw new Error('Set TENOR_API_KEY to enable GIF search.');
  const res=await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}&client_key=night&limit=${Math.min(Number(limit)||8,20)}`);
  if(!res.ok) throw new Error(`Tenor ${res.status}`);
  const data=await res.json();
  return (data.results||[]).map(x=>({title:x.content_description||query,url:x.media_formats?.gif?.url||x.media_formats?.mediumgif?.url||x.itemurl,itemUrl:x.itemurl})).filter(x=>x.url);
}

export async function pinterestLinks(query, ai) {
  if (!ai) throw new Error('AI search is unavailable');
  const result=await ai.search({text:`Find useful Pinterest results for: ${query}. Return direct Pinterest page links with short labels; do not invent URLs.`,sessionId:'system',chatJid:'pinterest'});
  return result.text;
}
