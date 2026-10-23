"""Editable scene entrypoint. Keep this interface when replacing the story."""

from demo_engine.scenes import DURATION as DURATION, render_frame as draw_demo
from demo_engine.audio import write_audio as synth_demo

SCENE = "__DEMO__"


def render_frame(t, scale=1.5):
    """Absolute scene time -> Pillow RGB image. No dependence on earlier frames."""
    return draw_demo(SCENE, t, scale)[0]


def write_audio(path):
    """Optional: write a WAV aligned with scene time 0; omit for a silent scene."""
    synth_demo(path, SCENE)
