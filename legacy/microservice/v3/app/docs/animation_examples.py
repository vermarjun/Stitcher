CODE_SNIPPETS = {
    "rotating": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject to be rotated.",
                "type": "Mobject"
            },
            "angle": {
                "name": "angle",
                "description": "The rotation angle in radians. Predefined constants such as ``DEGREES`` can also be used to specify the angle in degrees.",
                "default": "TAU",
                "type": "float"
            },
            "axis": {
                "name": "axis",
                "description": "The rotation axis as a numpy vector.",
                "default": "OUT",
                "type": "np.ndarray"
            },
            "about_point": {
                "name": "about_point",
                "description": "The rotation center.",
                "default": "None",
                "type": "np.ndarray | None"
            },
            "about_edge": {
                "name": "about_edge",
                "description": "If ``about_point`` is ``None``, this argument specifies the direction of the bounding box point to be taken as the rotation center.",
                "default": "None",
                "type": "np.ndarray | None"
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the animation in seconds.",
                "default": "5",
                "type": "float"
            },
            "rate_func": {
                "name": "rate_func",
                "description": "The function defining the animation progress based on the relative runtime (see :mod:`~.rate_functions`) .",
                "default": "linear",
                "type": "Callable[[float], float]"
            }
        },
        "examples": [
            "from manim import *\n\nclass RotatingDemo(Scene):\n    def construct(self):\n        circle = Circle(radius=1, color=BLUE)\n        line = Line(start=ORIGIN, end=RIGHT)\n        arrow = Arrow(start=ORIGIN, end=RIGHT, buff=0, color=GOLD)\n        vg = VGroup(circle,line,arrow)\n        self.add(vg)\n        anim_kw = {\"about_point\": arrow.get_start(), \"run_time\": 1}\n        self.play(Rotating(arrow, 180*DEGREES, **anim_kw))\n        self.play(Rotating(arrow, PI, **anim_kw))\n        self.play(Rotating(vg, PI, about_point=RIGHT))\n        self.play(Rotating(vg, PI, axis=UP, about_point=ORIGIN))\n        self.play(Rotating(vg, PI, axis=RIGHT, about_edge=UP))\n        self.play(vg.animate.move_to(ORIGIN))",
            "from manim import *\n\nclass RotatingDifferentAxis(ThreeDScene):\n    def construct(self):\n        axes = ThreeDAxes()\n        cube = Cube()\n        arrow2d = Arrow(start=[0, -1.2, 1], end=[0, 1.2, 1], color=YELLOW_E)\n        cube_group = VGroup(cube,arrow2d)\n        self.set_camera_orientation(gamma=0, phi=40*DEGREES, theta=40*DEGREES)\n        self.add(axes, cube_group)\n        play_kw = {\"run_time\": 1.5}\n        self.play(Rotating(cube_group, PI), **play_kw)\n        self.play(Rotating(cube_group, PI, axis=UP), **play_kw)\n        self.play(Rotating(cube_group, 180*DEGREES, axis=RIGHT), **play_kw)\n        self.wait(0.5)"
        ]
    },
    "rotate": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject to be rotated.",
                "type": "Mobject"
            },
            "angle": {
                "name": "angle",
                "description": "The rotation angle.",
                "default": "PI",
                "type": "float"
            },
            "axis": {
                "name": "axis",
                "description": "The rotation axis as a numpy vector.",
                "default": "OUT",
                "type": "np.ndarray"
            },
            "about_point": {
                "name": "about_point",
                "description": "The rotation center.",
                "default": "None",
                "type": "Sequence[float] | None"
            },
            "about_edge": {
                "name": "about_edge",
                "description": "If ``about_point`` is ``None``, this argument specifies the direction of the bounding box point to be taken as the rotation center.",
                "default": "None",
                "type": "Sequence[float] | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass UsingRotate(Scene):\n    def construct(self):\n        self.play(\n            Rotate(\n                Square(side_length=0.5).shift(UP * 2),\n                angle=2*PI,\n                about_point=ORIGIN,\n                rate_func=linear,\n            ),\n            Rotate(Square(side_length=0.5), angle=2*PI, rate_func=linear),\n            )"
        ]
    },
    "fadein": {
        "parameters": {
            "mobjects": {
                "name": "mobjects",
                "description": "The mobjects to be faded in."
            },
            "shift": {
                "name": "shift",
                "description": "The vector by which the mobject shifts while being faded in."
            },
            "target_position": {
                "name": "target_position",
                "description": "The position from which the mobject starts while being faded in. In case another mobject is given as target position, its center is used."
            },
            "scale": {
                "name": "scale",
                "description": "The factor by which the mobject is scaled initially before being rescaling to its original size while being faded in."
            }
        },
        "examples": [
            "from manim import *\n\nclass FadeInExample(Scene):\n    def construct(self):\n        dot = Dot(UP * 2 + LEFT)\n        self.add(dot)\n        tex = Tex(\n            \"FadeIn with \", \"shift \", r\" or target\\_position\", \" and scale\"\n        ).scale(1)\n        animations = [\n            FadeIn(tex[0]),\n            FadeIn(tex[1], shift=DOWN),\n            FadeIn(tex[2], target_position=dot),\n            FadeIn(tex[3], scale=1.5),\n        ]\n        self.play(AnimationGroup(*animations, lag_ratio=0.5))"
        ]
    },
    "fadeout": {
        "parameters": {
            "mobjects": {
                "name": "mobjects",
                "description": "The mobjects to be faded out."
            },
            "shift": {
                "name": "shift",
                "description": "The vector by which the mobject shifts while being faded out."
            },
            "target_position": {
                "name": "target_position",
                "description": "The position to which the mobject moves while being faded out. In case another mobject is given as target position, its center is used."
            },
            "scale": {
                "name": "scale",
                "description": "The factor by which the mobject is scaled while being faded out."
            }
        },
        "examples": [
            "from manim import *\n\nclass FadeOutExample(Scene):\n    def construct(self):\n        dot = Dot(UP * 2 + LEFT)\n        self.add(dot)\n        tex = Tex(\n            \"FadeOut with \", \"shift \", r\" or target\\_position\", \" and scale\"\n        ).scale(1)\n        self.add(tex)\n        animations = [\n            FadeOut(tex[0]),\n            FadeOut(tex[1], shift=DOWN),\n            FadeOut(tex[2], target_position=dot),\n            FadeOut(tex[3], scale=0.5),\n        ]\n        self.play(AnimationGroup(*animations, lag_ratio=0.5))"
        ]
    },
    "create": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The VMobject to animate.",
                "type": "VMobject | OpenGLVMobject | OpenGLSurface"
            },
            "lag_ratio": {
                "name": "lag_ratio",
                "description": "",
                "default": "1.0",
                "type": "float"
            },
            "introducer": {
                "name": "introducer",
                "description": "",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass CreateScene(Scene):\n    def construct(self):\n        self.play(Create(Square()))"
        ]
    },
    "uncreate": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "VMobject | OpenGLVMobject"
            },
            "reverse_rate_function": {
                "name": "reverse_rate_function",
                "description": "",
                "default": "True",
                "type": "bool"
            },
            "remover": {
                "name": "remover",
                "description": "",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass ShowUncreate(Scene):\n    def construct(self):\n        self.play(Uncreate(Square()))"
        ]
    },
    "drawborderthenfill": {
        "parameters": {
            "vmobject": {
                "name": "vmobject",
                "description": "",
                "type": "VMobject | OpenGLVMobject"
            },
            "run_time": {
                "name": "run_time",
                "description": "",
                "default": "2",
                "type": "float"
            },
            "rate_func": {
                "name": "rate_func",
                "description": "",
                "default": "double_smooth",
                "type": "Callable[[float], float]"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "",
                "default": "2",
                "type": "float"
            },
            "stroke_color": {
                "name": "stroke_color",
                "description": "",
                "default": "None",
                "type": "str"
            },
            "introducer": {
                "name": "introducer",
                "description": "",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass ShowDrawBorderThenFill(Scene):\n    def construct(self):\n        self.play(DrawBorderThenFill(Square(fill_opacity=1, fill_color=ORANGE)))"
        ]
    },
    "write": {
        "parameters": {
            "vmobject": {
                "name": "vmobject",
                "description": "",
                "type": "VMobject | OpenGLVMobject"
            },
            "rate_func": {
                "name": "rate_func",
                "description": "",
                "default": "linear",
                "type": "Callable[[float], float]"
            },
            "reverse": {
                "name": "reverse",
                "description": "",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass ShowWrite(Scene):\n    def construct(self):\n        self.play(Write(Text(\"Hello\", font_size=144)))",
            "from manim import *\n\nclass ShowWriteReversed(Scene):\n    def construct(self):\n        self.play(Write(Text(\"Hello\", font_size=144), reverse=True, remover=False))"
        ]
    },
    "unwrite": {
        "parameters": {
            "vmobject": {
                "name": "vmobject",
                "description": "",
                "type": "VMobject"
            },
            "rate_func": {
                "name": "rate_func",
                "description": "",
                "default": "linear",
                "type": "Callable[[float], float]"
            },
            "reverse": {
                "name": "reverse",
                "description": "Set True to have the animation start erasing from the last submobject first.",
                "default": "True",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass UnwriteReverseFalse(Scene):\n    def construct(self):\n        text = Tex(\"Alice and Bob\").scale(3)\n        self.add(text)\n        self.play(Unwrite(text, reverse=False))"
        ]
    },
    "typewithcursor": {
        "parameters": {
            "text": {
                "name": "text",
                "description": "",
                "type": "Text"
            },
            "cursor": {
                "name": "cursor",
                "description": ":class:`~.Mobject` shown after the last added letter.",
                "type": "Mobject"
            },
            "buff": {
                "name": "buff",
                "description": "Controls how far away the cursor is to the right of the last added letter.",
                "default": "0.1",
                "type": "float"
            },
            "keep_cursor_y": {
                "name": "keep_cursor_y",
                "description": "If ``True``, the cursor's y-coordinate is set to the center of the ``Text`` and remains the same throughout the animation. Otherwise, it is set to the center of the last added letter.",
                "default": "True",
                "type": "bool"
            },
            "leave_cursor_on": {
                "name": "leave_cursor_on",
                "description": "Whether to show the cursor after the animation.",
                "default": "True",
                "type": "bool"
            },
            "time_per_char": {
                "name": "time_per_char",
                "description": "Frequency of appearance of the letters.",
                "default": "0.1",
                "type": "float"
            },
            "reverse_rate_function": {
                "name": "reverse_rate_function",
                "description": "",
                "default": "False"
            },
            "introducer": {
                "name": "introducer",
                "description": "",
                "default": "True"
            }
        },
        "examples": [
            "from manim import *\n\nclass InsertingTextExample(Scene):\n    def construct(self):\n        text = Text(\"Inserting\", color=PURPLE).scale(1.5).to_edge(LEFT)\n        cursor = Rectangle(\n            color = GREY_A,\n            fill_color = GREY_A,\n            fill_opacity = 1.0,\n            height = 1.1,\n            width = 0.5,\n        ).move_to(text[0]) # Position the cursor\n        self.play(TypeWithCursor(text, cursor))\n        self.play(Blink(cursor, blinks=2))"
        ]
    },
    "spiralin": {
        "parameters": {
            "shapes": {
                "name": "shapes",
                "description": "The Mobject on which to be operated.",
                "type": "Mobject"
            },
            "scale_factor": {
                "name": "scale_factor",
                "description": "The factor used for scaling the effect.",
                "default": "8",
                "type": "float"
            },
            "fade_in_fraction": {
                "name": "fade_in_fraction",
                "description": "Fractional duration of initial fade-in of sub-Mobjects as they fly inward.",
                "default": "0.3"
            }
        },
        "examples": [
            "from manim import *\n\nclass SpiralInExample(Scene):\n    def construct(self):\n        pi = MathTex(r\"\\pi\").scale(7)\n        pi.shift(2.25 * LEFT + 1.5 * UP)\n        circle = Circle(color=GREEN_C, fill_opacity=1).shift(LEFT)\n        square = Square(color=BLUE_D, fill_opacity=1).shift(UP)\n        shapes = VGroup(pi, circle, square)\n        self.play(SpiralIn(shapes))"
        ]
    },
    "transform": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The :class:`.Mobject` to be transformed. It will be mutated to become the ``target_mobject``.",
                "type": "Mobject | None"
            },
            "target_mobject": {
                "name": "target_mobject",
                "description": "The target of the transformation.",
                "default": "None",
                "type": "Mobject | None"
            },
            "path_func": {
                "name": "path_func",
                "description": "A function defining the path that the points of the ``mobject`` are being moved along until they match the points of the ``target_mobject``, see :mod:`.utils.paths`.",
                "default": "None",
                "type": "Callable | None"
            },
            "path_arc": {
                "name": "path_arc",
                "description": "The arc angle (in radians) that the points of ``mobject`` will follow to reach the points of the target if using a circular path arc, see ``path_arc_centers``. See also :func:`manim.utils.paths.path_along_arc`.",
                "default": "0",
                "type": "float"
            },
            "path_arc_axis": {
                "name": "path_arc_axis",
                "description": "The axis to rotate along if using a circular path arc, see ``path_arc_centers``.",
                "default": "OUT",
                "type": "np.ndarray"
            },
            "path_arc_centers": {
                "name": "path_arc_centers",
                "description": "The center of the circular arcs along which the points of ``mobject`` are moved by the transformation. If this is set and ``path_func`` is not set, then a ``path_along_circles`` path will be generated using the ``path_arc`` parameters and stored in ``path_func``. If ``path_func`` is set, this and the other ``path_arc`` fields are set as attributes, but a ``path_func`` is not generated from it.",
                "default": "None",
                "type": "np.ndarray"
            },
            "replace_mobject_with_target_in_scene": {
                "name": "replace_mobject_with_target_in_scene",
                "description": "Controls which mobject is replaced when the transformation is complete. If set to True, ``mobject`` will be removed from the scene and ``target_mobject`` will replace it. Otherwise, ``target_mobject`` is never added and ``mobject`` just takes its shape.",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass TransformExample(Scene):\n    def construct(self):\n        A = Text(\"Text-A\").scale(3)\n        B = Text(\"Text-B\").scale(3)\n        C = Text(\"C-Text\").scale(3)\n        self.add(A)\n        self.wait()\n        self.play(Transform(A, B))\n        self.wait()\n        self.play(Transform(A, C))\n        self.wait()"
        ]
    },
    "replacementtransform": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The starting :class:`~.Mobject`.",
                "type": "Mobject"
            },
            "target_mobject": {
                "name": "target_mobject",
                "description": "The target :class:`~.Mobject`.",
                "type": "Mobject"
            }
        },
        "examples": [
            "from manim import *\n\nclass ReplacementTransformOrTransform(Scene):\n    def construct(self):\n        # set up the numbers\n        r_transform = VGroup(*[Integer(i) for i in range(1,4)])\n        text_1 = Text(\"ReplacementTransform\", color=RED)\n        r_transform.add(text_1)\n        transform = VGroup(*[Integer(i) for i in range(4,7)])\n        text_2 = Text(\"Transform\", color=BLUE)\n        transform.add(text_2)\n        ints = VGroup(r_transform, transform)\n        texts = VGroup(text_1, text_2).scale(0.75)\n        r_transform.arrange(direction=UP, buff=1)\n        transform.arrange(direction=UP, buff=1)\n        ints.arrange(buff=2)\n        self.add(ints, texts)\n        # The mobs replace each other and none are left behind\n        self.play(ReplacementTransform(r_transform[0], r_transform[1]))\n        self.play(ReplacementTransform(r_transform[1], r_transform[2]))\n        # The mobs linger after the Transform()\n        self.play(Transform(transform[0], transform[1]))\n        self.play(Transform(transform[1], transform[2]))\n        self.wait()"
        ]
    },
    "fadetocolor": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "Mobject"
            },
            "color": {
                "name": "color",
                "description": "",
                "type": "str"
            }
        },
        "examples": [
            "from manim import *\n\nclass FadeToColorExample(Scene):\n    def construct(self):\n        self.play(FadeToColor(Text(\"Hello World!\"), color=RED))"
        ]
    },
    "scaleinplace": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "Mobject"
            },
            "scale_factor": {
                "name": "scale_factor",
                "description": "",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass ScaleInPlaceExample(Scene):\n    def construct(self):\n        self.play(ScaleInPlace(Text(\"Hello World!\"), 2))"
        ]
    },
    "restore": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "Mobject"
            }
        },
        "examples": [
            "from manim import *\n\nclass RestoreExample(Scene):\n    def construct(self):\n        s = Square()\n        s.save_state()\n        self.play(FadeIn(s))\n        self.play(s.animate.set_color(PURPLE).set_opacity(0.5).shift(2*LEFT).scale(3))\n        self.play(s.animate.shift(5*DOWN).rotate(PI/4))\n        self.wait()\n        self.play(Restore(s), run_time=2)"
        ]
    },
    "cyclicreplace": {
        "parameters": {
            "mobjects": {
                "name": "mobjects",
                "description": "List of mobjects to be transformed."
            },
            "path_arc": {
                "name": "path_arc",
                "description": "The angle of the arc (in radians) that the mobjects will follow to reach their target."
            },
            "kwargs": {
                "name": "kwargs",
                "description": "Further keyword arguments that are passed to :class:`.Transform`."
            }
        },
        "examples": [
            "from manim import *\n\nclass CyclicReplaceExample(Scene):\n    def construct(self):\n        A = Text(\"A\").scale(3).shift(LEFT * 2)\n        B = Text(\"B\").scale(3)\n        C = Text(\"C\").scale(3).shift(RIGHT * 2)\n        self.add(A, B, C)\n        self.wait()\n        self.play(CyclicReplace(A, B, C))\n        self.wait()"
        ]
    },
    "focuson": {
        "parameters": {
            "focus_point": {
                "name": "focus_point",
                "description": "The point at which to shrink the spotlight. If it is a :class:`.~Mobject` its center will be used.",
                "type": "Point3DLike | Mobject"
            },
            "opacity": {
                "name": "opacity",
                "description": "The opacity of the spotlight.",
                "default": "0.2",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "The color of the spotlight.",
                "default": "GREY",
                "type": "ParsableManimColor"
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the animation.",
                "default": "2",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass UsingFocusOn(Scene):\n    def construct(self):\n        dot = Dot(color=YELLOW).shift(DOWN)\n        self.add(Tex(\"Focusing on the dot below:\"), dot)\n        self.play(FocusOn(dot))\n        self.wait()"
        ]
    },
    "indicate": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject to indicate.",
                "type": "Mobject"
            },
            "scale_factor": {
                "name": "scale_factor",
                "description": "The factor by which the mobject will be temporally scaled",
                "default": "1.2",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "The color the mobject temporally takes.",
                "default": "YELLOW",
                "type": "ParsableManimColor"
            },
            "rate_func": {
                "name": "rate_func",
                "description": "The function defining the animation progress at every point in time.",
                "default": "there_and_back",
                "type": "RateFunction"
            }
        },
        "examples": [
            "from manim import *\n\nclass UsingIndicate(Scene):\n    def construct(self):\n        tex = Tex(\"Indicate\").scale(3)\n        self.play(Indicate(tex))\n        self.wait()"
        ]
    },
    "flash": {
        "parameters": {
            "point": {
                "name": "point",
                "description": "The center of the flash lines. If it is a :class:`.~Mobject` its center will be used.",
                "type": "Point3DLike | Mobject"
            },
            "line_length": {
                "name": "line_length",
                "description": "The length of the flash lines.",
                "default": "0.2",
                "type": "float"
            },
            "num_lines": {
                "name": "num_lines",
                "description": "The number of flash lines.",
                "default": "12",
                "type": "int"
            },
            "flash_radius": {
                "name": "flash_radius",
                "description": "The distance from `point` at which the flash lines start.",
                "default": "0.1",
                "type": "float"
            },
            "line_stroke_width": {
                "name": "line_stroke_width",
                "description": "The stroke width of the flash lines.",
                "default": "3",
                "type": "int"
            },
            "color": {
                "name": "color",
                "description": "The color of the flash lines.",
                "default": "YELLOW",
                "type": "ParsableManimColor"
            },
            "time_width": {
                "name": "time_width",
                "description": "The time width used for the flash lines. See :class:`.~ShowPassingFlash` for more details.",
                "default": "1",
                "type": "float"
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the animation.",
                "default": "1.0",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass UsingFlash(Scene):\n    def construct(self):\n        dot = Dot(color=YELLOW).shift(DOWN)\n        self.add(Tex(\"Flash the dot below:\"), dot)\n        self.play(Flash(dot))\n        self.wait()",
            "from manim import *\n\nclass FlashOnCircle(Scene):\n    def construct(self):\n        radius = 2\n        circle = Circle(radius)\n        self.add(circle)\n        self.play(Flash(\n            circle, line_length=1,\n            num_lines=30, color=RED,\n            flash_radius=radius+SMALL_BUFF,\n            time_width=0.3, run_time=2,\n            rate_func = rush_from\n        ))"
        ]
    },
    "wiggle": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject to wiggle.",
                "type": "Mobject"
            },
            "scale_value": {
                "name": "scale_value",
                "description": "The factor by which the mobject will be temporarily scaled.",
                "default": "1.1",
                "type": "float"
            },
            "rotation_angle": {
                "name": "rotation_angle",
                "description": "The wiggle angle.",
                "default": "0.01 * TAU",
                "type": "float"
            },
            "n_wiggles": {
                "name": "n_wiggles",
                "description": "The number of wiggles.",
                "default": "6",
                "type": "int"
            },
            "scale_about_point": {
                "name": "scale_about_point",
                "description": "The point about which the mobject gets scaled.",
                "default": "None",
                "type": "Point3DLike | None"
            },
            "rotate_about_point": {
                "name": "rotate_about_point",
                "description": "The point around which the mobject gets rotated.",
                "default": "None",
                "type": "Point3DLike | None"
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the animation",
                "default": "2",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass ApplyingWaves(Scene):\n    def construct(self):\n        tex = Tex(\"Wiggle\").scale(3)\n        self.play(Wiggle(tex))\n        self.wait()"
        ]
    },
    "circumscribe": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "The mobject to be circumscribed.",
                "type": "Mobject"
            },
            "shape": {
                "name": "shape",
                "description": "The shape with which to surround the given mobject. Should be either :class:`~.Rectangle` or :class:`~.Circle`",
                "default": "Rectangle",
                "type": "type[Rectangle] | type[Circle]"
            },
            "fade_in": {
                "name": "fade_in",
                "description": "Whether to make the surrounding shape to fade in. It will be drawn otherwise.",
                "default": "False",
                "type": "bool"
            },
            "fade_out": {
                "name": "fade_out",
                "description": "Whether to make the surrounding shape to fade out. It will be undrawn otherwise.",
                "default": "False",
                "type": "bool"
            },
            "time_width": {
                "name": "time_width",
                "description": "The time_width of the drawing and undrawing. Gets ignored if either `fade_in` or `fade_out` is `True`.",
                "default": "0.3",
                "type": "float"
            },
            "buff": {
                "name": "buff",
                "description": "The distance between the surrounding shape and the given mobject.",
                "default": "SMALL_BUFF",
                "type": "float"
            },
            "color": {
                "name": "color",
                "description": "The color of the surrounding shape.",
                "default": "YELLOW",
                "type": "ParsableManimColor"
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the entire animation.",
                "default": "1",
                "type": "float"
            },
            "stroke_width": {
                "name": "stroke_width",
                "description": "",
                "default": "DEFAULT_STROKE_WIDTH",
                "type": "float"
            }
        },
        "examples": [
            "from manim import *\n\nclass UsingCircumscribe(Scene):\n    def construct(self):\n        lbl = Tex(r\"Circum-\\\\scribe\").scale(2)\n        self.add(lbl)\n        self.play(Circumscribe(lbl))\n        self.play(Circumscribe(lbl, Circle))\n        self.play(Circumscribe(lbl, fade_out=True))\n        self.play(Circumscribe(lbl, time_width=2))\n        self.play(Circumscribe(lbl, Circle, True))"
        ]
    },
    "movealongpath": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "Mobject"
            },
            "path": {
                "name": "path",
                "description": "",
                "type": "VMobject"
            },
            "suspend_mobject_updating": {
                "name": "suspend_mobject_updating",
                "description": "",
                "default": "False",
                "type": "bool"
            }
        },
        "examples": [
            "from manim import *\n\nclass MoveAlongPathExample(Scene):\n    def construct(self):\n        d1 = Dot().set_color(ORANGE)\n        l1 = Line(LEFT, RIGHT)\n        l2 = VMobject()\n        self.add(d1, l1, l2)\n        l2.add_updater(lambda x: x.become(Line(LEFT, d1.get_center()).set_color(ORANGE)))\n        self.play(MoveAlongPath(d1, l1), rate_func=linear)"
        ]
    },
    "changedecimaltovalue": {
        "parameters": {
            "decimal_mob": {
                "name": "decimal_mob",
                "description": "The :class:`~.DecimalNumber` instance to animate.",
                "type": "DecimalNumber"
            },
            "target_number": {
                "name": "target_number",
                "description": "The target value to transition to.",
                "type": "int"
            }
        },
        "examples": [
            "from manim import *\n\nclass ChangeDecimalToValueExample(Scene):\n    def construct(self):\n        number = DecimalNumber(0)\n        self.add(number)\n        self.play(ChangeDecimalToValue(number, 10, run_time=3))\n        self.wait()"
        ]
    },
    "transformmatchingtex": {
        "parameters": {
            "mobject": {
                "name": "mobject",
                "description": "",
                "type": "Mobject"
            },
            "target_mobject": {
                "name": "target_mobject",
                "description": "",
                "type": "Mobject"
            },
            "transform_mismatches": {
                "name": "transform_mismatches",
                "description": "",
                "default": "False",
                "type": "bool"
            },
            "fade_transform_mismatches": {
                "name": "fade_transform_mismatches",
                "description": "",
                "default": "False",
                "type": "bool"
            },
            "key_map": {
                "name": "key_map",
                "description": "",
                "default": "None",
                "type": "dict | None"
            }
        },
        "examples": [
            "from manim import *\n\nclass MatchingEquationParts(Scene):\n    def construct(self):\n        variables = VGroup(MathTex(\"a\"), MathTex(\"b\"), MathTex(\"c\")).arrange_submobjects().shift(UP)\n        eq1 = MathTex(\"{{x}}^2\", \"+\", \"{{y}}^2\", \"=\", \"{{z}}^2\")\n        eq2 = MathTex(\"{{a}}^2\", \"+\", \"{{b}}^2\", \"=\", \"{{c}}^2\")\n        eq3 = MathTex(\"{{a}}^2\", \"=\", \"{{c}}^2\", \"-\", \"{{b}}^2\")\n        self.add(eq1)\n        self.wait(0.5)\n        self.play(TransformMatchingTex(Group(eq1, variables), eq2))\n        self.wait(0.5)\n        self.play(TransformMatchingTex(eq2, eq3))\n        self.wait(0.5)"
        ]
    },
    "animationgroup": {
        "parameters": {
            "animations": {
                "name": "animations",
                "description": "Sequence of :class:`~.Animation` objects to be played."
            },
            "group": {
                "name": "group",
                "description": "A group of multiple :class:`~.Mobject`."
            },
            "run_time": {
                "name": "run_time",
                "description": "The duration of the animation in seconds."
            },
            "rate_func": {
                "name": "rate_func",
                "description": "The function defining the animation progress based on the relative runtime (see :mod:`~.rate_functions`) ."
            },
            "lag_ratio": {
                "name": "lag_ratio",
                "description": "Defines the delay after which the animation is applied to submobjects. A lag_ratio of ``n.nn`` means the next animation will play when ``nnn%`` of the current animation has played. Defaults to 0.0, meaning that all animations will be played together. This does not influence the total runtime of the animation. Instead the runtime of individual animations is adjusted so that the complete animation has the defined run time."
            }
        },
        "examples": [
            "from manim import *\n\nclass AnimationGroupExample(Scene):\n    def construct(self):\n        red_dot = Dot(color=RED)\n        green_dot = Dot(color=GREEN).shift(LEFT)\n        blue_dot = Dot(color=BLUE).shift(RIGHT)\n        self.play(AnimationGroup(\n            FadeIn(red_dot),\n            FadeIn(green_dot),\n            FadeIn(blue_dot),\n            lag_ratio=0.5\n        ))"
        ]
    },
    "succession": {
        "parameters": {
            "animations": {
                "name": "animations",
                "description": "Sequence of :class:`~.Animation` objects to be played."
            },
            "lag_ratio": {
                "name": "lag_ratio",
                "description": "Defines the delay after which the animation is applied to submobjects. A lag_ratio of ``n.nn`` means the next animation will play when ``nnn%`` of the current animation has played. Defaults to 1.0, meaning that the next animation will begin when 100% of the current animation has played. This does not influence the total runtime of the animation. Instead the runtime of individual animations is adjusted so that the complete animation has the defined run time."
            }
        },
        "examples": [
            "from manim import *\n\nclass SuccessionExample(Scene):\n    def construct(self):\n        dot1 = Dot(point=LEFT * 2 + UP * 2, radius=0.16, color=BLUE)\n        dot2 = Dot(point=LEFT * 2 + DOWN * 2, radius=0.16, color=MAROON)\n        dot3 = Dot(point=RIGHT * 2 + DOWN * 2, radius=0.16, color=GREEN)\n        dot4 = Dot(point=RIGHT * 2 + UP * 2, radius=0.16, color=YELLOW)\n        self.add(dot1, dot2, dot3, dot4)\n        self.play(Succession(\n            dot1.animate.move_to(dot2),\n            dot2.animate.move_to(dot3),\n            dot3.animate.move_to(dot4),\n            dot4.animate.move_to(dot1)\n        ))"
        ]
    }
}
