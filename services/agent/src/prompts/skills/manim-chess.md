# manim-chess — chess boards, positions, moves, evaluation

**Use when:** the prompt is about chess — openings, tactics, specific positions, full games, piece movement, or engine evaluation. Prefer this over drawing a board by hand with `Square`/`Text`; it renders a real board and animates legal moves for you.

**Import:** `from manim_chess import Board, convert_from_PGN, play_game, EvaluationBar`

**Key APIs**
- `Board(color_dark=..., color_light=...)` — a full 8×8 chessboard mobject. `FadeIn(board)` to show it. Scale/position like any mobject (`board.scale(0.85).move_to(ORIGIN)`).
- `board.set_board_from_FEN(fen)` — set the position from a FEN string (call BEFORE adding the board, or re-render).
- `convert_from_PGN(pgn_str, FEN=current_fen)` — turn a PGN move list (e.g. `"1. e4 e5 2. Nf3"`) into a moves list. Pass the FEN of the position the moves start from. Returns a list of **3-tuples** `(from_square, to_square, promotion)` — if you iterate it yourself, unpack with `for frm, to, *_ in moves:` (NOT `for frm, to in moves:`, which raises "too many values to unpack").
- `play_game(scene=self, board=board, moves=moves, animation_time=0.6)` — animate the moves on the board. This drives its own `self.play` calls and handles the tuple shape for you. Prefer this over a manual loop.
- `board.move_piece(from_square, to_square)` — animate a single move (returns an animation; wrap in `self.play(...)`). Use when you want per-move control: `for frm, to, *_ in moves: self.play(board.move_piece(frm, to), run_time=...)`.
- `EvaluationBar(evaluation=0.0)` — a vertical eval bar. `self.play(*eval_bar.set_evaluation(0.3))` to animate the advantage.
- Square highlights / arrows: `board.mark_square`, `board.highlight_square`, `board.draw_arrow` (use for annotating a key square or threat).

**Canonical pattern**
```python
FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
board = Board(); board.set_board_from_FEN(FEN)
board.scale(0.85).move_to(ORIGIN + DOWN * 0.3)
self.play(FadeIn(board))
moves = convert_from_PGN("1. e4 e5 2. Nf3", FEN=FEN)
play_game(scene=self, board=board, moves=moves, animation_time=0.6)
```

**Gotchas**
- `play_game` runs its own animations; don't wrap it in `self.play(...)`. In VOICEOVER mode, call it inside the `with self.voiceover(...)` block — its run length is roughly `len(moves) * animation_time`.
- When you advance the position with PGN, track the new FEN for the next `convert_from_PGN` call (use the FEN after the prior moves).
- The board is large; `scale(~0.85)` and leave room for a title/eval bar.
