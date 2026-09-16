# Night commands

Drop one command per `.js`/`.mjs` module here. The hot loader validates a module before swapping it in, so a bad edit leaves the previous working command active.

Command contract:

```js
export default {
  name: 'example',
  aliases: [],
  ownerOnly: false,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: null,
  async execute(ctx) {}
}
```
