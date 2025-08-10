
from manim import *
class QuickSortDemo(Scene):
    def construct(self):
        array = [1, 2, 5, 4, 2]
        cell_width = 1.2
        cell_height = 1.2
        colors = {
            "pivot": RED,
            "left": BLUE,
            "right": GREEN,
            "default": WHITE
        }

        def create_array_visual(arr):
            cells = VGroup()
            for i, val in enumerate(arr):
                box = Square(side_length=cell_height).set_stroke(color=WHITE, width=2).set_fill(BLACK, opacity=1)
                text = Text(str(val)).scale(0.8)
                cell_group = VGroup(box, text).arrange(DOWN, buff=0.1)
                cells.add(cell_group)
            cells.arrange(RIGHT, buff=0.2)
            return cells

        array_visual = create_array_visual(array)
        array_visual.move_to(ORIGIN)
        self.play(FadeIn(array_visual))
        self.wait(0.5)

        def highlight_cell(index, color):
            box = array_visual[index][0]
            return box.animate.set_stroke(color=color, width=6)

        def swap_cells(i, j):
            return [
                array_visual[i].animate.shift(RIGHT * (j - i) * (cell_width + 0.2)),
                array_visual[j].animate.shift(RIGHT * (i - j) * (cell_width + 0.2))
            ]

        def quick_sort(left, right):
            if left >= right:
                if left == right:
                    self.play(highlight_cell(left, colors["right"]))
                return

            pivot_index = right
            self.play(highlight_cell(pivot_index, colors["pivot"]))
            pivot_value = int(array_visual[pivot_index][1].text)
            i = left - 1
            self.wait(0.3)

            for j in range(left, right):
                self.play(array_visual[j][0].animate.set_stroke(color=YELLOW, width=4), run_time=0.3)
                value_j = int(array_visual[j][1].text)
                if value_j <= pivot_value:
                    i += 1
                    if i != j:
                        self.play(*swap_cells(i, j), run_time=0.5)
                        array_visual.submobjects[i], array_visual.submobjects[j] = array_visual.submobjects[j], array_visual.submobjects[i]
                    self.play(highlight_cell(i, colors["left"]))
                else:
                    self.play(highlight_cell(j, colors["default"]), run_time=0.2)

            if i + 1 != pivot_index:
                self.play(*swap_cells(i + 1, pivot_index), run_time=0.5)
                array_visual.submobjects[i + 1], array_visual.submobjects[pivot_index] = array_visual.submobjects[pivot_index], array_visual.submobjects[i + 1]

            self.play(highlight_cell(i + 1, colors["right"]))
            self.wait(0.3)

            quick_sort(left, i)
            quick_sort(i + 2, right)

        quick_sort(0, len(array) - 1)
        self.wait(1)
        self.play(*[highlight_cell(k, colors["right"]) for k in range(len(array))])
        self.wait(1)
