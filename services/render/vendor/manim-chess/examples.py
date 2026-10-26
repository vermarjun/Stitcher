from manim import *
import manim_chess


class MovingPieces(Scene):
    def construct(self):
        chess_board = manim_chess.Board()
        chess_board.set_board_from_FEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

        moves = [('e2', 'e4', ''), ('e7', 'e5', ''), ('g1', 'f3', '')]

        self.add(chess_board)
        self.wait()
        manim_chess.play_game(scene=self, board=chess_board, moves=moves)
        self.wait()


class PGN_Example(MovingCameraScene):
    def construct(self):
        chess_board = manim_chess.Board()
        chess_board.set_board_from_FEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

        moves = manim_chess.convert_from_PGN("""[Event "It (cat.17)"]
[Site "Wijk aan Zee (Netherlands)"]
[White "Kasparov Garry (RUS)"]
[Black "Topalov Veselin (BUL)"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6
Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3
exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+
Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26.
Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3
32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37.
Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1
Rd2 44. Qa7 1-0""")

        self.add(chess_board)
        self.wait()
        manim_chess.play_game(scene=self, board=chess_board, moves=moves)
        self.wait()


class EvalBarExample(MovingCameraScene):
    def construct(self):
        chess_board = manim_chess.Board()
        chess_board.set_board_from_FEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

        eval_bar = manim_chess.EvaluationBar()
        eval_bar.move_to(chess_board.get_left()).shift(LEFT * 0.5)

        self.add(chess_board, eval_bar)
        self.wait()
        self.play(*eval_bar.set_evaluation(1.5))
        self.wait()
        self.play(*eval_bar.set_evaluation(-3))
        self.wait()


class MarkSquaresExample(MovingCameraScene):
    def construct(self):
        chess_board = manim_chess.Board()
        chess_board.set_board_from_FEN()

        self.add(chess_board)

        chess_board.mark_square('e4')
        self.wait()
        chess_board.mark_square('c5')
        self.wait()
        chess_board.unmark_square('e4')
        chess_board.unmark_square('c5')
        self.wait()


class DrawArrowsExample(MovingCameraScene):
    def construct(self):
        chess_board = manim_chess.Board()
        chess_board.set_board_from_FEN()

        self.add(chess_board)

        chess_board.draw_arrow('e2', 'e4')
        self.wait()
        chess_board.draw_arrow('b8', 'c6')
        self.wait()
        chess_board.draw_arrow('b1', 'a3')
        self.wait()
        chess_board.remove_arrows()
        self.wait()
