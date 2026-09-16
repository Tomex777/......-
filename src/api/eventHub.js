import { EventEmitter } from 'node:events';

export class CortexEventHub extends EventEmitter {
  constructor() { super(); this.sequence = 0; this.setMaxListeners(0); }
  publish(type, payload) { const event = { id: ++this.sequence, type, at: Date.now(), payload }; this.emit('event', event); return event; }
}
