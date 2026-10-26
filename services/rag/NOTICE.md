# Corpus notices

The API reference corpus in `data/chunks_all.json`, scene examples in
`data/expanded_examples.json`, and the static API descriptions in
`src/core/query-transform.ts` contain content derived from Manim Community
v0.19.0 documentation and `example_scenes`.
Sources: https://github.com/ManimCommunity/manim/tree/v0.19.0 and
https://docs.manim.community/en/v0.19.0/.
Derived files: `data/chunks_all.json` (API reference text),
`data/expanded_examples.json` (scenes from the docs and `example_scenes`) and the
API one-line descriptions inlined in `src/core/query-transform.ts`.

Written in-house, not derived from Manim: `data/seed_examples.json`,
`data/manim_knowledge.json`, and the plugin examples in `seed_corpus/`. Git history
shows one author for these files. The plugin examples call the public APIs of the
six Manim plugins but contain no plugin source code.

The corpus builders are retained in `notebooks/` and `scripts/scrape-examples.ts`.

Upstream license: https://github.com/ManimCommunity/manim/blob/v0.19.0/LICENSE

MIT License

Copyright (c) 2018 3Blue1Brown LLC

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
