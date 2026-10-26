# manim-chess — chess boards, positions, moves, evaluation

**Use when:** the prompt is about chess — openings, tactics, specific positions, full games, piece movement, or engine evaluation. Prefer this over drawing a board by hand with `Square`/`Text`; it renders a real board and animates legal moves for you.

**Import:** `from manim_chess import Board, convert_from_PGN, play_game, EvaluationBar`

## Chess correctness — the moves MUST be legal (this is the #1 way chess videos go wrong)

`manim_chess` renders whatever squares you give it, including **illegal, impossible moves**. Telling yourself "be correct" is not enough — earlier videos still slid a queen straight THROUGH its own king and called non-mates "checkmate". Obey these rules, and when unsure, COPY a verified position below instead of inventing one.

**Rules every move must obey:**
- **Sliding pieces (Q, R, B) cannot jump over ANY piece — not the enemy's, and NOT their own.** A queen on g1 cannot reach g8 if your own king is on g2; the path must be empty. Check every square between the from- and to-square. (Only the knight may jump.)
- **The king never moves into check and is never captured.** 
- **Players alternate — never play two White moves (or two Black moves) in a row.** A check must be answered before the same side moves again.
- Pieces move only as their type allows (rook: ranks/files; bishop: diagonals; queen: both; pawn: forward only).

**Only write `#` / "checkmate" if ALL THREE hold — and state why:** (1) the king is in check, (2) it has NO legal escape square (every neighbour is occupied or attacked), and (3) the checking piece can't be captured or blocked.

