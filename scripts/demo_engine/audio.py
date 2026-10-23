"""Original procedural score and event sounds. No sampled or remote audio."""

from __future__ import annotations
import math
import wave
import numpy as np
from .scenes import DURATION, SCENES, cues

RATE = 48000


def synthesize(scene, rate=RATE):
    if scene not in SCENES:
        raise ValueError(f"unknown scene: {scene}")
    rng = np.random.default_rng(2410 + SCENES.index(scene))
    output = np.zeros((round(DURATION * rate), 2), dtype=np.float64)

    def add(at, length, freq, amp=0.1, kind="bell", pan=0):
        n = round(length * rate)
        t = np.arange(n) / rate
        f0, f1 = freq if isinstance(freq, tuple) else (freq, freq)
        phase = math.tau * (f0 * t + (f1 - f0) * t * t / (2 * length))
        env = np.minimum(1, t / 0.012) * np.exp(-t / (length * 0.25))
        env *= np.minimum(1, (length - t) / 0.025)
        if kind == "noise":
            signal = rng.normal(size=n)
            signal = np.convolve(signal, np.ones(20) / 20, mode="same")
            env = np.sin(np.pi * t / length) ** 2 * np.minimum(1, (length - t) / 0.04)
        elif kind == "bass":
            signal = np.sin(phase) + 0.12 * np.sin(2 * phase)
        else:
            signal = np.sin(phase) + 0.28 * np.sin(phase * 2.01) * np.exp(-t * 8)
        signal *= env * amp
        start = round(at * rate)
        end = min(len(output), start + n)
        if start < 0 or start >= end:
            return
        stereo = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)])
        output[start:end] += signal[: end - start, None] * stereo

    # Sparse original ostinato, 96 BPM. Deliberately below contact cues.
    roots = [146.8324, 130.8128, 164.8138, 146.8324]
    for beat, at in enumerate(np.arange(0.4, 32.0, 0.625)):
        root = roots[(beat // 8) % 4]
        if beat % 4 == 0:
            add(at, 1.7, root / 2, 0.035, "bass")
        ratio = [1, 1.5, 2, 1.25, 1.5, 2, 1.25, 1.5][beat % 8]
        add(at, 1.0, root * ratio, 0.025, pan=0.28 * math.sin(beat))
    for at, kind in cues(scene):
        if kind == "click":
            add(at, 0.14, (880, 440), 0.21)
        elif kind == "wrong":
            add(at, 0.48, (270, 130), 0.22, "bass")
            add(at + 0.12, 0.38, (216, 105), 0.12)
        elif kind == "flip":
            add(at, 0.38, (330, 660), 0.13)
            add(at + 0.17, 0.3, 660, 0.07)
        elif kind == "sweep":
            add(at, 0.8, (200, 500), 0.17, "noise", -0.15)
            add(at + 0.08, 0.55, (220, 440), 0.07)
        elif kind == "move":
            for j in range(8):
                add(at + j * 0.11, 0.08, 100 + j * 17, 0.075, "bass", -0.25 + j / 20)
        elif kind == "jump":
            add(at, 0.32, (180, 510), 0.12)
        elif kind == "open":
            add(at, 0.7, (330, 550), 0.1)
        elif kind in ("pickup", "win"):
            for j, f in enumerate((523.251, 659.255, 783.991, 1046.502)):
                add(at + j * 0.13, 1.45, f, 0.105, pan=(j - 1.5) / 6)
    # Smooth end, no clipping or per-scene loudness normalization surprises.
    fade = min(round(0.8 * rate), len(output) // 2)
    output[:fade] *= np.linspace(0, 1, fade)[:, None]
    output[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = float(np.abs(output).max())
    if peak >= 0.95:
        output *= 0.95 / peak
    return output


def write_audio(path, scene):
    samples = synthesize(scene)
    pcm = np.round(samples * 32767).astype("<i2")
    with wave.open(str(path), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    return {
        "sample_rate": RATE,
        "channels": 2,
        "peak_dbfs": round(20 * math.log10(max(1e-12, np.abs(samples).max())), 2),
    }
