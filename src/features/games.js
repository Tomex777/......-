import { Chess } from 'chess.js';

const HANGMAN_WORDS = ['javascript','whatsapp','midnight','eclipse','android','compose','library','network','archive','galaxy','puzzle','chessboard','assistant','privacy','sticker','manga','anime','reminder','search','context'];
const WYR = [
  ['always know when someone is lying','always be able to convince anyone of one true fact'],
  ['have perfect memory','learn any new skill twice as fast'],
  ['travel ten years into the past once','travel ten years into the future once'],
  ['never need sleep','never need to charge any device you own'],
  ['only communicate by voice notes for a week','only communicate by text for a month'],
  ['be unbeatable at chess','know the answer to every trivia question'],
  ['have unlimited books','have unlimited movies and series'],
  ['pause time for ten minutes a day','rewind your own day by ten minutes once a day']
];

const keyOf = ({ sessionId='', chatJid='' }={}) => `${sessionId}:${chatJid}`;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const decodeHtml = value => String(value || '').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

export class GameService {
  constructor({ fetchImpl = globalThis.fetch } = {}) { this.fetchImpl=fetchImpl; this.states=new Map(); }
  state(context) { return this.states.get(keyOf(context)) || null; }
  clear(context) { this.states.delete(keyOf(context)); }

  chess(context, action='new', value='') {
    const key = keyOf(context); let state = this.states.get(key);
    if (action === 'new' || !state || state.type !== 'chess') {
      const game = new Chess();
      state = { type:'chess', game, createdAt:Date.now() }; this.states.set(key,state);
      return this.#chessSnapshot(game, 'New chess game. You are White.');
    }
    const game = state.game;
    if (action === 'move') {
      const moveText = String(value || '').trim();
      if (!moveText) throw new Error('Give a move like e2e4, e4, Nf3, or O-O.');
      let move = null;
      try {
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(moveText)) move = game.move({ from:moveText.slice(0,2), to:moveText.slice(2,4), promotion:moveText[4]?.toLowerCase() || 'q' });
        else move = game.move(moveText);
      } catch {}
      if (!move) throw new Error(`Illegal move: ${moveText}`);
      if (!game.isGameOver()) {
        const moves = game.moves({ verbose:true });
        const replies = moves.map(m=>({m,score:this.#moveScore(m,game)})).sort((a,b)=>b.score-a.score);
        const pool = replies.slice(0, Math.max(1, Math.min(5,replies.length)));
        const selected = pick(pool)?.m || pick(moves);
        if (selected) game.move(selected);
      }
      return this.#chessSnapshot(game, game.isGameOver() ? this.#gameOverText(game) : `You played ${move.san}. Night replied.`);
    }
    if (action === 'resign') { this.states.delete(key); return { text:'You resigned. Game over.', board:null, gameOver:true }; }
    return this.#chessSnapshot(game, 'Current game');
  }

  #moveScore(move, game) {
    let score = Math.random()*2;
    if (move.captured) score += ({p:1,n:3,b:3,r:5,q:9,k:20})[move.captured] || 0;
    if (move.promotion) score += 7;
    if (move.san?.includes('+')) score += 1.2;
    if (move.san?.includes('#')) score += 100;
    const center = ['d4','d5','e4','e5']; if (center.includes(move.to)) score += 0.7;
    return score;
  }

  #gameOverText(game) {
    if (game.isCheckmate()) return `Checkmate. ${game.turn()==='w' ? 'Black' : 'White'} wins.`;
    if (game.isStalemate()) return 'Stalemate.';
    if (game.isThreefoldRepetition()) return 'Draw by repetition.';
    if (game.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (game.isDraw()) return 'Draw.';
    return 'Game over.';
  }

  #chessSnapshot(game, prefix='') {
    const board = game.ascii();
    return { text:[prefix, '', '```', board, '```', `Turn: ${game.turn()==='w' ? 'White' : 'Black'}`, game.inCheck() ? 'Check.' : ''].filter(Boolean).join('\n'), board, fen:game.fen(), pgn:game.pgn(), gameOver:game.isGameOver() };
  }

