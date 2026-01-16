CODE_SNIPPETS = {
    "matrix": {
        "parameters": {
            "matrix": {
                "name": "matrix",
                "description": "A numpy 2d array or list of lists.",
                "type": "Iterable"
            },
            "v_buff": {
                "name": "v_buff",
                "description": "Vertical distance between elements, by default 0.8.",
                "default": "0.8",
                "type": "float"
            },
            "h_buff": {
                "name": "h_buff",
                "description": "Horizontal distance between elements, by default 1.3.",
                "default": "1.3",
                "type": "float"
            },
            "bracket_h_buff": {
                "name": "bracket_h_buff",
                "description": "Distance of the brackets from the matrix, by default ``MED_SMALL_BUFF``.",
                "default": "MED_SMALL_BUFF",
                "type": "float"
            },
            "bracket_v_buff": {
                "name": "bracket_v_buff",
                "description": "Height of the brackets, by default ``MED_SMALL_BUFF``.",
                "default": "MED_SMALL_BUFF",
                "type": "float"
            },
            "add_background_rectangles_to_entries": {
                "name": "add_background_rectangles_to_entries",
                "description": "``True`` if should add backgraound rectangles to entries, by default ``False``.",
                "default": "False",
                "type": "bool"
            },
            "include_background_rectangle": {
                "name": "include_background_rectangle",
                "description": "``True`` if should include background rectangle, by default ``False``.",
                "default": "False",
                "type": "bool"
            },
            "element_to_mobject": {
                "name": "element_to_mobject",
                "description": "The mobject class used to construct the elements, by default :class:`~.MathTex`.",
                "default": "MathTex",
                "type": "type[Mobject] | Callable[..., Mobject]"
            },
            "element_to_mobject_config": {
                "name": "element_to_mobject_config",
                "description": "Additional arguments to be passed to the constructor in ``element_to_mobject``, by default ``{}``.",
                "default": "{}",
                "type": "dict"
            },
            "element_alignment_corner": {
                "name": "element_alignment_corner",
                "description": "The corner to which elements are aligned, by default ``DR``.",
                "default": "DR",
                "type": "Sequence[float]"
            },
            "left_bracket": {
                "name": "left_bracket",
                "description": "The left bracket type, by default ``\"[\"``.",
                "default": "'['",
                "type": "str"
            },
            "right_bracket": {
                "name": "right_bracket",
                "description": "The right bracket type, by default ``\"]\"``.",
                "default": "']'",
                "type": "str"
            },
            "stretch_brackets": {
                "name": "stretch_brackets",
                "description": "``True`` if should stretch the brackets to fit the height of matrix contents, by default ``True``.",
                "default": "True",
                "type": "bool"
            },
            "bracket_config": {
                "name": "bracket_config",
                "description": "Additional arguments to be passed to :class:`~.MathTex` when constructing the brackets.",
                "default": "{}",
                "type": "dict"
            }
        },
        "examples": [
            "from manim import *\n\nclass MatrixExamples(Scene):\n    def construct(self):\n        m0 = Matrix([[2, r\"\\pi\"], [-1, 1]])\n        m1 = Matrix([[2, 0, 4], [-1, 1, 5]],\n            v_buff=1.3,\n            h_buff=0.8,\n            bracket_h_buff=SMALL_BUFF,\n            bracket_v_buff=SMALL_BUFF,\n            left_bracket=r\"\\{\",\n            right_bracket=r\"\\}\")\n        m1.add(SurroundingRectangle(m1.get_columns()[1]))\n        m2 = Matrix([[2, 1], [-1, 3]],\n            element_alignment_corner=UL,\n            left_bracket=\"(\",\n            right_bracket=\")\")\n        m3 = Matrix([[2, 1], [-1, 3]],\n            left_bracket=r\"\\langle\",\n            right_bracket=r\"\\rangle\")\n        m4 = Matrix([[2, 1], [-1, 3]],\n        ).set_column_colors(RED, GREEN)\n        m5 = Matrix([[2, 1], [-1, 3]],\n        ).set_row_colors(RED, GREEN)\n        g = Group(\n            m0,m1,m2,m3,m4,m5\n        ).arrange_in_grid(buff=2)\n        self.add(g)",
            "from manim import *\n\nclass BackgroundRectanglesExample(Scene):\n    def construct(self):\n        background= Rectangle().scale(3.2)\n        background.set_fill(opacity=.5)\n        background.set_color([TEAL, RED, YELLOW])\n        self.add(background)\n        m0 = Matrix([[12, -30], [-1, 15]],\n            add_background_rectangles_to_entries=True)\n        m1 = Matrix([[2, 0], [-1, 1]],\n            include_background_rectangle=True)\n        m2 = Matrix([[12, -30], [-1, 15]])\n        g = Group(m0, m1, m2).arrange(buff=2)\n        self.add(g)"
        ]
    },
    "brace": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject adjacent to which the brace is placed.",
                "type": "Mobject"
            },
            "direction": {
                "name": "direction",
                "description": "The direction from which the brace faces the mobject.",
                "default": "DOWN",
                "type": "Vector3DLike"
            },
            "buff": {
                "name": "buff",
                "description": "",
                "default": "0.2",
                "type": "float"
            },
            "sharpness": {
                "name": "sharpness",
                "description": "",
                "default": "2",
                "type": "float"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "fill_opacity": {
                "name": "fill_opacity",
                "description": "",
                "default": "1.0",
                "type": "float"
            },
            "background_stroke_width": {
                "name": "background_stroke_width",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "background_stroke_color": {
                "name": "background_stroke_color",
                "description": "",
                "default": "BLACK",
                "type": "ParsableManimColor"
            }
        },
        "examples": [
            "from manim import *\n\nclass BraceExample(Scene):\n    def construct(self):\n        s = Square()\n        self.add(s)\n        for i in np.linspace(0.1,1.0,4):\n            br = Brace(s, sharpness=i)\n            t = Text(f\"sharpness= {i}\").next_to(br, RIGHT)\n            self.add(t)\n            self.add(br)\n        VGroup(*self.mobjects).arrange(DOWN, buff=0.2)"
        ]
    },
    "bracelabel": {
        "parameters": {
            "obj": {
                "name": "obj",
                "description": "The mobject adjacent to which the brace is placed.",
                "type": "Mobject"
            },
            "text": {
                "name": "text",
                "description": "The label text.",
                "type": "str"
            },
            "brace_direction": {
                "name": "brace_direction",
                "description": "The direction of the brace. By default ``DOWN``.",
                "default": "DOWN",
                "type": "Vector3DLike"
            },
            "label_constructor": {
                "name": "label_constructor",
                "description": "A class or function used to construct a mobject representing the label. By default :class:`~.MathTex`.",
                "default": "MathTex",
                "type": "type[SingleStringMathTex | Text]"
            },
            "font_size": {
                "name": "font_size",
                "description": "The font size of the label, passed to the ``label_constructor``.",
                "default": "DEFAULT_FONT_SIZE",
                "type": "float"
            },
            "buff": {
                "name": "buff",
                "description": "The buffer between the mobject and the brace.",
                "default": "0.2",
                "type": "float"
            },
            "brace_config": {
                "name": "brace_config",
                "description": "Arguments to be passed to :class:`.Brace`.",
                "default": "None",
                "type": "dict[str, Any] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass BraceLabelExample(Scene):\n    def construct(self):\n        sq = Square()\n        brace_label = BraceLabel(sq, \"Square\", brace_direction=DOWN)\n        self.add(sq, brace_label)"
        ]
    },
    "vectorfield": {
        "parameters": {
            "func": {
                "name": "func",
                "description": "The function defining the rate of change at every position of the `VectorField`.",
                "type": "Callable[[Point3D], Vector3D]"
            },
            "color": {
                "name": "color",
                "description": "The color of the vector field. If set, position-specific coloring is disabled.",
                "default": "None",
                "type": "ParsableManimColor | None"
            },
            "color_scheme": {
                "name": "color_scheme",
                "description": "A function mapping a vector to a single value. This value gives the position in the color gradient defined using `min_color_scheme_value`, `max_color_scheme_value` and `colors`.",
                "default": "None",
                "type": "Callable[[Vector3D], float] | None"
            },
            "min_color_scheme_value": {
                "name": "min_color_scheme_value",
                "description": "The value of the color_scheme function to be mapped to the first color in `colors`. Lower values also result in the first color of the gradient.",
                "default": "0",
                "type": "float"
            },
            "max_color_scheme_value": {
                "name": "max_color_scheme_value",
                "description": "The value of the color_scheme function to be mapped to the last color in `colors`. Higher values also result in the last color of the gradient.",
                "default": "2",
                "type": "float"
            },
            "colors": {
                "name": "colors",
                "description": "The colors defining the color gradient of the vector field.",
                "default": "DEFAULT_SCALAR_FIELD_COLORS",
                "type": "Sequence[ParsableManimColor]"
            }
        },
        "examples": [
            "from manim import *\n\nclass VectorFieldExample(Scene):\n    def construct(self):\n        func = lambda p: np.array([-p[1], p[0], 0])\n        vector_field = VectorField(func)\n        self.add(vector_field)"
        ]
    },
    "streamlines": {
        "parameters": {
            "func": {
                "name": "func",
                "description": "The function defining the rate of change at every position of the vector field.",
                "type": "Callable[[np.ndarray], np.ndarray]"
            },
            "color": {
                "name": "color",
                "description": "The color of the vector field. If set, position-specific coloring is disabled.",
                "default": "None",
                "type": "ParsableManimColor | None"
            },
            "color_scheme": {
                "name": "color_scheme",
                "description": "A function mapping a vector to a single value. This value gives the position in the color gradient defined using `min_color_scheme_value`, `max_color_scheme_value` and `colors`.",
                "default": "None",
                "type": "Callable[[np.ndarray], float] | None"
            },
            "min_color_scheme_value": {
                "name": "min_color_scheme_value",
                "description": "The value of the color_scheme function to be mapped to the first color in `colors`. Lower values also result in the first color of the gradient.",
                "default": "0",
                "type": "float"
            },
            "max_color_scheme_value": {
                "name": "max_color_scheme_value",
                "description": "The value of the color_scheme function to be mapped to the last color in `colors`. Higher values also result in the last color of the gradient.",
                "default": "2",
                "type": "float"
            },
            "colors": {
                "name": "colors",
                "description": "The colors defining the color gradient of the vector field.",
                "default": "DEFAULT_SCALAR_FIELD_COLORS",
                "type": "Sequence[ParsableManimColor]"
            },
            "x_range": {
                "name": "x_range",
                "description": "A sequence of x_min, x_max, delta_x",
                "default": "None",
                "type": "Sequence[float]"
            },
            "y_range": {
                "name": "y_range",
                "description": "A sequence of y_min, y_max, delta_y",
                "default": "None",
                "type": "Sequence[float]"
            },
            "z_range": {
                "name": "z_range",
                "description": "A sequence of z_min, z_max, delta_z",
                "default": "None",
                "type": "Sequence[float]"
            },
            "three_dimensions": {
                "name": "three_dimensions",
                "description": "Enables three_dimensions. Default set to False, automatically turns True if z_range is not None.",
                "default": "False",
                "type": "bool"
            },
            "noise_factor": {
                "name": "noise_factor",
                "description": "The amount by which the starting position of each agent is altered along each axis. Defaults to :code:`delta_y / 2` if not defined.",
                "default": "None",
                "type": "float | None"
            },
            "n_repeats": {
                "name": "n_repeats",
                "description": "The number of agents generated at each starting point.",
                "default": "1"
            },
            "dt": {
                "name": "dt",
                "description": "The factor by which the distance an agent moves per step is stretched. Lower values result in a better approximation of the trajectories in the vector field.",
                "default": "0.05"
            },
            "virtual_time": {
                "name": "virtual_time",
                "description": "The time the agents get to move in the vector field. Higher values therefore result in longer stream lines. However, this whole time gets simulated upon creation.",
                "default": "3"
            },
            "max_anchors_per_line": {
                "name": "max_anchors_per_line",
                "description": "The maximum number of anchors per line. Lines with more anchors get reduced in complexity, not in length.",
                "default": "100"
            },
            "padding": {
                "name": "padding",
                "description": "The distance agents can move out of the generation area before being terminated.",
                "default": "3"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "The stroke with of the stream lines.",
                "default": "1"
            },
            "opacity": {
                "name": "opacity",
                "description": "The opacity of the stream lines.",
                "default": "1"
            }
        },
        "examples": [
            "from manim import *\n\nclass BasicUsage(Scene):\n    def construct(self):\n        func = lambda pos: ((pos[0] * UR + pos[1] * LEFT) - pos) / 3\n        self.add(StreamLines(func))",
            "from manim import *\n\nclass SpawningAndFlowingArea(Scene):\n    def construct(self):\n        func = lambda pos: np.sin(pos[0]) * UR + np.cos(pos[1]) * LEFT + pos / 5\n        stream_lines = StreamLines(\n            func, x_range=[-3, 3, 0.2], y_range=[-2, 2, 0.2], padding=1\n        )\n        spawning_area = Rectangle(width=6, height=4)\n        flowing_area = Rectangle(width=8, height=6)\n        labels = [Tex(\"Spawning Area\"), Tex(\"Flowing Area\").shift(DOWN * 2.5)]\n        for lbl in labels:\n            lbl.add_background_rectangle(opacity=0.6, buff=0.05)\n        self.add(stream_lines, spawning_area, flowing_area, *labels)"
        ]
    },
    "line": {
        "parameters": {
            "start": {
                "name": "start",
                "description": "The starting point or Mobject of the line.",
                "default": "LEFT",
                "type": "Point3DLike | Mobject"
            },
            "end": {
                "name": "end",
                "description": "The ending point or Mobject of the line.",
                "default": "RIGHT",
                "type": "Point3DLike | Mobject"
            },
            "buff": {
                "name": "buff",
                "description": "The distance to shorten the line from both ends.",
                "default": "0",
                "type": "float"
            },
            "path_arc": {
                "name": "path_arc",
                "description": "If nonzero, the line will be curved into an arc with this angle (in radians).",
                "default": "0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass LineExample(Scene):\n    def construct(self):\n        line1 = Line(LEFT*2, RIGHT*2)\n        line2 = Line(LEFT*2, RIGHT*2, buff=0.5)\n        line3 = Line(LEFT*2, RIGHT*2, path_arc=PI/2)\n        grp = VGroup(line1,line2,line3).arrange(DOWN, buff=2)\n        self.add(grp)"
        ]
    },
    "dashedline": {
        "parameters": {
            "args": {
                "name": "args",
                "description": "Arguments to be passed to :class:`Line`"
            },
            "dash_length": {
                "name": "dash_length",
                "description": "The length of each individual dash of the line."
            },
            "dashed_ratio": {
                "name": "dashed_ratio",
                "description": "The ratio of dash space to empty space. Range of 0-1."
            },
            "kwargs": {
                "name": "kwargs",
                "description": "Additional arguments to be passed to :class:`Line`"
            },
            ".. seealso": {
                "name": ".. seealso",
                "description": ": :class:`~.DashedVMobject`"
            }
        },
        "examples": [
            "from manim import *\n\nclass DashedLineExample(Scene):\n    def construct(self):\n        # dash_length increased\n        dashed_1 = DashedLine(config.left_side, config.right_side, dash_length=2.0).shift(UP*2)\n        # normal\n        dashed_2 = DashedLine(config.left_side, config.right_side)\n        # dashed_ratio decreased\n        dashed_3 = DashedLine(config.left_side, config.right_side, dashed_ratio=0.1).shift(DOWN*2)\n        self.add(dashed_1, dashed_2, dashed_3)"
        ]
    },
    "elbow": {
        "parameters": {
            "width": {
                "name": "width",
                "description": "The length of the elbow's sides.",
                "default": "0.2",
                "type": "float"
            },
            "angle": {
                "name": "angle",
                "description": "The rotation of the elbow.",
                "default": "0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass ElbowExample(Scene):\n    def construct(self):\n        elbow_1 = Elbow()\n        elbow_2 = Elbow(width=2.0)\n        elbow_3 = Elbow(width=2.0, angle=5*PI/4)\n        elbow_group = Group(elbow_1, elbow_2, elbow_3).arrange(buff=1)\n        self.add(elbow_group)"
        ]
    },
    "arrow": {
        "parameters": {
            "args": {
                "name": "args",
                "description": "Arguments to be passed to :class:`Line`."
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "The thickness of the arrow. Influenced by :attr:`max_stroke_width_to_length_ratio`."
            },
            "buff": {
                "name": "buff",
                "description": "The distance of the arrow from its start and end points."
            },
            "max_tip_length_to_length_ratio": {
                "name": "max_tip_length_to_length_ratio",
                "description": ":attr:`tip_length` scales with the length of the arrow. Increasing this ratio raises the max value of :attr:`tip_length`."
            },
            "max_stroke_width_to_length_ratio": {
                "name": "max_stroke_width_to_length_ratio",
                "description": ":attr:`stroke_width` scales with the length of the arrow. Increasing this ratio ratios the max value of :attr:`stroke_width`."
            },
            "kwargs": {
                "name": "kwargs",
                "description": "Additional arguments to be passed to :class:`Line`."
            },
            ".. seealso": {
                "name": ".. seealso",
                "description": ": :class:`ArrowTip` :class:`CurvedArrow`"
            }
        },
        "examples": [
            "from manim import *\n\nclass ArrowExample(Scene):\n    def construct(self):\n        arrow_1 = Arrow(start=RIGHT, end=LEFT, color=GOLD)\n        arrow_2 = Arrow(start=RIGHT, end=LEFT, color=GOLD, tip_shape=ArrowSquareTip).shift(DOWN)\n        g1 = Group(arrow_1, arrow_2)\n        # the effect of buff\n        square = Square(color=MAROON_A)\n        arrow_3 = Arrow(start=LEFT, end=RIGHT)\n        arrow_4 = Arrow(start=LEFT, end=RIGHT, buff=0).next_to(arrow_1, UP)\n        g2 = Group(arrow_3, arrow_4, square)\n        # a shorter arrow has a shorter tip and smaller stroke width\n        arrow_5 = Arrow(start=ORIGIN, end=config.top).shift(LEFT * 4)\n        arrow_6 = Arrow(start=config.top + DOWN, end=config.top).shift(LEFT * 3)\n        g3 = Group(arrow_5, arrow_6)\n        self.add(Group(g1, g2, g3).arrange(buff=2))",
            "from manim import *\n\nclass ArrowExample(Scene):\n    def construct(self):\n        left_group = VGroup()\n        # As buff increases, the size of the arrow decreases.\n        for buff in np.arange(0, 2.2, 0.45):\n            left_group += Arrow(buff=buff, start=2 * LEFT, end=2 * RIGHT)\n        # Required to arrange arrows.\n        left_group.arrange(DOWN)\n        left_group.move_to(4 * LEFT)\n        middle_group = VGroup()\n        # As max_stroke_width_to_length_ratio gets bigger,\n        # the width of stroke increases.\n        for i in np.arange(0, 5, 0.5):\n            middle_group += Arrow(max_stroke_width_to_length_ratio=i)\n        middle_group.arrange(DOWN)\n        UR_group = VGroup()\n        # As max_tip_length_to_length_ratio increases,\n        # the length of the tip increases.\n        for i in np.arange(0, 0.3, 0.1):\n            UR_group += Arrow(max_tip_length_to_length_ratio=i)\n        UR_group.arrange(DOWN)\n        UR_group.move_to(4 * RIGHT + 2 * UP)\n        DR_group = VGroup()\n        DR_group += Arrow(start=LEFT, end=RIGHT, color=BLUE, tip_shape=ArrowSquareTip)\n        DR_group += Arrow(start=LEFT, end=RIGHT, color=BLUE, tip_shape=ArrowSquareFilledTip)\n        DR_group += Arrow(start=LEFT, end=RIGHT, color=YELLOW, tip_shape=ArrowCircleTip)\n        DR_group += Arrow(start=LEFT, end=RIGHT, color=YELLOW, tip_shape=ArrowCircleFilledTip)\n        DR_group.arrange(DOWN)\n        DR_group.move_to(4 * RIGHT + 2 * DOWN)\n        self.add(left_group, middle_group, UR_group, DR_group)"
        ]
    },
    "vector": {
        "parameters": {
            "direction": {
                "name": "direction",
                "description": "The direction of the arrow.",
                "default": "RIGHT",
                "type": "Vector2DLike | Vector3DLike"
            },
            "buff": {
                "name": "buff",
                "description": "The distance of the vector from its endpoints.",
                "default": "0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass VectorExample(Scene):\n    def construct(self):\n        plane = NumberPlane()\n        vector_1 = Vector([1,2])\n        vector_2 = Vector([-5,-2])\n        self.add(plane, vector_1, vector_2)"
        ]
    },
    "doublearrow": {
        "parameters": {
            "args": {
                "name": "args",
                "description": "Arguments to be passed to :class:`Arrow`"
            },
            "kwargs": {
                "name": "kwargs",
                "description": "Additional arguments to be passed to :class:`Arrow`"
            },
            ".. seealso": {
                "name": ".. seealso",
                "description": ": :class:`.~ArrowTip` :class:`.~CurvedDoubleArrow`"
            }
        },
        "examples": [
            "from manim import *\n\nclass DoubleArrowExample(Scene):\n    def construct(self):\n        circle = Circle(radius=2.0)\n        d_arrow = DoubleArrow(start=circle.get_left(), end=circle.get_right())\n        d_arrow_2 = DoubleArrow(tip_shape_end=ArrowCircleFilledTip, tip_shape_start=ArrowCircleFilledTip)\n        group = Group(Group(circle, d_arrow), d_arrow_2).arrange(UP, buff=1)\n        self.add(group)",
            "from manim import *\n\nclass DoubleArrowExample2(Scene):\n    def construct(self):\n        box = Square()\n        p1 = box.get_left()\n        p2 = box.get_right()\n        d1 = DoubleArrow(p1, p2, buff=0)\n        d2 = DoubleArrow(p1, p2, buff=0, tip_length=0.2, color=YELLOW)\n        d3 = DoubleArrow(p1, p2, buff=0, tip_length=0.4, color=BLUE)\n        Group(d1, d2, d3).arrange(DOWN)\n        self.add(box, d1, d2, d3)"
        ]
    },
    "angle": {
        "parameters": {
            "line1": {
                "name": "line1",
                "description": "The first line.",
                "type": "Line"
            },
            "line2": {
                "name": "line2",
                "description": "The second line.",
                "type": "Line"
            },
            "radius": {
                "name": "radius",
                "description": "The radius of the :class:`Arc`.",
                "default": "None",
                "type": "float | None"
            },
            "quadrant": {
                "name": "quadrant",
                "description": "A sequence of two :class:`int` numbers determining which of the 4 quadrants should be used. The first value indicates whether to anchor the arc on the first line closer to the end point (1) or start point (-1), and the second value functions similarly for the end (1) or start (-1) of the second line. Possibilities: (1,1), (-1,1), (1,-1), (-1,-1).",
                "default": "(1, 1)",
                "type": "AngleQuadrant"
            },
            "other_angle": {
                "name": "other_angle",
                "description": "Toggles between the two possible angles defined by two points and an arc center. If set to False (default), the arc will always go counterclockwise from the point on line1 until the point on line2 is reached. If set to True, the angle will go clockwise from line1 to line2.",
                "default": "False",
                "type": "bool"
            },
            "dot": {
                "name": "dot",
                "description": "Allows for a :class:`Dot` in the arc. Mainly used as an convention to indicate a right angle. The dot can be customized in the next three parameters.",
                "default": "False",
                "type": "bool"
            },
            "dot_radius": {
                "name": "dot_radius",
                "description": "The radius of the :class:`Dot`. If not specified otherwise, this radius will be 1/10 of the arc radius.",
                "default": "None",
                "type": "float | None"
            },
            "dot_distance": {
                "name": "dot_distance",
                "description": "Relative distance from the center to the arc: 0 puts the dot in the center and 1 on the arc itself.",
                "default": "0.55",
                "type": "float"
            },
            "dot_color": {
                "name": "dot_color",
                "description": "The color of the :class:`Dot`.",
                "default": "WHITE",
                "type": "ParsableManimColor"
            },
            "elbow": {
                "name": "elbow",
                "description": "Produces an elbow-type mobject indicating a right angle, see :class:`RightAngle` for more information and a shorthand.",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass RightArcAngleExample(Scene):\n    def construct(self):\n        line1 = Line( LEFT, RIGHT )\n        line2 = Line( DOWN, UP )\n        rightarcangles = [\n            Angle(line1, line2, dot=True),\n            Angle(line1, line2, radius=0.4, quadrant=(1,-1), dot=True, other_angle=True),\n            Angle(line1, line2, radius=0.5, quadrant=(-1,1), stroke_width=8, dot=True, dot_color=YELLOW, dot_radius=0.04, other_angle=True),\n            Angle(line1, line2, radius=0.7, quadrant=(-1,-1), color=RED, dot=True, dot_color=GREEN, dot_radius=0.08),\n        ]\n        plots = VGroup()\n        for angle in rightarcangles:\n            plot=VGroup(line1.copy(),line2.copy(), angle)\n            plots.add(plot)\n        plots.arrange(buff=1.5)\n        self.add(plots)",
            "from manim import *\n\nclass AngleExample(Scene):\n    def construct(self):\n        line1 = Line( LEFT + (1/3) * UP, RIGHT + (1/3) * DOWN )\n        line2 = Line( DOWN + (1/3) * RIGHT, UP + (1/3) * LEFT )\n        angles = [\n            Angle(line1, line2),\n            Angle(line1, line2, radius=0.4, quadrant=(1,-1), other_angle=True),\n            Angle(line1, line2, radius=0.5, quadrant=(-1,1), stroke_width=8, other_angle=True),\n            Angle(line1, line2, radius=0.7, quadrant=(-1,-1), color=RED),\n            Angle(line1, line2, other_angle=True),\n            Angle(line1, line2, radius=0.4, quadrant=(1,-1)),\n            Angle(line1, line2, radius=0.5, quadrant=(-1,1), stroke_width=8),\n            Angle(line1, line2, radius=0.7, quadrant=(-1,-1), color=RED, other_angle=True),\n        ]\n        plots = VGroup()\n        for angle in angles:\n            plot=VGroup(line1.copy(),line2.copy(), angle)\n            plots.add(VGroup(plot,SurroundingRectangle(plot, buff=0.3)))\n        plots.arrange_in_grid(rows=2,buff=1)\n        self.add(plots)",
            "from manim import *\n\nclass FilledAngle(Scene):\n    def construct(self):\n        l1 = Line(ORIGIN, 2 * UP + RIGHT).set_color(GREEN)\n        l2 = (\n            Line(ORIGIN, 2 * UP + RIGHT)\n            .set_color(GREEN)\n            .rotate(-20 * DEGREES, about_point=ORIGIN)\n        )\n        norm = l1.get_length()\n        a1 = Angle(l1, l2, other_angle=True, radius=norm - 0.5).set_color(GREEN)\n        a2 = Angle(l1, l2, other_angle=True, radius=norm).set_color(GREEN)\n        q1 = a1.points #  save all coordinates of points of angle a1\n        q2 = a2.reverse_direction().points  #  save all coordinates of points of angle a1 (in reversed direction)\n        pnts = np.concatenate([q1, q2, q1[0].reshape(1, 3)])  # adds points and ensures that path starts and ends at same point\n        mfill = VMobject().set_color(ORANGE)\n        mfill.set_points_as_corners(pnts).set_fill(GREEN, opacity=1)\n        self.add(l1, l2)\n        self.add(mfill)"
        ]
    },
    "rightangle": {
        "parameters": {
            "line1": {
                "name": "line1",
                "description": "The first line.",
                "type": "Line"
            },
            "line2": {
                "name": "line2",
                "description": "The second line.",
                "type": "Line"
            },
            "length": {
                "name": "length",
                "description": "The length of the arms.",
                "default": "None",
                "type": "float | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass RightAngleExample(Scene):\n    def construct(self):\n        line1 = Line( LEFT, RIGHT )\n        line2 = Line( DOWN, UP )\n        rightangles = [\n            RightAngle(line1, line2),\n            RightAngle(line1, line2, length=0.4, quadrant=(1,-1)),\n            RightAngle(line1, line2, length=0.5, quadrant=(-1,1), stroke_width=8),\n            RightAngle(line1, line2, length=0.7, quadrant=(-1,-1), color=RED),\n        ]\n        plots = VGroup()\n        for rightangle in rightangles:\n            plot=VGroup(line1.copy(),line2.copy(), rightangle)\n            plots.add(plot)\n        plots.arrange(buff=1.5)\n        self.add(plots)"
        ]
    },
    "graph": {
        "parameters": {
            "vertices": {
                "name": "vertices",
                "description": "A list of vertices. Must be hashable elements."
            },
            "edges": {
                "name": "edges",
                "description": "A list of edges, specified as tuples ``(u, v)`` where both ``u`` and ``v`` are vertices. The vertex order is irrelevant."
            },
            "labels": {
                "name": "labels",
                "description": "Controls whether or not vertices are labeled. If ``False`` (the default), the vertices are not labeled; if ``True`` they are labeled using their names (as specified in ``vertices``) via :class:`~.MathTex`. Alternatively, custom labels can be specified by passing a dictionary whose keys are the vertices, and whose values are the corresponding vertex labels (rendered via, e.g., :class:`~.Text` or :class:`~.Tex`)."
            },
            "label_fill_color": {
                "name": "label_fill_color",
                "description": "Sets the fill color of the default labels generated when ``labels`` is set to ``True``. Has no effect for other values of ``labels``."
            },
            "layout": {
                "name": "layout",
                "description": "Either one of ``\"spring\"`` (the default), ``\"circular\"``, ``\"kamada_kawai\"``, ``\"planar\"``, ``\"random\"``, ``\"shell\"``, ``\"spectral\"``, ``\"spiral\"``, ``\"tree\"``, and ``\"partite\"`` for automatic vertex positioning using ``networkx`` (see `their documentation <https://networkx.org/documentation/stable/reference/drawing.html#module-networkx.drawing.layout>`_ for more details), or a dictionary specifying a coordinate (value) for each vertex (key) for manual positioning."
            },
            "layout_config": {
                "name": "layout_config",
                "description": "Only for automatically generated layouts. A dictionary whose entries are passed as keyword arguments to the automatic layout algorithm specified via ``layout`` of ``networkx``. The ``tree`` layout also accepts a special parameter ``vertex_spacing`` passed as a keyword argument inside the ``layout_config`` dictionary. Passing a tuple ``(space_x, space_y)`` as this argument overrides the value of ``layout_scale`` and ensures that vertices are arranged in a way such that the centers of siblings in the same layer are at least ``space_x`` units apart horizontally, and neighboring layers are spaced ``space_y`` units vertically."
            },
            "layout_scale": {
                "name": "layout_scale",
                "description": "The scale of automatically generated layouts: the vertices will be arranged such that the coordinates are located within the interval ``[-scale, scale]``. Some layouts accept a tuple ``(scale_x, scale_y)`` causing the first coordinate to be in the interval ``[-scale_x, scale_x]``, and the second in ``[-scale_y, scale_y]``. Default: 2."
            },
            "vertex_type": {
                "name": "vertex_type",
                "description": "The mobject class used for displaying vertices in the scene."
            },
            "vertex_config": {
                "name": "vertex_config",
                "description": "Either a dictionary containing keyword arguments to be passed to the class specified via ``vertex_type``, or a dictionary whose keys are the vertices, and whose values are dictionaries containing keyword arguments for the mobject related to the corresponding vertex."
            },
            "vertex_mobjects": {
                "name": "vertex_mobjects",
                "description": "A dictionary whose keys are the vertices, and whose values are mobjects to be used as vertices. Passing vertices here overrides all other configuration options for a vertex."
            },
            "edge_type": {
                "name": "edge_type",
                "description": "The mobject class used for displaying edges in the scene."
            },
            "edge_config": {
                "name": "edge_config",
                "description": "Either a dictionary containing keyword arguments to be passed to the class specified via ``edge_type``, or a dictionary whose keys are the edges, and whose values are dictionaries containing keyword arguments for the mobject related to the corresponding edge."
            }
        },
        "examples": [
            "from manim import *\n\nclass MovingVertices(Scene):\n    def construct(self):\n        vertices = [1, 2, 3, 4]\n        edges = [(1, 2), (2, 3), (3, 4), (1, 3), (1, 4)]\n        g = Graph(vertices, edges)\n        self.play(Create(g))\n        self.wait()\n        self.play(g[1].animate.move_to([1, 1, 0]),\n                  g[2].animate.move_to([-1, 1, 0]),\n                  g[3].animate.move_to([1, -1, 0]),\n                  g[4].animate.move_to([-1, -1, 0]))\n        self.wait()",
            "from manim import *\n\nclass GraphAutoPosition(Scene):\n    def construct(self):\n        vertices = [1, 2, 3, 4, 5, 6, 7, 8]\n        edges = [(1, 7), (1, 8), (2, 3), (2, 4), (2, 5),\n                 (2, 8), (3, 4), (6, 1), (6, 2),\n                 (6, 3), (7, 2), (7, 4)]\n        autolayouts = [\"spring\", \"circular\", \"kamada_kawai\",\n                       \"planar\", \"random\", \"shell\",\n                       \"spectral\", \"spiral\"]\n        graphs = [Graph(vertices, edges, layout=lt).scale(0.5)\n                  for lt in autolayouts]\n        r1 = VGroup(*graphs[:3]).arrange()\n        r2 = VGroup(*graphs[3:6]).arrange()\n        r3 = VGroup(*graphs[6:]).arrange()\n        self.add(VGroup(r1, r2, r3).arrange(direction=DOWN))",
            "from manim import *\n\nclass GraphManualPosition(Scene):\n    def construct(self):\n        vertices = [1, 2, 3, 4]\n        edges = [(1, 2), (2, 3), (3, 4), (4, 1)]\n        lt = {1: [0, 0, 0], 2: [1, 1, 0], 3: [1, -1, 0], 4: [-1, 0, 0]}\n        G = Graph(vertices, edges, layout=lt)\n        self.add(G)",
            "from manim import *\n\nclass LabeledModifiedGraph(Scene):\n    def construct(self):\n        vertices = [1, 2, 3, 4, 5, 6, 7, 8]\n        edges = [(1, 7), (1, 8), (2, 3), (2, 4), (2, 5),\n                 (2, 8), (3, 4), (6, 1), (6, 2),\n                 (6, 3), (7, 2), (7, 4)]\n        g = Graph(vertices, edges, layout=\"circular\", layout_scale=3,\n                  labels=True, vertex_config={7: {\"fill_color\": RED}},\n                  edge_config={(1, 7): {\"stroke_color\": RED},\n                               (2, 7): {\"stroke_color\": RED},\n                               (4, 7): {\"stroke_color\": RED}})\n        self.add(g)",
            "from manim import *\n\nclass PartiteGraph(Scene):\n    def construct(self):\n        G = nx.Graph()\n        G.add_nodes_from([0, 1, 2, 3])\n        G.add_edges_from([(0, 2), (0,3), (1, 2)])\n        graph = Graph(list(G.nodes), list(G.edges), layout=\"partite\", partitions=[[0, 1]])\n        self.play(Create(graph))",
            "from manim import *\n\nclass LinearNN(Scene):\n    def construct(self):\n        edges = []\n        partitions = []\n        c = 0\n        layers = [2, 3, 3, 2]  # the number of neurons in each layer\n        for i in layers:\n            partitions.append(list(range(c + 1, c + i + 1)))\n            c += i\n        for i, v in enumerate(layers[1:]):\n                last = sum(layers[:i+1])\n                for j in range(v):\n                    for k in range(last - layers[i], last):\n                        edges.append((k + 1, j + last + 1))\n        vertices = np.arange(1, sum(layers) + 1)\n        graph = Graph(\n            vertices,\n            edges,\n            layout='partite',\n            partitions=partitions,\n            layout_scale=3,\n            vertex_config={'radius': 0.20},\n        )\n        self.add(graph)",
            "from manim import *\n\nclass Tree(Scene):\n    def construct(self):\n        G = nx.Graph()\n        G.add_node(\"ROOT\")\n        for i in range(5):\n            G.add_node(\"Child_%i\" % i)\n            G.add_node(\"Grandchild_%i\" % i)\n            G.add_node(\"Greatgrandchild_%i\" % i)\n            G.add_edge(\"ROOT\", \"Child_%i\" % i)\n            G.add_edge(\"Child_%i\" % i, \"Grandchild_%i\" % i)\n            G.add_edge(\"Grandchild_%i\" % i, \"Greatgrandchild_%i\" % i)\n        self.play(Create(\n            Graph(list(G.nodes), list(G.edges), layout=\"tree\", root_vertex=\"ROOT\")))"
        ]
    },
    "digraph": {
        "parameters": {
            "vertices": {
                "name": "vertices",
                "description": "A list of vertices. Must be hashable elements."
            },
            "edges": {
                "name": "edges",
                "description": "A list of edges, specified as tuples ``(u, v)`` where both ``u`` and ``v`` are vertices. The edge is directed from ``u`` to ``v``."
            },
            "labels": {
                "name": "labels",
                "description": "Controls whether or not vertices are labeled. If ``False`` (the default), the vertices are not labeled; if ``True`` they are labeled using their names (as specified in ``vertices``) via :class:`~.MathTex`. Alternatively, custom labels can be specified by passing a dictionary whose keys are the vertices, and whose values are the corresponding vertex labels (rendered via, e.g., :class:`~.Text` or :class:`~.Tex`)."
            },
            "label_fill_color": {
                "name": "label_fill_color",
                "description": "Sets the fill color of the default labels generated when ``labels`` is set to ``True``. Has no effect for other values of ``labels``."
            },
            "layout": {
                "name": "layout",
                "description": "Either one of ``\"spring\"`` (the default), ``\"circular\"``, ``\"kamada_kawai\"``, ``\"planar\"``, ``\"random\"``, ``\"shell\"``, ``\"spectral\"``, ``\"spiral\"``, ``\"tree\"``, and ``\"partite\"`` for automatic vertex positioning using ``networkx`` (see `their documentation <https://networkx.org/documentation/stable/reference/drawing.html#module-networkx.drawing.layout>`_ for more details), or a dictionary specifying a coordinate (value) for each vertex (key) for manual positioning."
            },
            "layout_config": {
                "name": "layout_config",
                "description": "Only for automatically generated layouts. A dictionary whose entries are passed as keyword arguments to the automatic layout algorithm specified via ``layout`` of ``networkx``. The ``tree`` layout also accepts a special parameter ``vertex_spacing`` passed as a keyword argument inside the ``layout_config`` dictionary. Passing a tuple ``(space_x, space_y)`` as this argument overrides the value of ``layout_scale`` and ensures that vertices are arranged in a way such that the centers of siblings in the same layer are at least ``space_x`` units apart horizontally, and neighboring layers are spaced ``space_y`` units vertically."
            },
            "layout_scale": {
                "name": "layout_scale",
                "description": "The scale of automatically generated layouts: the vertices will be arranged such that the coordinates are located within the interval ``[-scale, scale]``. Some layouts accept a tuple ``(scale_x, scale_y)`` causing the first coordinate to be in the interval ``[-scale_x, scale_x]``, and the second in ``[-scale_y, scale_y]``. Default: 2."
            },
            "vertex_type": {
                "name": "vertex_type",
                "description": "The mobject class used for displaying vertices in the scene."
            },
            "vertex_config": {
                "name": "vertex_config",
                "description": "Either a dictionary containing keyword arguments to be passed to the class specified via ``vertex_type``, or a dictionary whose keys are the vertices, and whose values are dictionaries containing keyword arguments for the mobject related to the corresponding vertex."
            },
            "vertex_mobjects": {
                "name": "vertex_mobjects",
                "description": "A dictionary whose keys are the vertices, and whose values are mobjects to be used as vertices. Passing vertices here overrides all other configuration options for a vertex."
            },
            "edge_type": {
                "name": "edge_type",
                "description": "The mobject class used for displaying edges in the scene."
            },
            "edge_config": {
                "name": "edge_config",
                "description": "Either a dictionary containing keyword arguments to be passed to the class specified via ``edge_type``, or a dictionary whose keys are the edges, and whose values are dictionaries containing keyword arguments for the mobject related to the corresponding edge. You can further customize the tip by adding a ``tip_config`` dictionary for global styling, or by adding the dict to a specific ``edge_config``."
            }
        },
        "examples": [
            "from manim import *\n\nclass MovingDiGraph(Scene):\n    def construct(self):\n        vertices = [1, 2, 3, 4]\n        edges = [(1, 2), (2, 3), (3, 4), (1, 3), (1, 4)]\n        g = DiGraph(vertices, edges)\n        self.add(g)\n        self.play(\n            g[1].animate.move_to([1, 1, 1]),\n            g[2].animate.move_to([-1, 1, 2]),\n            g[3].animate.move_to([1, -1, -1]),\n            g[4].animate.move_to([-1, -1, 0]),\n        )\n        self.wait()",
            "from manim import *\n\nclass CustomDiGraph(Scene):\n    def construct(self):\n        vertices = [i for i in range(5)]\n        edges = [\n            (0, 1),\n            (1, 2),\n            (3, 2),\n            (3, 4),\n        ]\n        edge_config = {\n            \"stroke_width\": 2,\n            \"tip_config\": {\n                \"tip_shape\": ArrowSquareTip,\n                \"tip_length\": 0.15,\n            },\n            (3, 4): {\n                \"color\": RED,\n                \"tip_config\": {\"tip_length\": 0.25, \"tip_width\": 0.25}\n            },\n        }\n        g = DiGraph(\n            vertices,\n            edges,\n            labels=True,\n            layout=\"circular\",\n            edge_config=edge_config,\n        ).scale(1.4)\n        self.play(Create(g))\n        self.wait()",
            "from manim import *\n\nclass UndirectedMovingDiGraph(Scene):\n    def construct(self):\n        vertices = [i for i in range(5)]\n        edges = [\n            (0, 1),\n            (1, 2),\n            (3, 2),\n            (3, 4),\n        ]\n        edge_config = {\n            \"stroke_width\": 2,\n            \"tip_config\": {\"tip_length\": 0, \"tip_width\": 0},\n            (3, 4): {\"color\": RED},\n        }\n        g = DiGraph(\n            vertices,\n            edges,\n            labels=True,\n            layout=\"circular\",\n            edge_config=edge_config,\n        ).scale(1.4)\n        self.play(Create(g))\n        self.wait()\n        self.play(\n            g[1].animate.move_to([1, 1, 1]),\n            g[2].animate.move_to([-1, 1, 2]),\n            g[3].animate.move_to([-1.5, -1.5, -1]),\n            g[4].animate.move_to([1, -2, -1]),\n        )\n        self.wait()"
        ]
    },
    "code": {
        "parameters": {
            "code_file": {
                "name": "code_file",
                "description": "The path to the code file to display.",
                "default": "None",
                "type": "StrPath | None"
            },
            "code_string": {
                "name": "code_string",
                "description": "Alternatively, the code string to display.",
                "default": "None",
                "type": "str | None"
            },
            "language": {
                "name": "language",
                "description": "The programming language of the code. If not specified, it will be guessed from the file extension or the code itself.",
                "default": "None",
                "type": "str | None"
            },
            "formatter_style": {
                "name": "formatter_style",
                "description": "The style to use for the code highlighting. Defaults to ``\"vim\"``. A list of all available styles can be obtained by calling :meth:`.Code.get_styles_list`.",
                "default": "'vim'",
                "type": "str"
            },
            "tab_width": {
                "name": "tab_width",
                "description": "The width of a tab character in spaces. Defaults to 4.",
                "default": "4",
                "type": "int"
            },
            "add_line_numbers": {
                "name": "add_line_numbers",
                "description": "Whether to display line numbers. Defaults to ``True``.",
                "default": "True",
                "type": "bool"
            },
            "line_numbers_from": {
                "name": "line_numbers_from",
                "description": "The first line number to display. Defaults to 1.",
                "default": "1",
                "type": "int"
            },
            "background": {
                "name": "background",
                "description": "The type of background to use. Can be either ``\"rectangle\"`` (the default) or ``\"window\"``.",
                "default": "'rectangle'",
                "type": "Literal['rectangle', 'window']"
            },
            "background_config": {
                "name": "background_config",
                "description": "Keyword arguments passed to the background constructor. Default settings are stored in the class attribute :attr:`.default_background_config` (which can also be modified directly).",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "paragraph_config": {
                "name": "paragraph_config",
                "description": "Keyword arguments passed to the constructor of the :class:`.Paragraph` objects holding the code, and the line numbers. Default settings are stored in the class attribute :attr:`.default_paragraph_config` (which can also be modified directly).",
                "default": "None",
                "type": "dict[str, Any] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass CodeFromString(Scene):\n    def construct(self):\n        code = '''from manim import Scene, Square\nclass FadeInSquare(Scene):\n    def construct(self):\n        s = Square()\n        self.play(FadeIn(s))\n        self.play(s.animate.scale(2))\n        self.wait()'''\n        rendered_code = Code(\n            code_string=code,\n            language=\"python\",\n            background=\"window\",\n            background_config={\"stroke_color\": \"maroon\"},\n        )\n        self.add(rendered_code)"
        ]
    },
    "decimalnumber": {
        "parameters": {
            "number": {
                "name": "number",
                "description": "The numeric value to be displayed. It can later be modified using :meth:`.set_value`.",
                "default": "0",
                "type": "float"
            },
            "num_decimal_places": {
                "name": "num_decimal_places",
                "description": "The number of decimal places after the decimal separator. Values are automatically rounded.",
                "default": "2",
                "type": "int"
            },
            "mob_class": {
                "name": "mob_class",
                "description": "The class for rendering digits and units, by default :class:`.MathTex`.",
                "default": "MathTex",
                "type": "type[SingleStringMathTex]"
            },
            "include_sign": {
                "name": "include_sign",
                "description": "Set to ``True`` to include a sign for positive numbers and zero.",
                "default": "False",
                "type": "bool"
            },
            "group_with_commas": {
                "name": "group_with_commas",
                "description": "When ``True`` thousands groups are separated by commas for readability.",
                "default": "True",
                "type": "bool"
            },
            "digit_buff_per_font_unit": {
                "name": "digit_buff_per_font_unit",
                "description": "Additional spacing between digits. Scales with font size.",
                "default": "0.001",
                "type": "float"
            },
            "show_ellipsis": {
                "name": "show_ellipsis",
                "description": "When a number has been truncated by rounding, indicate with an ellipsis (``...``).",
                "default": "False",
                "type": "bool"
            },
            "unit": {
                "name": "unit",
                "description": "A unit string which can be placed to the right of the numerical values.",
                "default": "None",
                "type": "str | None"
            },
            "unit_buff_per_font_unit": {
                "name": "unit_buff_per_font_unit",
                "description": "An additional spacing between the numerical values and the unit. A value of ``unit_buff_per_font_unit=0.003`` gives a decent spacing. Scales with font size.",
                "default": "0",
                "type": "float"
            },
            "include_background_rectangle": {
                "name": "include_background_rectangle",
                "description": "Adds a background rectangle to increase contrast on busy scenes.",
                "default": "False",
                "type": "bool"
            },
            "edge_to_fix": {
                "name": "edge_to_fix",
                "description": "Assuring right- or left-alignment of the full object.",
                "default": "LEFT",
                "type": "Vector3DLike"
            },
            "font_size": {
                "name": "font_size",
                "description": "Size of the font.",
                "default": "DEFAULT_FONT_SIZE",
                "type": "float"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "fill_opacity": {
                "name": "fill_opacity",
                "description": "",
                "default": "1.0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass MovingSquareWithUpdaters(Scene):\n    def construct(self):\n        decimal = DecimalNumber(\n            0,\n            show_ellipsis=True,\n            num_decimal_places=3,\n            include_sign=True,\n            unit=r\"\\text{M-Units}\",\n            unit_buff_per_font_unit=0.003\n        )\n        square = Square().to_edge(UP)\n        decimal.add_updater(lambda d: d.next_to(square, RIGHT))\n        decimal.add_updater(lambda d: d.set_value(square.get_center()[1]))\n        self.add(square, decimal)\n        self.play(\n            square.animate.to_edge(DOWN),\n            rate_func=there_and_back,\n            run_time=5,\n        )\n        self.wait()"
        ]
    },
    "integer": {
        "parameters": {
            "number": {
                "name": "number",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "num_decimal_places": {
                "name": "num_decimal_places",
                "description": "",
                "default": "0",
                "type": "int"
            }
        },
        "examples": [
            "from manim import *\n\nclass IntegerExample(Scene):\n    def construct(self):\n        self.add(Integer(number=2.5).set_color(ORANGE).scale(2.5).set_x(-0.5).set_y(0.8))\n        self.add(Integer(number=3.14159, show_ellipsis=True).set_x(3).set_y(3.3).scale(3.14159))\n        self.add(Integer(number=42).set_x(2.5).set_y(-2.3).set_color_by_gradient(BLUE, TEAL).scale(1.7))\n        self.add(Integer(number=6.28).set_x(-1.5).set_y(-2).set_color(YELLOW).scale(1.4))"
        ]
    },
    "variable": {
        "parameters": {
            "var": {
                "name": "var",
                "description": "The initial value you need to keep track of and display.",
                "type": "float"
            },
            "label": {
                "name": "label",
                "description": "The label for your variable. Raw strings are convertex to :class:`~.MathTex` objects.",
                "type": "str | Tex | MathTex | Text | SingleStringMathTex"
            },
            "var_type": {
                "name": "var_type",
                "description": "The class used for displaying the number. Defaults to :class:`DecimalNumber`.",
                "default": "DecimalNumber",
                "type": "type[DecimalNumber | Integer]"
            },
            "num_decimal_places": {
                "name": "num_decimal_places",
                "description": "The number of decimal places to display in your variable. Defaults to 2. If `var_type` is an :class:`Integer`, this parameter is ignored.",
                "default": "2",
                "type": "int"
            }
        },
        "examples": [
            "from manim import *\n\nclass VariablesWithValueTracker(Scene):\n    def construct(self):\n        var = 0.5\n        on_screen_var = Variable(var, Text(\"var\"), num_decimal_places=3)\n        # You can also change the colours for the label and value\n        on_screen_var.label.set_color(RED)\n        on_screen_var.value.set_color(GREEN)\n        self.play(Write(on_screen_var))\n        # The above line will just display the variable with\n        # its initial value on the screen. If you also wish to\n        # update it, you can do so by accessing the `tracker` attribute\n        self.wait()\n        var_tracker = on_screen_var.tracker\n        var = 10.5\n        self.play(var_tracker.animate.set_value(var))\n        self.wait()\n        int_var = 0\n        on_screen_int_var = Variable(\n            int_var, Text(\"int_var\"), var_type=Integer\n        ).next_to(on_screen_var, DOWN)\n        on_screen_int_var.label.set_color(RED)\n        on_screen_int_var.value.set_color(GREEN)\n        self.play(Write(on_screen_int_var))\n        self.wait()\n        var_tracker = on_screen_int_var.tracker\n        var = 10.5\n        self.play(var_tracker.animate.set_value(var))\n        self.wait()\n        # If you wish to have a somewhat more complicated label for your\n        # variable with subscripts, superscripts, etc. the default class\n        # for the label is MathTex\n        subscript_label_var = 10\n        on_screen_subscript_var = Variable(subscript_label_var, \"{a}_{i}\").next_to(\n            on_screen_int_var, DOWN\n        )\n        self.play(Write(on_screen_subscript_var))\n        self.wait()",
            "from manim import *\n\nclass VariableExample(Scene):\n    def construct(self):\n        start = 2.0\n        x_var = Variable(start, 'x', num_decimal_places=3)\n        sqr_var = Variable(start**2, 'x^2', num_decimal_places=3)\n        Group(x_var, sqr_var).arrange(DOWN)\n        sqr_var.add_updater(lambda v: v.tracker.set_value(x_var.tracker.get_value()**2))\n        self.add(x_var, sqr_var)\n        self.play(x_var.tracker.animate.set_value(5), run_time=2, rate_func=linear)\n        self.wait(0.1)"
        ]
    },
    "axes": {
        "parameters": {
            "x_range": {
                "name": "x_range",
                "description": "The ``(x_min, x_max, x_step)`` values of the x-axis.",
                "default": "None",
                "type": "Sequence[float] | None"
            },
            "y_range": {
                "name": "y_range",
                "description": "The ``(y_min, y_max, y_step)`` values of the y-axis.",
                "default": "None",
                "type": "Sequence[float] | None"
            },
            "x_length": {
                "name": "x_length",
                "description": "The length of the x-axis.",
                "default": "round(config.frame_width) - 2",
                "type": "float | None"
            },
            "y_length": {
                "name": "y_length",
                "description": "The length of the y-axis.",
                "default": "round(config.frame_height) - 2",
                "type": "float | None"
            },
            "axis_config": {
                "name": "axis_config",
                "description": "Arguments to be passed to :class:`~.NumberLine` that influences both axes.",
                "default": "None",
                "type": "dict | None"
            },
            "x_axis_config": {
                "name": "x_axis_config",
                "description": "Arguments to be passed to :class:`~.NumberLine` that influence the x-axis.",
                "default": "None",
                "type": "dict | None"
            },
            "y_axis_config": {
                "name": "y_axis_config",
                "description": "Arguments to be passed to :class:`~.NumberLine` that influence the y-axis.",
                "default": "None",
                "type": "dict | None"
            },
            "tips": {
                "name": "tips",
                "description": "Whether or not to include the tips on both axes.",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass LogScalingExample(Scene):\n    def construct(self):\n        ax = Axes(\n            x_range=[0, 10, 1],\n            y_range=[-2, 6, 1],\n            tips=False,\n            axis_config={\"include_numbers\": True},\n            y_axis_config={\"scaling\": LogBase(custom_labels=True)},\n        )\n        # x_min must be > 0 because log is undefined at 0.\n        graph = ax.plot(lambda x: x ** 2, x_range=[0.001, 10], use_smoothing=False)\n        self.add(ax, graph)",
            "from manim import *\n\nclass AxesWithDifferentTips(Scene):\n    def construct(self):\n        ax = Axes(axis_config={'tip_shape': StealthTip})\n        self.add(ax)"
        ]
    },
    "threedaxes": {
        "parameters": {
            "x_range": {
                "name": "x_range",
                "description": "The ``[x_min, x_max, x_step]`` values of the x-axis.",
                "default": "(-6, 6, 1)",
                "type": "Sequence[float] | None"
            },
            "y_range": {
                "name": "y_range",
                "description": "The ``[y_min, y_max, y_step]`` values of the y-axis.",
                "default": "(-5, 5, 1)",
                "type": "Sequence[float] | None"
            },
            "z_range": {
                "name": "z_range",
                "description": "The ``[z_min, z_max, z_step]`` values of the z-axis.",
                "default": "(-4, 4, 1)",
                "type": "Sequence[float] | None"
            },
            "x_length": {
                "name": "x_length",
                "description": "The length of the x-axis.",
                "default": "config.frame_height + 2.5",
                "type": "float | None"
            },
            "y_length": {
                "name": "y_length",
                "description": "The length of the y-axis.",
                "default": "config.frame_height + 2.5",
                "type": "float | None"
            },
            "z_length": {
                "name": "z_length",
                "description": "The length of the z-axis.",
                "default": "config.frame_height - 1.5",
                "type": "float | None"
            },
            "z_axis_config": {
                "name": "z_axis_config",
                "description": "Arguments to be passed to :class:`~.NumberLine` that influence the z-axis.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "z_normal": {
                "name": "z_normal",
                "description": "The direction of the normal.",
                "default": "DOWN",
                "type": "Vector3DLike"
            },
            "num_axis_pieces": {
                "name": "num_axis_pieces",
                "description": "The number of pieces used to construct the axes.",
                "default": "20",
                "type": "int"
            },
            "light_source": {
                "name": "light_source",
                "description": "The direction of the light source.",
                "default": "9 * DOWN + 7 * LEFT + 10 * OUT",
                "type": "Point3DLike"
            },
            "depth": {
                "name": "depth",
                "description": "Currently non-functional.",
                "default": "None",
                "type": "Any"
            },
            "gloss": {
                "name": "gloss",
                "description": "Currently non-functional.",
                "default": "0.5",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass ThreeDAxesExample(ThreeDScene):\n    def construct(self):\n        axes = ThreeDAxes()\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        self.add(axes)"
        ]
    },
    "numberplane": {
        "parameters": {
            "x_range": {
                "name": "x_range",
                "description": "The ``[x_min, x_max, x_step]`` values of the plane in the horizontal direction.",
                "default": "(-config['frame_x_radius'], config['frame_x_radius'], 1)",
                "type": "Sequence[float] | None"
            },
            "y_range": {
                "name": "y_range",
                "description": "The ``[y_min, y_max, y_step]`` values of the plane in the vertical direction.",
                "default": "(-config['frame_y_radius'], config['frame_y_radius'], 1)",
                "type": "Sequence[float] | None"
            },
            "x_length": {
                "name": "x_length",
                "description": "The width of the plane.",
                "default": "None",
                "type": "float | None"
            },
            "y_length": {
                "name": "y_length",
                "description": "The height of the plane.",
                "default": "None",
                "type": "float | None"
            },
            "background_line_style": {
                "name": "background_line_style",
                "description": "Arguments that influence the construction of the background lines of the plane.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "faded_line_style": {
                "name": "faded_line_style",
                "description": "Similar to :attr:`background_line_style`, affects the construction of the scene's background lines.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "faded_line_ratio": {
                "name": "faded_line_ratio",
                "description": "Determines the number of boxes within the background lines: :code:`2` = 4 boxes, :code:`3` = 9 boxes.",
                "default": "1",
                "type": "int"
            },
            "make_smooth_after_applying_functions": {
                "name": "make_smooth_after_applying_functions",
                "description": "Currently non-functional.",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass NumberPlaneExample(Scene):\n    def construct(self):\n        number_plane = NumberPlane(\n            background_line_style={\n                \"stroke_color\": TEAL,\n                \"stroke_width\": 4,\n                \"stroke_opacity\": 0.6\n            }\n        )\n        self.add(number_plane)",
            "from manim import *\n\nclass NumberPlaneScaled(Scene):\n    def construct(self):\n        number_plane = NumberPlane(\n            x_range=(-4, 11, 1),\n            y_range=(-3, 3, 1),\n            x_length=5,\n            y_length=2,\n        ).move_to(LEFT*3)\n        number_plane_scaled_y = NumberPlane(\n            x_range=(-4, 11, 1),\n            x_length=5,\n            y_length=4,\n        ).move_to(RIGHT*3)\n        self.add(number_plane)\n        self.add(number_plane_scaled_y)"
        ]
    },
    "polarplane": {
        "parameters": {
            "radius_max": {
                "name": "radius_max",
                "description": "The maximum value of the radius.",
                "default": "config['frame_y_radius']",
                "type": "float"
            },
            "size": {
                "name": "size",
                "description": "The diameter of the plane.",
                "default": "None",
                "type": "float | None"
            },
            "radius_step": {
                "name": "radius_step",
                "description": "The distance between faded radius lines.",
                "default": "1",
                "type": "float"
            },
            "azimuth_step": {
                "name": "azimuth_step",
                "description": "The number of divisions in the azimuth (also known as the `angular coordinate` or `polar angle`). If ``None`` is specified then it will use the default specified by ``azimuth_units``: - ``\"PI radians\"`` or ``\"TAU radians\"``: 20 - ``\"degrees\"``: 36 - ``\"gradians\"``: 40 - ``None``: 1 A non-integer value will result in a partial division at the end of the circle.",
                "default": "None",
                "type": "float | None"
            },
            "azimuth_units": {
                "name": "azimuth_units",
                "description": "Specifies a default labelling system for the azimuth. Choices are: - ``\"PI radians\"``: Fractional labels in the interval :math:`\\left[0, 2\\pi\\right]` with :math:`\\pi` as a constant. - ``\"TAU radians\"``: Fractional labels in the interval :math:`\\left[0, \\tau\\right]` (where :math:`\\tau = 2\\pi`) with :math:`\\tau` as a constant. - ``\"degrees\"``: Decimal labels in the interval :math:`\\left[0, 360\\right]` with a degree (:math:`^{\\circ}`) symbol. - ``\"gradians\"``: Decimal labels in the interval :math:`\\left[0, 400\\right]` with a superscript \"g\" (:math:`^{g}`). - ``None``: Decimal labels in the interval :math:`\\left[0, 1\\right]`.",
                "default": "'PI radians'",
                "type": "str"
            },
            "azimuth_compact_fraction": {
                "name": "azimuth_compact_fraction",
                "description": "If the ``azimuth_units`` choice has fractional labels, choose whether to combine the constant in a compact form :math:`\\tfrac{xu}{y}` as opposed to :math:`\\tfrac{x}{y}u`, where :math:`u` is the constant.",
                "default": "True",
                "type": "bool"
            },
            "azimuth_offset": {
                "name": "azimuth_offset",
                "description": "The angle offset of the azimuth, expressed in radians.",
                "default": "0",
                "type": "float"
            },
            "azimuth_direction": {
                "name": "azimuth_direction",
                "description": "The direction of the azimuth. - ``\"CW\"``: Clockwise. - ``\"CCW\"``: Anti-clockwise.",
                "default": "'CCW'",
                "type": "str"
            },
            "azimuth_label_buff": {
                "name": "azimuth_label_buff",
                "description": "The buffer for the azimuth labels.",
                "default": "SMALL_BUFF",
                "type": "float"
            },
            "azimuth_label_font_size": {
                "name": "azimuth_label_font_size",
                "description": "The font size of the azimuth labels.",
                "default": "24",
                "type": "float"
            },
            "radius_config": {
                "name": "radius_config",
                "description": "The axis config for the radius.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "background_line_style": {
                "name": "background_line_style",
                "description": "",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "faded_line_style": {
                "name": "faded_line_style",
                "description": "",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "faded_line_ratio": {
                "name": "faded_line_ratio",
                "description": "",
                "default": "1",
                "type": "int"
            },
            "make_smooth_after_applying_functions": {
                "name": "make_smooth_after_applying_functions",
                "description": "",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass PolarPlaneExample(Scene):\n    def construct(self):\n        polarplane_pi = PolarPlane(\n            azimuth_units=\"PI radians\",\n            size=6,\n            azimuth_label_font_size=33.6,\n            radius_config={\"font_size\": 33.6},\n        ).add_coordinates()\n        self.add(polarplane_pi)"
        ]
    },
    "complexplane": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass ComplexPlaneExample(Scene):\n    def construct(self):\n        plane = ComplexPlane().add_coordinates()\n        self.add(plane)\n        d1 = Dot(plane.n2p(2 + 1j), color=YELLOW)\n        d2 = Dot(plane.n2p(-3 - 2j), color=YELLOW)\n        label1 = MathTex(\"2+i\").next_to(d1, UR, 0.1)\n        label2 = MathTex(\"-3-2i\").next_to(d2, UR, 0.1)\n        self.add(\n            d1,\n            label1,\n            d2,\n            label2,\n        )"
        ]
    },
    "polygon": {
        "parameters": {
            "vertices": {
                "name": "vertices",
                "description": "The vertices of the :class:`Polygon`."
            },
            "kwargs": {
                "name": "kwargs",
                "description": "Forwarded to the parent constructor."
            }
        },
        "examples": [
            "from manim import *\n\nclass PolygonExample(Scene):\n    def construct(self):\n        isosceles = Polygon([-5, 1.5, 0], [-2, 1.5, 0], [-3.5, -2, 0])\n        position_list = [\n            [4, 1, 0],  # middle right\n            [4, -2.5, 0],  # bottom right\n            [0, -2.5, 0],  # bottom left\n            [0, 3, 0],  # top left\n            [2, 1, 0],  # middle\n            [4, 3, 0],  # top right\n        ]\n        square_and_triangles = Polygon(*position_list, color=PURPLE_B)\n        self.add(isosceles, square_and_triangles)"
        ]
    },
    "regularpolygon": {
        "parameters": {
            "n": {
                "name": "n",
                "description": "The number of sides of the :class:`RegularPolygon`.",
                "default": "6",
                "type": "int"
            }
        },
        "examples": [
            "from manim import *\n\nclass RegularPolygonExample(Scene):\n    def construct(self):\n        poly_1 = RegularPolygon(n=6)\n        poly_2 = RegularPolygon(n=6, start_angle=30*DEGREES, color=GREEN)\n        poly_3 = RegularPolygon(n=10, color=RED)\n        poly_group = Group(poly_1, poly_2, poly_3).scale(1.5).arrange(buff=1)\n        self.add(poly_group)"
        ]
    },
    "star": {
        "parameters": {
            "n": {
                "name": "n",
                "description": "How many points on the :class:`Star`.",
                "default": "5",
                "type": "int"
            }
        },
        "examples": [
            "from manim import *\n\nclass StarExample(Scene):\n    def construct(self):\n        pentagram = RegularPolygram(5, radius=2)\n        star = Star(outer_radius=2, color=RED)\n        self.add(pentagram)\n        self.play(Create(star), run_time=3)\n        self.play(FadeOut(star), run_time=2)",
            "from manim import *\n\nclass DifferentDensitiesExample(Scene):\n    def construct(self):\n        density_2 = Star(7, outer_radius=2, density=2, color=RED)\n        density_3 = Star(7, outer_radius=2, density=3, color=PURPLE)\n        self.add(VGroup(density_2, density_3).arrange(RIGHT))"
        ]
    },
    "triangle": {
        "parameters": {
            "kwargs": {
                "name": "kwargs",
                "description": "Additional arguments to be passed to :class:`RegularPolygon`"
            }
        },
        "examples": [
            "from manim import *\n\nclass TriangleExample(Scene):\n    def construct(self):\n        triangle_1 = Triangle()\n        triangle_2 = Triangle().scale(2).rotate(60*DEGREES)\n        tri_group = Group(triangle_1, triangle_2).arrange(buff=1)\n        self.add(tri_group)"
        ]
    },
    "rectangle": {
        "parameters": {
            "color": {
                "name": "color",
                "description": "The color of the rectangle.",
                "default": "WHITE",
                "type": "ParsableManimColor"
            },
            "height": {
                "name": "height",
                "description": "The vertical height of the rectangle.",
                "default": "2.0",
                "type": "float"
            },
            "width": {
                "name": "width",
                "description": "The horizontal width of the rectangle.",
                "default": "4.0",
                "type": "float"
            },
            "grid_xstep": {
                "name": "grid_xstep",
                "description": "Space between vertical grid lines.",
                "default": "None",
                "type": "float | None"
            },
            "grid_ystep": {
                "name": "grid_ystep",
                "description": "Space between horizontal grid lines.",
                "default": "None",
                "type": "float | None"
            },
            "mark_paths_closed": {
                "name": "mark_paths_closed",
                "description": "No purpose.",
                "default": "True",
                "type": "bool"
            },
            "close_new_points": {
                "name": "close_new_points",
                "description": "No purpose.",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass RectangleExample(Scene):\n    def construct(self):\n        rect1 = Rectangle(width=4.0, height=2.0, grid_xstep=1.0, grid_ystep=0.5)\n        rect2 = Rectangle(width=1.0, height=4.0)\n        rect3 = Rectangle(width=2.0, height=2.0, grid_xstep=1.0, grid_ystep=1.0)\n        rect3.grid_lines.set_stroke(width=1)\n        rects = Group(rect1, rect2, rect3).arrange(buff=1)\n        self.add(rects)"
        ]
    },
    "square": {
        "parameters": {
            "side_length": {
                "name": "side_length",
                "description": "The length of the sides of the square.",
                "default": "2.0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass SquareExample(Scene):\n    def construct(self):\n        square_1 = Square(side_length=2.0).shift(DOWN)\n        square_2 = Square(side_length=1.0).next_to(square_1, direction=UP)\n        square_3 = Square(side_length=0.5).next_to(square_2, direction=UP)\n        self.add(square_1, square_2, square_3)"
        ]
    },
    "roundedrectangle": {
        "parameters": {
            "corner_radius": {
                "name": "corner_radius",
                "description": "The curvature of the corners of the rectangle.",
                "default": "0.5",
                "type": "float | list[float]"
            }
        },
        "examples": [
            "from manim import *\n\nclass RoundedRectangleExample(Scene):\n    def construct(self):\n        rect_1 = RoundedRectangle(corner_radius=0.5)\n        rect_2 = RoundedRectangle(corner_radius=1.5, height=4.0, width=4.0)\n        rect_group = Group(rect_1, rect_2).arrange(buff=1)\n        self.add(rect_group)"
        ]
    },
    "vgroup": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass ArcShapeIris(Scene):\n    def construct(self):\n        colors = [DARK_BROWN, BLUE_E, BLUE_D, BLUE_A, TEAL_B, GREEN_B, YELLOW_E]\n        radius = [1 + rad * 0.1 for rad in range(len(colors))]\n        circles_group = VGroup()\n        # zip(radius, color) makes the iterator [(radius[i], color[i]) for i in range(radius)]\n        circles_group.add(*[Circle(radius=rad, stroke_width=10, color=col)\n                            for rad, col in zip(radius, colors)])\n        self.add(circles_group)"
        ]
    },
    "paragraph": {
        "parameters": {
            "line_spacing": {
                "name": "line_spacing",
                "description": "Represents the spacing between lines. Defaults to -1, which means auto."
            },
            "alignment": {
                "name": "alignment",
                "description": "Defines the alignment of paragraph. Defaults to None. Possible values are \"left\", \"right\" or \"center\"."
            }
        },
        "examples": [
            "from manim import *\n\nclass ParagraphExample(Scene):\n    def construct(self):\n        p = Paragraph(\"This is a line\", \"This is another line\", alignment=\"center\")\n        self.add(p)"
        ]
    },
    "text": {
        "parameters": {
            "text": {
                "name": "text",
                "description": "The text that needs to be created as a mobject.",
                "type": "str"
            },
            "fill_opacity": {
                "name": "fill_opacity",
                "description": "",
                "default": "1.0",
                "type": "float"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "",
                "default": "None",
                "type": "ParsableManimColor | None"
            },
            "font_size": {
                "name": "font_size",
                "description": "",
                "default": "DEFAULT_FONT_SIZE",
                "type": "float"
            },
            "line_spacing": {
                "name": "line_spacing",
                "description": "",
                "default": "-1",
                "type": "float"
            },
            "font": {
                "name": "font",
                "description": "The font family to be used to render the text. This is either a system font or one loaded with `register_font()`. Note that font family names may be different across operating systems.",
                "default": "''",
                "type": "str"
            },
            "slant": {
                "name": "slant",
                "description": "",
                "default": "NORMAL",
                "type": "str"
            },
            "weight": {
                "name": "weight",
                "description": "",
                "default": "NORMAL",
                "type": "str"
            },
            "t2c": {
                "name": "t2c",
                "description": "",
                "default": "None",
                "type": "dict[str, str] | None"
            },
            "t2f": {
                "name": "t2f",
                "description": "",
                "default": "None",
                "type": "dict[str, str] | None"
            },
            "t2g": {
                "name": "t2g",
                "description": "",
                "default": "None",
                "type": "dict[str, Iterable[ParsableManimColor]] | None"
            },
            "t2s": {
                "name": "t2s",
                "description": "",
                "default": "None",
                "type": "dict[str, str] | None"
            },
            "t2w": {
                "name": "t2w",
                "description": "",
                "default": "None",
                "type": "dict[str, str] | None"
            },
            "gradient": {
                "name": "gradient",
                "description": "",
                "default": "None",
                "type": "Iterable[ParsableManimColor] | None"
            },
            "tab_width": {
                "name": "tab_width",
                "description": "",
                "default": "4",
                "type": "int"
            },
            "warn_missing_font": {
                "name": "warn_missing_font",
                "description": "If True (default), Manim will issue a warning if the font does not exist in the (case-sensitive) list of fonts returned from `manimpango.list_fonts()`.",
                "default": "True",
                "type": "bool"
            },
            "height": {
                "name": "height",
                "description": "",
                "default": "None",
                "type": "float | None"
            },
            "width": {
                "name": "width",
                "description": "",
                "default": "None",
                "type": "float | None"
            },
            "should_center": {
                "name": "should_center",
                "description": "",
                "default": "True",
                "type": "bool"
            },
            "disable_ligatures": {
                "name": "disable_ligatures",
                "description": "",
                "default": "False",
                "type": "bool"
            },
            "use_svg_cache": {
                "name": "use_svg_cache",
                "description": "",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass Example1Text(Scene):\n    def construct(self):\n        text = Text('Hello world').scale(3)\n        self.add(text)",
            "from manim import *\n\nclass TextColorExample(Scene):\n    def construct(self):\n        text1 = Text('Hello world', color=BLUE).scale(3)\n        text2 = Text('Hello world', gradient=(BLUE, GREEN)).scale(3).next_to(text1, DOWN)\n        self.add(text1, text2)",
            "from manim import *\n\nclass TextItalicAndBoldExample(Scene):\n    def construct(self):\n        text1 = Text(\"Hello world\", slant=ITALIC)\n        text2 = Text(\"Hello world\", t2s={'world':ITALIC})\n        text3 = Text(\"Hello world\", weight=BOLD)\n        text4 = Text(\"Hello world\", t2w={'world':BOLD})\n        text5 = Text(\"Hello world\", t2c={'o':YELLOW}, disable_ligatures=True)\n        text6 = Text(\n            \"Visit us at docs.manim.community\",\n            t2c={\"docs.manim.community\": YELLOW},\n            disable_ligatures=True,\n       )\n        text6.scale(1.3).shift(DOWN)\n        self.add(text1, text2, text3, text4, text5 , text6)\n        Group(*self.mobjects).arrange(DOWN, buff=.8).set(height=config.frame_height-LARGE_BUFF)",
            "from manim import *\n\nclass TextMoreCustomization(Scene):\n    def construct(self):\n        text1 = Text(\n            'Google',\n            t2c={'[:1]': '#3174f0', '[1:2]': '#e53125',\n                 '[2:3]': '#fbb003', '[3:4]': '#3174f0',\n                 '[4:5]': '#269a43', '[5:]': '#e53125'}, font_size=58).scale(3)\n        self.add(text1)",
            "from manim import *\n\nclass MultipleFonts(Scene):\n    def construct(self):\n        morning = Text(\"\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd\", font=\"sans-serif\")\n        japanese = Text(\n            \"\u65e5\u672c\u3078\u3088\u3046\u3053\u305d\", t2c={\"\u65e5\u672c\": BLUE}\n        )  # works same as ``Text``.\n        mess = Text(\"Multi-Language\", weight=BOLD)\n        russ = Text(\"\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435 \u092e\u0938 \u0928\u092e \u092e \", font=\"sans-serif\")\n        hin = Text(\"\u0928\u092e\u0938\u094d\u0924\u0947\", font=\"sans-serif\")\n        arb = Text(\n            \"\u0635\u0628\u0627\u062d \u0627\u0644\u062e\u064a\u0631 \\n \u062a\u0634\u0631\u0641\u062a \u0628\u0645\u0642\u0627\u0628\u0644\u062a\u0643\", font=\"sans-serif\"\n        )  # don't mix RTL and LTR languages nothing shows up then ;-)\n        chinese = Text(\"\u81c2\u733f\u300c\u9edb\u6bd4\u300d\u5e36\u8457\u5b69\u5b50\", font=\"sans-serif\")\n        self.add(morning, japanese, mess, russ, hin, arb, chinese)\n        for i,mobj in enumerate(self.mobjects):\n            mobj.shift(DOWN*(i-3))",
            "from manim import *\n\nclass PangoRender(Scene):\n    def construct(self):\n        morning = Text(\"\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd\", font=\"sans-serif\")\n        self.play(Write(morning))\n        self.wait(2)"
        ]
    },
    "mathtex": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass Formula(Scene):\n    def construct(self):\n        t = MathTex(r\"\\int_a^b f'(x) dx = f(b)- f(a)\")\n        self.add(t)"
        ]
    },
    "tex": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass TexExample(Scene):\n    def construct(self):\n        t = Tex(\"Hello\", r\"$\\LaTeX$\", font_size=144)\n        self.add(t)"
        ]
    },
    "bulletedlist": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass BulletedListExample(Scene):\n    def construct(self):\n        blist = BulletedList(\"Item 1\", \"Item 2\", \"Item 3\", height=2, width=2)\n        blist.set_color_by_tex(\"Item 1\", RED)\n        blist.set_color_by_tex(\"Item 2\", GREEN)\n        blist.set_color_by_tex(\"Item 3\", BLUE)\n        self.add(blist)"
        ]
    },
    "title": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass TitleExample(Scene):\n    def construct(self):\n        banner = ManimBanner()\n        title = Title(f\"Manim version {manim.__version__}\")\n        self.add(banner, title)"
        ]
    },
    "numberline": {
        "parameters": {
            "x_range": {
                "name": "x_range",
                "description": "The ``[x_min, x_max, x_step]`` values to create the line.",
                "default": "None",
                "type": "Sequence[float] | None"
            },
            "length": {
                "name": "length",
                "description": "The length of the number line.",
                "default": "None",
                "type": "float | None"
            },
            "unit_size": {
                "name": "unit_size",
                "description": "The distance between each tick of the line. Overwritten by :attr:`length`, if specified.",
                "default": "1",
                "type": "float"
            },
            "include_ticks": {
                "name": "include_ticks",
                "description": "Whether to include ticks on the number line.",
                "default": "True",
                "type": "bool"
            },
            "tick_size": {
                "name": "tick_size",
                "description": "The length of each tick mark.",
                "default": "0.1",
                "type": "float"
            },
            "numbers_with_elongated_ticks": {
                "name": "numbers_with_elongated_ticks",
                "description": "An iterable of specific values with elongated ticks.",
                "default": "None",
                "type": "Iterable[float] | None"
            },
            "longer_tick_multiple": {
                "name": "longer_tick_multiple",
                "description": "Influences how many times larger elongated ticks are than regular ticks (2 = 2x).",
                "default": "2",
                "type": "int"
            },
            "exclude_origin_tick": {
                "name": "exclude_origin_tick",
                "description": "",
                "default": "False",
                "type": "bool"
            },
            "rotation": {
                "name": "rotation",
                "description": "The angle (in radians) at which the line is rotated.",
                "default": "0",
                "type": "float"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "The thickness of the line.",
                "default": "2.0",
                "type": "float"
            },
            "include_tip": {
                "name": "include_tip",
                "description": "Whether to add a tip to the end of the line.",
                "default": "False",
                "type": "bool"
            },
            "tip_width": {
                "name": "tip_width",
                "description": "The width of the tip.",
                "default": "DEFAULT_ARROW_TIP_LENGTH",
                "type": "float"
            },
            "tip_height": {
                "name": "tip_height",
                "description": "The height of the tip.",
                "default": "DEFAULT_ARROW_TIP_LENGTH",
                "type": "float"
            },
            "tip_shape": {
                "name": "tip_shape",
                "description": "The mobject class used to construct the tip, or ``None`` (the default) for the default arrow tip. Passed classes have to inherit from :class:`.ArrowTip`.",
                "default": "None",
                "type": "type[ArrowTip] | None"
            },
            "include_numbers": {
                "name": "include_numbers",
                "description": "Whether to add numbers to the tick marks. The number of decimal places is determined by the step size, this default can be overridden by ``decimal_number_config``.",
                "default": "False",
                "type": "bool"
            },
            "font_size": {
                "name": "font_size",
                "description": "The size of the label mobjects. Defaults to 36.",
                "default": "36",
                "type": "float"
            },
            "label_direction": {
                "name": "label_direction",
                "description": "The specific position to which label mobjects are added on the line.",
                "default": "DOWN",
                "type": "Point3DLike"
            },
            "label_constructor": {
                "name": "label_constructor",
                "description": "Determines the mobject class that will be used to construct the labels of the number line.",
                "default": "MathTex",
                "type": "type[MathTex]"
            },
            "scaling": {
                "name": "scaling",
                "description": "The way the ``x_range`` is value is scaled, i.e. :class:`~.LogBase` for a logarithmic numberline. Defaults to :class:`~.LinearBase`.",
                "default": "LinearBase()",
                "type": "_ScaleBase"
            },
            "line_to_number_buff": {
                "name": "line_to_number_buff",
                "description": "The distance between the line and the label mobject.",
                "default": "MED_SMALL_BUFF",
                "type": "float"
            },
            "decimal_number_config": {
                "name": "decimal_number_config",
                "description": "Arguments that can be passed to :class:`~.numbers.DecimalNumber` to influence number mobjects.",
                "default": "None",
                "type": "dict | None"
            },
            "numbers_to_exclude": {
                "name": "numbers_to_exclude",
                "description": "An explicit iterable of numbers to not be added to the number line.",
                "default": "None",
                "type": "Iterable[float] | None"
            },
            "numbers_to_include": {
                "name": "numbers_to_include",
                "description": "An explicit iterable of numbers to add to the number line",
                "default": "None",
                "type": "Iterable[float] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass NumberLineExample(Scene):\n    def construct(self):\n        l0 = NumberLine(\n            x_range=[-10, 10, 2],\n            length=10,\n            color=BLUE,\n            include_numbers=True,\n            label_direction=UP,\n        )\n        l1 = NumberLine(\n            x_range=[-10, 10, 2],\n            unit_size=0.5,\n            numbers_with_elongated_ticks=[-2, 4],\n            include_numbers=True,\n            font_size=24,\n        )\n        num6 = l1.numbers[8]\n        num6.set_color(RED)\n        l2 = NumberLine(\n            x_range=[-2.5, 2.5 + 0.5, 0.5],\n            length=12,\n            decimal_number_config={\"num_decimal_places\": 2},\n            include_numbers=True,\n        )\n        l3 = NumberLine(\n            x_range=[-5, 5 + 1, 1],\n            length=6,\n            include_tip=True,\n            include_numbers=True,\n            rotation=10 * DEGREES,\n        )\n        line_group = VGroup(l0, l1, l2, l3).arrange(DOWN, buff=1)\n        self.add(line_group)"
        ]
    },
    "barchart": {
        "parameters": {
            "values": {
                "name": "values",
                "description": "A sequence of values that determines the height of each bar. Accepts negative values.",
                "type": "MutableSequence[float]"
            },
            "bar_names": {
                "name": "bar_names",
                "description": "A sequence of names for each bar. Does not have to match the length of ``values``.",
                "default": "None",
                "type": "Sequence[str] | None"
            },
            "y_range": {
                "name": "y_range",
                "description": "The y_axis range of values. If ``None``, the range will be calculated based on the min/max of ``values`` and the step will be calculated based on ``y_length``.",
                "default": "None",
                "type": "Sequence[float] | None"
            },
            "x_length": {
                "name": "x_length",
                "description": "The length of the x-axis. If ``None``, it is automatically calculated based on the number of values and the width of the screen.",
                "default": "None",
                "type": "float | None"
            },
            "y_length": {
                "name": "y_length",
                "description": "The length of the y-axis.",
                "default": "None",
                "type": "float | None"
            },
            "bar_colors": {
                "name": "bar_colors",
                "description": "The color for the bars. Accepts a sequence of colors (can contain just one item). If the length of``bar_colors`` does not match that of ``values``, intermediate colors will be automatically determined.",
                "default": "['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600']",
                "type": "Iterable[str]"
            },
            "bar_width": {
                "name": "bar_width",
                "description": "The length of a bar. Must be between 0 and 1.",
                "default": "0.6",
                "type": "float"
            },
            "bar_fill_opacity": {
                "name": "bar_fill_opacity",
                "description": "The fill opacity of the bars.",
                "default": "0.7",
                "type": "float"
            },
            "bar_stroke_width": {
                "name": "bar_stroke_width",
                "description": "The stroke width of the bars.",
                "default": "3",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass BarChartExample(Scene):\n    def construct(self):\n        chart = BarChart(\n            values=[-5, 40, -10, 20, -3],\n            bar_names=[\"one\", \"two\", \"three\", \"four\", \"five\"],\n            y_range=[-20, 50, 10],\n            y_length=6,\n            x_length=10,\n            x_axis_config={\"font_size\": 36},\n        )\n        c_bar_lbls = chart.get_bar_labels(font_size=48)\n        self.add(chart, c_bar_lbls)"
        ]
    },
    "sphere": {
        "parameters": {
            "center": {
                "name": "center",
                "description": "Center of the :class:`Sphere`.",
                "default": "ORIGIN",
                "type": "Point3DLike"
            },
            "radius": {
                "name": "radius",
                "description": "The radius of the :class:`Sphere`.",
                "default": "1",
                "type": "float"
            },
            "resolution": {
                "name": "resolution",
                "description": "The number of samples taken of the :class:`Sphere`. A tuple can be used to define different resolutions for ``u`` and ``v`` respectively.",
                "default": "None",
                "type": "Sequence[int] | None"
            },
            "u_range": {
                "name": "u_range",
                "description": "The range of the ``u`` variable: ``(u_min, u_max)``.",
                "default": "(0, TAU)",
                "type": "Sequence[float]"
            },
            "v_range": {
                "name": "v_range",
                "description": "The range of the ``v`` variable: ``(v_min, v_max)``.",
                "default": "(0, PI)",
                "type": "Sequence[float]"
            }
        },
        "examples": [
            "from manim import *\n\nclass ExampleSphere(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=PI / 6, theta=PI / 6)\n        sphere1 = Sphere(\n            center=(3, 0, 0),\n            radius=1,\n            resolution=(20, 20),\n            u_range=[0.001, PI - 0.001],\n            v_range=[0, TAU]\n        )\n        sphere1.set_color(RED)\n        self.add(sphere1)\n        sphere2 = Sphere(center=(-1, -3, 0), radius=2, resolution=(18, 18))\n        sphere2.set_color(GREEN)\n        self.add(sphere2)\n        sphere3 = Sphere(center=(-1, 2, 0), radius=2, resolution=(16, 16))\n        sphere3.set_color(BLUE)\n        self.add(sphere3)"
        ]
    },
    "dot3d": {
        "parameters": {
            "point": {
                "name": "point",
                "description": "The location of the dot.",
                "default": "ORIGIN",
                "type": "list | np.ndarray"
            },
            "radius": {
                "name": "radius",
                "description": "The radius of the dot.",
                "default": "DEFAULT_DOT_RADIUS",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "The color of the :class:`Dot3D`.",
                "default": "WHITE",
                "type": "ParsableManimColor"
            },
            "resolution": {
                "name": "resolution",
                "description": "The number of samples taken of the :class:`Dot3D`. A tuple can be used to define different resolutions for ``u`` and ``v`` respectively.",
                "default": "(8, 8)",
                "type": "tuple[int, int]"
            }
        },
        "examples": [
            "from manim import *\n\nclass Dot3DExample(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75*DEGREES, theta=-45*DEGREES)\n        axes = ThreeDAxes()\n        dot_1 = Dot3D(point=axes.coords_to_point(0, 0, 1), color=RED)\n        dot_2 = Dot3D(point=axes.coords_to_point(2, 0, 0), radius=0.1, color=BLUE)\n        dot_3 = Dot3D(point=[0, 0, 0], radius=0.1, color=ORANGE)\n        self.add(axes, dot_1, dot_2,dot_3)"
        ]
    },
    "cube": {
        "parameters": {
            "side_length": {
                "name": "side_length",
                "description": "Length of each side of the :class:`Cube`.",
                "default": "2",
                "type": "float"
            },
            "fill_opacity": {
                "name": "fill_opacity",
                "description": "The opacity of the :class:`Cube`, from 0 being fully transparent to 1 being fully opaque. Defaults to 0.75.",
                "default": "0.75",
                "type": "float"
            },
            "fill_color": {
                "name": "fill_color",
                "description": "The color of the :class:`Cube`.",
                "default": "BLUE",
                "type": "ParsableManimColor"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "The width of the stroke surrounding each face of the :class:`Cube`.",
                "default": "0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass CubeExample(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75*DEGREES, theta=-45*DEGREES)\n        axes = ThreeDAxes()\n        cube = Cube(side_length=3, fill_opacity=0.7, fill_color=BLUE)\n        self.add(cube)"
        ]
    },
    "prism": {
        "parameters": {
            "dimensions": {
                "name": "dimensions",
                "description": "Dimensions of the :class:`Prism` in ``[x, y, z]`` format.",
                "default": "[3, 2, 1]",
                "type": "tuple[float, float, float] | np.ndarray"
            }
        },
        "examples": [
            "from manim import *\n\nclass ExamplePrism(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=60 * DEGREES, theta=150 * DEGREES)\n        prismSmall = Prism(dimensions=[1, 2, 3]).rotate(PI / 2)\n        prismLarge = Prism(dimensions=[1.5, 3, 4.5]).move_to([2, 0, 0])\n        self.add(prismSmall, prismLarge)"
        ]
    },
    "cone": {
        "parameters": {
            "base_radius": {
                "name": "base_radius",
                "description": "The base radius from which the cone tapers.",
                "default": "1",
                "type": "float"
            },
            "height": {
                "name": "height",
                "description": "The height measured from the plane formed by the base_radius to the apex of the cone.",
                "default": "1",
                "type": "float"
            },
            "direction": {
                "name": "direction",
                "description": "The direction of the apex.",
                "default": "Z_AXIS",
                "type": "np.ndarray"
            },
            "show_base": {
                "name": "show_base",
                "description": "Whether to show the base plane or not.",
                "default": "False",
                "type": "bool"
            },
            "v_range": {
                "name": "v_range",
                "description": "The azimuthal angle to start and end at.",
                "default": "[0, TAU]",
                "type": "Sequence[float]"
            },
            "u_min": {
                "name": "u_min",
                "description": "The radius at the apex.",
                "default": "0",
                "type": "float"
            },
            "checkerboard_colors": {
                "name": "checkerboard_colors",
                "description": "Show checkerboard grid texture on the cone.",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass ExampleCone(ThreeDScene):\n    def construct(self):\n        axes = ThreeDAxes()\n        cone = Cone(direction=X_AXIS+Y_AXIS+2*Z_AXIS, resolution=8)\n        self.set_camera_orientation(phi=5*PI/11, theta=PI/9)\n        self.add(axes, cone)"
        ]
    },
    "cylinder": {
        "parameters": {
            "radius": {
                "name": "radius",
                "description": "The radius of the cylinder.",
                "default": "1",
                "type": "float"
            },
            "height": {
                "name": "height",
                "description": "The height of the cylinder.",
                "default": "2",
                "type": "float"
            },
            "direction": {
                "name": "direction",
                "description": "The direction of the central axis of the cylinder.",
                "default": "Z_AXIS",
                "type": "np.ndarray"
            },
            "v_range": {
                "name": "v_range",
                "description": "The height along the height axis (given by direction) to start and end on.",
                "default": "[0, TAU]",
                "type": "Sequence[float]"
            },
            "show_ends": {
                "name": "show_ends",
                "description": "Whether to show the end caps or not.",
                "default": "True",
                "type": "bool"
            },
            "resolution": {
                "name": "resolution",
                "description": "The number of samples taken of the :class:`Cylinder`. A tuple can be used to define different resolutions for ``u`` and ``v`` respectively.",
                "default": "(24, 24)",
                "type": "Sequence[int]"
            }
        },
        "examples": [
            "from manim import *\n\nclass ExampleCylinder(ThreeDScene):\n    def construct(self):\n        axes = ThreeDAxes()\n        cylinder = Cylinder(radius=2, height=3)\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        self.add(axes, cylinder)"
        ]
    },
    "arrow3d": {
        "parameters": {
            "start": {
                "name": "start",
                "description": "The start position of the arrow.",
                "default": "LEFT",
                "type": "np.ndarray"
            },
            "end": {
                "name": "end",
                "description": "The end position of the arrow.",
                "default": "RIGHT",
                "type": "np.ndarray"
            },
            "thickness": {
                "name": "thickness",
                "description": "The thickness of the arrow.",
                "default": "0.02",
                "type": "float"
            },
            "height": {
                "name": "height",
                "description": "The height of the conical tip.",
                "default": "0.3",
                "type": "float"
            },
            "base_radius": {
                "name": "base_radius",
                "description": "The base radius of the conical tip.",
                "default": "0.08",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "The color of the arrow.",
                "default": "WHITE",
                "type": "ParsableManimColor"
            },
            "resolution": {
                "name": "resolution",
                "description": "The resolution of the arrow line.",
                "default": "24",
                "type": "int | Sequence[int]"
            }
        },
        "examples": [
            "from manim import *\n\nclass ExampleArrow3D(ThreeDScene):\n    def construct(self):\n        axes = ThreeDAxes()\n        arrow = Arrow3D(\n            start=np.array([0, 0, 0]),\n            end=np.array([2, 2, 2]),\n            resolution=8\n        )\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        self.add(axes, arrow)"
        ]
    },
    "torus": {
        "parameters": {
            "major_radius": {
                "name": "major_radius",
                "description": "Distance from the center of the tube to the center of the torus.",
                "default": "3",
                "type": "float"
            },
            "minor_radius": {
                "name": "minor_radius",
                "description": "Radius of the tube.",
                "default": "1",
                "type": "float"
            },
            "u_range": {
                "name": "u_range",
                "description": "The range of the ``u`` variable: ``(u_min, u_max)``.",
                "default": "(0, TAU)",
                "type": "Sequence[float]"
            },
            "v_range": {
                "name": "v_range",
                "description": "The range of the ``v`` variable: ``(v_min, v_max)``.",
                "default": "(0, TAU)",
                "type": "Sequence[float]"
            },
            "resolution": {
                "name": "resolution",
                "description": "The number of samples taken of the :class:`Torus`. A tuple can be used to define different resolutions for ``u`` and ``v`` respectively.",
                "default": "None",
                "type": "tuple[int, int] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass TorusExample(ThreeDScene):\n    def construct(self):\n        torus = Torus(major_radius=3, minor_radius=1)\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        self.add(torus)"
        ]
    },
    "tetrahedron": {
        "parameters": {
            "edge_length": {
                "name": "edge_length",
                "description": "The length of an edge between any two vertices.",
                "default": "1",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass TetrahedronScene(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        obj = Tetrahedron()\n        self.add(obj)"
        ]
    },
    "octahedron": {
        "parameters": {
            "edge_length": {
                "name": "edge_length",
                "description": "The length of an edge between any two vertices.",
                "default": "1",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass OctahedronScene(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        obj = Octahedron()\n        self.add(obj)"
        ]
    },
    "icosahedron": {
        "parameters": {
            "edge_length": {
                "name": "edge_length",
                "description": "The length of an edge between any two vertices.",
                "default": "1",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass IcosahedronScene(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        obj = Icosahedron()\n        self.add(obj)"
        ]
    },
    "dodecahedron": {
        "parameters": {
            "edge_length": {
                "name": "edge_length",
                "description": "The length of an edge between any two vertices.",
                "default": "1",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass DodecahedronScene(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)\n        obj = Dodecahedron()\n        self.add(obj)"
        ]
    },
    "table": {
        "parameters": {
            "table": {
                "name": "table",
                "description": "A 2D array or list of lists. Content of the table has to be a valid input for the callable set in ``element_to_mobject``.",
                "type": "Iterable[Iterable[float | str | VMobject]]"
            },
            "row_labels": {
                "name": "row_labels",
                "description": "List of :class:`~.VMobject` representing the labels of each row.",
                "default": "None",
                "type": "Iterable[VMobject] | None"
            },
            "col_labels": {
                "name": "col_labels",
                "description": "List of :class:`~.VMobject` representing the labels of each column.",
                "default": "None",
                "type": "Iterable[VMobject] | None"
            },
            "top_left_entry": {
                "name": "top_left_entry",
                "description": "The top-left entry of the table, can only be specified if row and column labels are given.",
                "default": "None",
                "type": "VMobject | None"
            },
            "v_buff": {
                "name": "v_buff",
                "description": "Vertical buffer passed to :meth:`~.Mobject.arrange_in_grid`, by default 0.8.",
                "default": "0.8",
                "type": "float"
            },
            "h_buff": {
                "name": "h_buff",
                "description": "Horizontal buffer passed to :meth:`~.Mobject.arrange_in_grid`, by default 1.3.",
                "default": "1.3",
                "type": "float"
            },
            "include_outer_lines": {
                "name": "include_outer_lines",
                "description": "``True`` if the table should include outer lines, by default False.",
                "default": "False",
                "type": "bool"
            },
            "add_background_rectangles_to_entries": {
                "name": "add_background_rectangles_to_entries",
                "description": "``True`` if background rectangles should be added to entries, by default ``False``.",
                "default": "False",
                "type": "bool"
            },
            "entries_background_color": {
                "name": "entries_background_color",
                "description": "Background color of entries if ``add_background_rectangles_to_entries`` is ``True``.",
                "default": "BLACK",
                "type": "ParsableManimColor"
            },
            "include_background_rectangle": {
                "name": "include_background_rectangle",
                "description": "``True`` if the table should have a background rectangle, by default ``False``.",
                "default": "False",
                "type": "bool"
            },
            "background_rectangle_color": {
                "name": "background_rectangle_color",
                "description": "Background color of table if ``include_background_rectangle`` is ``True``.",
                "default": "BLACK",
                "type": "ParsableManimColor"
            },
            "element_to_mobject": {
                "name": "element_to_mobject",
                "description": "The :class:`~.Mobject` class applied to the table entries. by default :class:`~.Paragraph`. For common choices, see :mod:`~.text_mobject`/:mod:`~.tex_mobject`.",
                "default": "Paragraph",
                "type": "Callable[[float | str | VMobject], VMobject]"
            },
            "element_to_mobject_config": {
                "name": "element_to_mobject_config",
                "description": "Custom configuration passed to :attr:`element_to_mobject`, by default {}.",
                "default": "{}",
                "type": "dict"
            },
            "arrange_in_grid_config": {
                "name": "arrange_in_grid_config",
                "description": "Dict passed to :meth:`~.Mobject.arrange_in_grid`, customizes the arrangement of the table.",
                "default": "{}",
                "type": "dict"
            },
            "line_config": {
                "name": "line_config",
                "description": "Dict passed to :class:`~.Line`, customizes the lines of the table.",
                "default": "{}",
                "type": "dict"
            }
        },
        "examples": [
            "from manim import *\n\nclass TableExamples(Scene):\n    def construct(self):\n        t0 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table in \\\\n Manim.\"]])\n        t1 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table.\"]],\n            row_labels=[Text(\"R1\"), Text(\"R2\")],\n            col_labels=[Text(\"C1\"), Text(\"C2\")])\n        t1.add_highlighted_cell((2,2), color=YELLOW)\n        t2 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table.\"]],\n            row_labels=[Text(\"R1\"), Text(\"R2\")],\n            col_labels=[Text(\"C1\"), Text(\"C2\")],\n            top_left_entry=Star().scale(0.3),\n            include_outer_lines=True,\n            arrange_in_grid_config={\"cell_alignment\": RIGHT})\n        t2.add(t2.get_cell((2,2), color=RED))\n        t3 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table.\"]],\n            row_labels=[Text(\"R1\"), Text(\"R2\")],\n            col_labels=[Text(\"C1\"), Text(\"C2\")],\n            top_left_entry=Star().scale(0.3),\n            include_outer_lines=True,\n            line_config={\"stroke_width\": 1, \"color\": YELLOW})\n        t3.remove(*t3.get_vertical_lines())\n        g = Group(\n            t0,t1,t2,t3\n        ).scale(0.7).arrange_in_grid(buff=1)\n        self.add(g)",
            "from manim import *\n\nclass BackgroundRectanglesExample(Scene):\n    def construct(self):\n        background = Rectangle(height=6.5, width=13)\n        background.set_fill(opacity=.5)\n        background.set_color([TEAL, RED, YELLOW])\n        self.add(background)\n        t0 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table.\"]],\n            add_background_rectangles_to_entries=True)\n        t1 = Table(\n            [[\"This\", \"is a\"],\n            [\"simple\", \"Table.\"]],\n            include_background_rectangle=True)\n        g = Group(t0, t1).scale(0.7).arrange(buff=0.5)\n        self.add(g)"
        ]
    },
    "group": {
        "parameters": {},
        "examples": [
            "from manim import *\n\nclass GroupExample(Scene):\n    def construct(self):\n        c = Circle()\n        s = Square()\n        g = Group(c, s).arrange(RIGHT)\n        self.add(g)"
        ]
    },
    "arc": {
        "parameters": {
            "radius": {
                "name": "radius",
                "description": "",
                "default": "1.0",
                "type": "float | None"
            },
            "start_angle": {
                "name": "start_angle",
                "description": "",
                "default": "0",
                "type": "float"
            },
            "angle": {
                "name": "angle",
                "description": "",
                "default": "TAU / 4",
                "type": "float"
            },
            "num_components": {
                "name": "num_components",
                "description": "",
                "default": "9",
                "type": "int"
            },
            "arc_center": {
                "name": "arc_center",
                "description": "",
                "default": "ORIGIN",
                "type": "Point3DLike"
            }
        },
        "examples": [
            "from manim import *\n\nclass ArcExample(Scene):\n    def construct(self):\n        self.add(Arc(angle=PI))"
        ]
    },
    "circle": {
        "parameters": {
            "radius": {
                "name": "radius",
                "description": "",
                "default": "None",
                "type": "float | None"
            },
            "color": {
                "name": "color",
                "description": "The color of the shape.",
                "default": "RED",
                "type": "ParsableManimColor"
            }
        },
        "examples": [
            "from manim import *\n\nclass CircleExample(Scene):\n    def construct(self):\n        circle_1 = Circle(radius=1.0)\n        circle_2 = Circle(radius=1.5, color=GREEN)\n        circle_3 = Circle(radius=1.0, color=BLUE_B, fill_opacity=1)\n        circle_group = Group(circle_1, circle_2, circle_3).arrange(buff=1)\n        self.add(circle_group)"
        ]
    },
    "valuetracker": {
        "parameters": {
            "value": {
                "name": "value",
                "description": "",
                "default": "0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass ValueTrackerExample(Scene):\n    def construct(self):\n        number_line = NumberLine()\n        pointer = Vector(DOWN)\n        label = MathTex(\"x\").add_updater(lambda m: m.next_to(pointer, UP))\n        tracker = ValueTracker(0)\n        pointer.add_updater(\n            lambda m: m.next_to(\n                        number_line.n2p(tracker.get_value()),\n                        UP\n                    )\n        )\n        self.add(number_line, pointer,label)\n        tracker += 1.5\n        self.wait(1)\n        tracker -= 4\n        self.wait(0.5)\n        self.play(tracker.animate.set_value(5))\n        self.wait(0.5)\n        self.play(tracker.animate.set_value(3))\n        self.play(tracker.animate.increment_value(-2))\n        self.wait(0.5)",
            "from manim import *\n\nclass ValueTrackerExample(Scene):\n    def construct(self):\n        tracker = ValueTracker(0)\n        label = Dot(radius=3).add_updater(lambda x : x.set_x(tracker.get_value()))\n        self.add(label)\n        self.add(tracker)\n        tracker.add_updater(lambda mobject, dt: mobject.increment_value(dt))\n        self.wait(2)"
        ]
    },
    "labeledline": {
        "parameters": {
            "label": {
                "name": "label",
                "description": "Label that will be displayed on the line.",
                "type": "str | Tex | MathTex | Text"
            },
            "label_position": {
                "name": "label_position",
                "description": "A ratio in the range [0-1] to indicate the position of the label with respect to the length of the line. Default value is 0.5.",
                "default": "0.5",
                "type": "float"
            },
            "label_config": {
                "name": "label_config",
                "description": "A dictionary containing the configuration for the label. This is only applied if ``label`` is of type ``str``.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "box_config": {
                "name": "box_config",
                "description": "A dictionary containing the configuration for the background box.",
                "default": "None",
                "type": "dict[str, Any] | None"
            },
            "frame_config": {
                "name": "frame_config",
                "description": "A dictionary containing the configuration for the frame. .. seealso:: :class:`LabeledArrow`",
                "default": "None",
                "type": "dict[str, Any] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass LabeledLineExample(Scene):\n    def construct(self):\n        line = LabeledLine(\n            label          = '0.5',\n            label_position = 0.8,\n            label_config = {\n                \"font_size\" : 20\n            },\n            start=LEFT+DOWN,\n            end=RIGHT+UP)\n        line.set_length(line.get_length() * 2)\n        self.add(line)"
        ]
    },
    "labeledarrow": {
        "parameters": {
            "label": {
                "name": "label",
                "description": "Label that will be displayed on the Arrow."
            },
            "label_position": {
                "name": "label_position",
                "description": "A ratio in the range [0-1] to indicate the position of the label with respect to the length of the line. Default value is 0.5."
            },
            "label_config": {
                "name": "label_config",
                "description": "A dictionary containing the configuration for the label. This is only applied if ``label`` is of type ``str``."
            },
            "box_config": {
                "name": "box_config",
                "description": "A dictionary containing the configuration for the background box."
            },
            "frame_config": {
                "name": "frame_config",
                "description": "A dictionary containing the configuration for the frame. .. seealso:: :class:`LabeledLine`"
            }
        },
        "examples": [
            "from manim import *\n\nclass LabeledArrowExample(Scene):\n    def construct(self):\n        l_arrow = LabeledArrow(\"0.5\", start=LEFT*3, end=RIGHT*3 + UP*2, label_position=0.5)\n        self.add(l_arrow)"
        ]
    }
}
