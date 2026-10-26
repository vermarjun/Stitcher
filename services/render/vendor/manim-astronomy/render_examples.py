"""Render the plugin's OWN documented example scenes (from README + docs rst).

These reproduce the scenes shipped in the repository documentation, adapted to
import from the installed `manim_Astronomy` package. Rendered with the Cairo
renderer (Stitcher's render service default).

    .venv/bin/manim -ql --disable_caching render_examples.py SpaceTimeFabricDistortionByAStar
    .venv/bin/manim -ql --disable_caching render_examples.py GravitationalWaves
    .venv/bin/manim -ql --disable_caching render_examples.py KeplersSecondLaw
"""

import numpy as np
from manim import *

from manim_Astronomy.stellar_objects import Star, Planet, SpaceTimeFabric


def gravitational_potential(u, v, mass_positions, masses):
    G = 1
    potential = 0
    epsilon = 0.1
    for i in range(len(mass_positions)):
        mass_posu, mass_posv, mass_posz = mass_positions[i]
        M = masses[i]
        r = np.sqrt((u - mass_posu) ** 2 + (v - mass_posv) ** 2 + mass_posz ** 2)
        if r < epsilon:
            r += 0.05
        potential += -G * M / r
    return potential


class SpaceTimeFabricDistortionByAStar(ThreeDScene):
    def construct(self):
        mass1 = Dot3D(point=[0, 0, 0.3], radius=0.3)
        mass2 = Dot3D(point=[1.1, 0, 0], radius=0.05)
        fabric = SpaceTimeFabric(
            u_range=(-2, 2),
            v_range=(-2, 2),
            resolution=(40, 40),
            t_range=(-2, 2),
            scaling_factor=0.01,
            func=gravitational_potential,
            func_args=([mass1.get_center(), mass2.get_center()], [50, 2]),
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=-90 * DEGREES)
        self.add(fabric, mass1, mass2)
        self.wait(1)


def wave_function(u, v, t):
    wavelength = 0.5
    amplitude = 0.2
    distance_from_center = np.sqrt(u ** 2 + v ** 2)
    return amplitude * np.sin(2 * np.pi * (distance_from_center - t) / wavelength)


class GravitationalWaves(ThreeDScene):
    def construct(self):
        merged_masses = Dot3D(point=[0, 0, 0], radius=0.15, color=BLACK)
        fabric = SpaceTimeFabric(
            u_range=(-2, 2),
            v_range=(-2, 2),
            resolution=(40, 40),
            t_range=(-2, 2),
            scaling_factor=0.1,
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=-90 * DEGREES)
        self.add(fabric, merged_masses)
        t_tracker = ValueTracker(0)

        def update_fabric(mob):
            t = t_tracker.get_value()
            mob.become(
                SpaceTimeFabric(
                    u_range=(-2, 2),
                    v_range=(-2, 2),
                    resolution=(40, 40),
                    scaling_factor=0.1,
                    t_range=(-2, 2),
                    func=wave_function,
                    func_args=(t,),
                )
            )

        fabric.add_updater(update_fabric)
        self.play(t_tracker.animate.increment_value(2), run_time=2, rate_func=linear)


class KeplersSecondLaw(ThreeDScene):
    def construct(self):
        star = Star(radius=1, num_of_particles=400, size_of_particle=0.005, colors=[YELLOW])
        self.add(star)
        planet = Planet(center=[1, 0, 0], radius=0.05)
        self.add(planet)
        a, b = 4, 6
        orbit = ParametricFunction(
            lambda t: np.array([a * np.cos(t), b * np.sin(t), 0]),
            t_range=[0, TAU],
            color=BLUE,
        )
        self.add(orbit)
        time_tracker = ValueTracker(0)
        planet.add_updater(
            lambda mob: mob.move_to(orbit.point_from_proportion(time_tracker.get_value()))
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=-90 * DEGREES)
        self.play(time_tracker.animate.set_value(1), run_time=2, rate_func=linear)