**SAFEST approach — don't invent, reuse a verified setup.** Prefer one of these (each is legal and a real mate — traced square by square), or a real PGN, over guessing squares:
- **Back-rank mate** (cleanest): `fen = "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1"`, then `1. Re8#` — the rook checks along the 8th rank; the black king is walled in by its own f7/g7/h7 pawns, so it has no escape.
- **Queen + rook mate**: `fen = "7k/R7/5KQ1/8/8/8/8/8 w - - 0 1"`, then `1. Ra8#` — rook checks on the 8th rank; the queen on g6 covers g8 and h7; the white king on f6 covers g7 — no escape.
- **A real game** (e.g. Scholar's Mate): start FEN + PGN `"1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#"`, driven by `convert_from_PGN(...)` + `play_game(...)` — the library only plays legal moves, so a real PGN can't hallucinate.

If you build a CUSTOM position, keep it simple: few pieces on open lines (nothing blocking), one or two moves, and trace each move before writing it.

**Before you output, verify each move:** for every `move_piece`/PGN move confirm (a) the piece moves as its type allows, (b) for Q/R/B every square along the path is empty (no piece — including your own king — in the way), (c) you are not moving the same side twice in a row, and (d) if you wrote `#`, the king truly has zero legal escape squares. If you can't verify a move is legal, switch to one of the verified positions above.

**Key APIs**

- `Board(color_dark='#769656', color_light='#eeeed2', color_highlight_light='#F7F769', color_highlight_dark='#BBCB2B')` — a full 8×8 chessboard mobject (subclass of `Mobject`). Scale/position like any mobject (`board.scale(0.85).move_to(ORIGIN)`). `FadeIn(board)` or `self.add(board)` to show it.

- `board.set_board_from_FEN(fen)` — set the position from a FEN string (returns `None` — call as a statement, never inside `self.play()`). Call before showing the board or when resetting the position.

- `convert_from_PGN(PGN, FEN=default_starting_fen)` — convert a PGN **string** (e.g. `"1. e4 e5 2. Nf3 Nc6"`, including optional PGN header tags) to a moves list. Returns `list[tuple[str, str, str]]` — each tuple is `(from_square, to_square, promotion_piece_or_empty_string)`. **Unpack with `for frm, to, promo in moves:`** (all tuples are 3 elements). The `FEN` parameter is the starting position FEN for the game; pass it when the game starts from a non-default position.

- `play_game(scene, board, moves, eval_bar=None, evals=None, animation_time=0)` — animate the full move list on the board (returns `None` — call as a statement, never inside `self.play()`). Handles castling, en passant, and promotion internally. Pass `animation_time=0.6` for animated piece movement; `animation_time=0` (default) shows moves instantly. When `eval_bar` and `evals` are provided, it updates the bar after each move.

- `board.move_piece(starting_coordinate, ending_coordinate, instant=True)` — move a single piece.
  - `instant=True` (default): moves immediately, **returns `None`** — call as a bare statement, never inside `self.play()`.
  - `instant=False`: returns an `Animation` (an `.animate.move_to(...)` builder) — use `self.play(board.move_piece(frm, to, instant=False), run_time=...)` for per-move control.

- `EvaluationBar(evaluation=0.0)` — a vertical eval bar mobject. Use `self.add(eval_bar)` or `FadeIn(eval_bar)` to show it. `eval_bar.set_evaluation(value)` returns a **list** of two `Transform` animations — play with `self.play(*eval_bar.set_evaluation(0.3))` or `self.play(eval_bar.set_evaluation(0.3))` (Manim flattens the list either way).

- `board.highlight_square(coordinate)` — highlight a square in the move-highlight color (returns `None` — bare statement). Light squares get `color_highlight_light`, dark squares get `color_highlight_dark`.

- `board.mark_square(coordinate)` — mark a square in red-orange (`#EC7D6A`) (returns `None` — bare statement). Use for threats, attacked squares, or annotations.

- `board.unmark_square(coordinate)` — remove a mark from a square (returns `None` — bare statement).

- `board.draw_arrow(end_coordinate, tip_coordinate)` — draw an orange arrow from `end_coordinate` to `tip_coordinate` (returns `None` — bare statement). Handles straight, diagonal, and knight-move paths automatically.

- `board.remove_arrows()` — clear all drawn arrows (returns `None` — bare statement).

- `board.clear_higlights()` — remove all square highlights (returns `None` — bare statement; note: method name has the single-`h` typo in the library).

- `board.add_piece(piece_type, is_white, coordinate)` — add a piece by type string (returns `None`).

- `board.remove_piece(coordinate)` — remove the piece at a square (returns `None`).

- `board.promote_piece(coordinate, piece_type)` — replace the piece at `coordinate` with `piece_type` (returns `None`). Used after pawn promotion.

- `board.get_square(coordinate)` — returns the `Square` mobject for that square (useful for `next_to`/positioning).

- `board.get_piece_at_square(coordinate)` — returns the piece mobject or `None`.

**Canonical pattern — full game with PGN (preferred)**
```python
from manim_chess import Board, convert_from_PGN, play_game, EvaluationBar
from manim import *

FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
board = Board()
board.set_board_from_FEN(FEN)
board.scale(0.85).move_to(ORIGIN)
self.play(FadeIn(board))

moves = convert_from_PGN("1. e4 e5 2. Nf3 Nc6 3. Bb5", FEN=FEN)
play_game(scene=self, board=board, moves=moves, animation_time=0.6)
```

**Canonical pattern — per-move with eval bar**
```python
from manim_chess import Board, convert_from_PGN, EvaluationBar
from manim import *

FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
board = Board()
board.set_board_from_FEN(FEN)
board.scale(0.80).move_to(LEFT * 1.5)

eval_bar = EvaluationBar(evaluation=0.0)
eval_bar.move_to(RIGHT * 3.5)
self.play(FadeIn(board), FadeIn(eval_bar))

moves = convert_from_PGN("1. e4 e5 2. Nf3", FEN=FEN)
evals = [0.3, 0.1, 0.5]
for frm, to, promo in moves:
    self.play(board.move_piece(frm, to, instant=False), run_time=0.6)
    if promo:
        board.promote_piece(to, promo)
    self.play(*eval_bar.set_evaluation(evals.pop(0)))
    self.wait(0.5)
```

**Gotchas**
- `play_game`, `move_piece(instant=True)`, `highlight_square`, `mark_square`, `draw_arrow`, `set_board_from_FEN`, `remove_arrows`, `clear_higlights`, `add_piece`, `remove_piece`, `promote_piece` **all return `None`** — call them as bare statements, never inside `self.play(...)`.
- `move_piece(instant=False)` **returns an Animation** — use inside `self.play(board.move_piece(frm, to, instant=False))`.
- `eval_bar.set_evaluation(v)` **returns a list of two animations** — play with `self.play(*eval_bar.set_evaluation(v))`.
- `convert_from_PGN` takes a **string** (the PGN text), not a list, despite the `list[str]` type annotation in the source. Works with or without PGN header tags.
- `convert_from_PGN` returns **3-tuples** `(from, to, promotion_or_empty)` — always unpack all three: `for frm, to, promo in moves:`. `play_game` handles the 3-tuple internally; only your own loop needs the explicit unpack.
- In VOICEOVER mode, use `play_game(...)` inside the `with self.voiceover(...)` block — its run time is approximately `len(moves) × animation_time` seconds.
- The board is large by default; `scale(~0.85)` and leave room for a title/eval bar.
- Square coordinate format: file + rank, lowercase, e.g. `'e4'`, `'g1'`, `'h8'`.

<!-- verified against manim_chess via introspection on 2026-06-08 -->