  async trivia(context, action='new', answer='') {
    const key = keyOf(context); let state = this.states.get(key);
    if (action === 'answer' && state?.type === 'trivia') {
      const given = String(answer || '').trim().toLowerCase();
      const choices = state.choices;
      const byIndex = /^\d+$/.test(given) ? choices[Number(given)-1] : null;
      const selected = byIndex || choices.find(x=>x.toLowerCase()===given) || answer;
      const correct = String(selected).toLowerCase() === String(state.correct).toLowerCase();
      const result = `${correct ? 'Correct.' : `Not quite. The answer was ${state.correct}.`}`;
      this.states.delete(key);
      return { text:result, correct, answer:state.correct };
    }
    if (typeof this.fetchImpl !== 'function') throw new Error('Trivia service is unavailable');
    const response = await this.fetchImpl('https://opentdb.com/api.php?amount=1&type=multiple', { headers:{'user-agent':'Night/0.3'} });
    const data = await response.json(); const item = data?.results?.[0];
    if (!item) throw new Error('Trivia service returned no question');
    const correct = decodeHtml(item.correct_answer); const choices = [...(item.incorrect_answers||[]).map(decodeHtml), correct].sort(()=>Math.random()-0.5);
    state={type:'trivia',correct,choices,question:decodeHtml(item.question)}; this.states.set(key,state);
    return { text:[state.question,'',...choices.map((x,i)=>`${i+1}. ${x}`),'', 'Reply with `.trivia <number>` or the answer.'].join('\n'), choices, question:state.question };
  }

  hangman(context, action='new', guess='') {
    const key=keyOf(context); let state=this.states.get(key);
    if (action==='new' || !state || state.type!=='hangman') {
      const word=pick(HANGMAN_WORDS); state={type:'hangman',word,guesses:new Set(),wrong:0}; this.states.set(key,state);
      return this.#hangmanSnapshot(state);
    }
    const g=String(guess||'').toLowerCase().replace(/[^a-z]/g,'');
    if (!g) throw new Error('Guess a letter or the whole word.');
    if (g.length>1) {
      if (g===state.word) { state.guesses=new Set(state.word.split('')); return this.#hangmanSnapshot(state,true); }
      state.wrong += 1;
    } else if (!state.guesses.has(g)) { state.guesses.add(g); if (!state.word.includes(g)) state.wrong+=1; }
    const won=[...state.word].every(ch=>state.guesses.has(ch)); const lost=state.wrong>=6;
    const snap=this.#hangmanSnapshot(state,won,lost); if (won||lost) this.states.delete(key); return snap;
  }
  #hangmanSnapshot(state, won=false, lost=false) {
    const display=[...state.word].map(ch=>state.guesses.has(ch)?ch:'_').join(' ');
    return { text:[`Word: ${display}`,`Wrong guesses: ${state.wrong}/6`,`Used: ${[...state.guesses].sort().join(', ')||'none'}`, won?`You got it: ${state.word}`:'', lost?`Game over. The word was ${state.word}.`:''].filter(Boolean).join('\n'), won, lost };
  }

  wordchain(context, word='') {
    const key=keyOf(context); let state=this.states.get(key);
    const cleaned=String(word||'').trim().toLowerCase().replace(/[^a-z]/g,'');
    if (!state || state.type!=='wordchain' || !cleaned) {
      const start=pick(['night','river','apple','engine','orbit','tiger','radio','ocean']);
      state={type:'wordchain',last:start,used:new Set([start])}; this.states.set(key,state);
      return { text:`Word chain started: *${start}*\nReply with .wordchain <word> beginning with *${start.at(-1)}*.` };
    }
    if (cleaned.length<2) throw new Error('Use a real word with at least two letters.');
    if (state.used.has(cleaned)) throw new Error('That word was already used.');
    if (cleaned[0]!==state.last.at(-1)) throw new Error(`Your word must start with ${state.last.at(-1)}.`);
    state.used.add(cleaned); state.last=cleaned;
    const nextLetter=cleaned.at(-1);
    return { text:`Good: *${cleaned}*. Next word must start with *${nextLetter}*.` };
  }

  wouldYouRather() {
    const [a,b]=pick(WYR); return { text:`Would you rather…\n\nA) ${a}\n\nor\n\nB) ${b}` };
  }
}
