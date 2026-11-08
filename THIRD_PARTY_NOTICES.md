# Third-party notices

MeatDeck is MIT licensed (see `LICENSE`). It includes or ships code and data from the projects below.

## T3 Code

- Project: [github.com/pingdotgg/t3code](https://github.com/pingdotgg/t3code)
- License: MIT, © T3 Tools Inc.
- What MeatDeck uses:
  - `web/src/components/chat/`: the chat timeline, ported from T3 Code's chat timeline (presentational layer only). Each ported file names its T3 source in its header.
  - `web/src/components/ProviderIcon.tsx`: the provider icons, from T3 Code's `apps/web/src/components/Icons.tsx`.
  - The look of the app (design tokens, window chrome) follows T3 Code.

```
MIT License

Copyright (c) 2026 T3 Tools Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Runtime dependencies that ship third-party data

These are bundled into the app. Their full license texts are in their packages under `node_modules`.

| Package                                               | License              | What it brings                                                       |
| ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| [frimousse](https://github.com/liveblocks/frimousse)  | MIT, © Liveblocks    | The emoji picker for doc icons                                       |
| [emojibase-data](https://github.com/milesj/emojibase) | MIT, © Miles Johnson | Emoji names and metadata, served locally so the picker works offline |

All other dependencies are listed in `package.json` and `pnpm-lock.yaml`, each under its own license.

## Trademarks

The Claude, OpenAI (Codex) and Cursor names and logos are trademarks of their respective owners. MeatDeck shows them only to identify which provider a chat runs on. MeatDeck is not affiliated with or endorsed by Anthropic, OpenAI, Anysphere (Cursor) or T3 Tools Inc.
