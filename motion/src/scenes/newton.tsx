import { Circle, Line, Txt, CubicBezier, makeScene2D } from "@motion-canvas/2d";
import { waitFor } from "@motion-canvas/core";
import {
  FILM,
  sample,
  curveBezier,
  point,
  SX,
  ROOT,
  FLOOR,
} from "../../../web/src/newton/model";
import { smooth, mix, clamp, type Vec } from "../../../web/src/math";
import { pulse } from "../../../web/src/series/acting";
import { actor } from "../components/actor";
import type { Project } from "../geometry";
const WHITE = "#eeeae5",
  DIM = "#727a84",
  BG = "#080a0d",
  ORANGE = "#ffa43b";
export default makeScene2D(function* (view) {
  let last = -1,
    cached: ReturnType<typeof sample>;
  const time = () => clamp(view.globalTime(), 0, FILM.duration);
  const s = () => {
    const t = time();
    if (t !== last) {
      cached = sample(t);
      last = t;
    }
    return cached;
  };
  const scale = () => 1280 / s().camera.width;
  const p: Project = (q) => [
    (q.x - s().camera.x) * scale(),
    (s().camera.y - q.y) * scale(),
  ];
  type V = Vec | (() => Vec);
  const val = (q: V) => (typeof q === "function" ? q() : q);
  const line = (
    a: V,
    b: V,
    width = 2,
    color = WHITE,
    alpha: () => number = () => 1,
  ) => (
    <Line
      points={() => [p(val(a)), p(val(b))]}
      stroke={color}
      lineWidth={width}
      lineCap="round"
      opacity={alpha}
    />
  );
  const dot = (
    q: V,
    size = 0.065,
    color = WHITE,
    alpha: () => number = () => 1,
  ) => (
    <Circle
      position={() => p(val(q))}
      size={() => size * scale()}
      fill={color}
      opacity={alpha}
    />
  );
  const txt = (
    text: () => string,
    q: V,
    size = 0.21,
    alpha: () => number = () => 1,
    color = WHITE,
  ) => (
    <Txt
      text={text}
      position={() => p(val(q))}
      fill={color}
      fontFamily="DejaVu Sans"
      fontSize={() => size * scale()}
      opacity={alpha}
    />
  );
  const geometry = () => curveBezier(s().left, s().right);
  const g = () => s().guide;
  const tangentAlpha = () =>
    time() < 58.9 ? mix(0.12, 1, s().reveal) : time() < 65.1 ? 0.13 : 1;
  const tangentStart = () => {
    if (time() < 12) {
      const w = s().reveal;
      return { x: mix(-0.26, -0.38, w), y: 1 + mix(0.26, 0.38, w) / 3 };
    }
    return g().p;
  };
  const tangentEnd = () =>
    time() < 12
      ? {
          x: mix(0.26, 3.38, s().reveal),
          y: 1 - mix(0.26, 3.38, s().reveal) / 3,
        }
      : g().target;
  view.add(
    <>
      {line(
        () => ({ x: s().camera.x - s().camera.width, y: FLOOR }),
        () => ({ x: s().camera.x + s().camera.width, y: FLOOR }),
        1,
        DIM,
        () => 0.26 * smooth(time(), 25.4, 26.2),
      )}
      {line(
        () => ({ x: SX * s().left, y: 0 }),
        () => ({ x: 4.1 * s().reveal, y: 0 }),
        1.25,
        DIM,
        () => s().reveal * 0.8,
      )}
      <CubicBezier
        p0={() => p(geometry().p0)}
        p1={() => p(geometry().p1)}
        p2={() => p(geometry().p2)}
        p3={() => p(geometry().p3)}
        stroke={WHITE}
        lineWidth={2.25}
        lineCap="round"
        opacity={() => s().reveal}
      />
      {line(tangentStart, tangentEnd, 2.6, WHITE, tangentAlpha)}
      {line(
        () => ({ x: SX * g().seed, y: 0 }),
        () => g().p,
        1,
        DIM,
        () =>
          s().reveal *
          (g().phase === "map" ? 0.7 : 0.23) *
          (s().guide.editing ? 0 : 1),
      )}
      {dot(
        () => g().p,
        0.065,
        WHITE,
        () => s().reveal * (s().guide.editing ? 0.15 : 1),
      )}
      {dot(
        () => g().target,
        0.085,
        WHITE,
        () => s().reveal * (s().guide.editing ? 0.15 : 1),
      )}
      {line(
        () => ({ x: g().carrier.x - 0.3, y: g().carrier.y }),
        () => ({ x: g().carrier.x + 0.3, y: g().carrier.y }),
        3.7,
        WHITE,
        () => (time() < 58.9 || time() >= 65.1 ? 1 : 0.2),
      )}
      {dot(
        () => g().carrier,
        0.1,
        WHITE,
        () => (time() < 58.9 || time() >= 65.1 ? 1 : 0.2),
      )}
      {line(
        { x: -0.09, y: 1.04 },
        { x: 0.055, y: 0.96 },
        1.7,
        ORANGE,
        () => s().scratch * 0.65,
      )}
      {line({ x: -0.075, y: 0.06 }, { x: 0.075, y: -0.055 }, 1.6, ORANGE, () =>
        smooth(time(), 21.8, 22.05),
      )}
      {txt(
        () => "0",
        { x: -0.17, y: -0.26 },
        0.22,
        () => smooth(time(), 19.9, 20.3),
      )}
      {txt(
        () => "1",
        { x: 3.15, y: -0.26 },
        0.22,
        () => smooth(time(), 19.9, 20.3),
      )}
      {txt(
        () => "−2",
        { x: -6, y: 0.26 },
        0.22,
        () => s().label,
      )}
      {line({ x: -6, y: -0.07 }, { x: -6, y: 0.07 }, 1, WHITE, () => s().label)}
      {txt(
        () => "f(x) = x³ − 2x + 2",
        () => ({ x: -3.6, y: 2.15 }),
        0.28,
        () => s().label * (1 - smooth(time(), 64, 66)),
      )}
      {txt(
        () => "xₙ₊₁ = xₙ − f(xₙ) / f′(xₙ)",
        () => ({ x: -3.6, y: 1.57 }),
        0.27,
        () => s().formula,
      )}
      {line(point(-2), { x: -5.4, y: 0 }, 2, WHITE, () => s().probe)}
      {line({ x: -6, y: 0 }, point(-2), 1, DIM, () => s().probe * 0.6)}
      {dot({ x: -5.4, y: 0 }, 0.07, WHITE, () => s().probe)}
      {dot(point(-2), 0.07, WHITE, () => s().probe)}
      {txt(
        () => "−1.8",
        { x: -5.25, y: 0.3 },
        0.2,
        () => s().probe,
      )}
      {line(
        () => ({ x: s().cursor.x, y: -0.08 }),
        () => ({ x: s().cursor.x, y: 0.08 }),
        1.4,
        ORANGE,
        () => pulse(time(), 58.7, 65.2, 0.15),
      )}
      <Circle
        position={() => p(s().cursor)}
        size={() => 0.13 * scale()}
        fill={BG}
        stroke={ORANGE}
        lineWidth={2}
        opacity={() => pulse(time(), 58.65, 65.2, 0.12)}
      />
      {txt(
        () =>
          time() < 64.9
            ? "x₀ = " + (s().cursor.x / SX).toFixed(2).replace("-", "−")
            : "x₀ = −2",
        () => ({ x: s().cursor.x, y: 0.47 }),
        0.24,
        () => pulse(time(), 59.3, 66.2, 0.2),
      )}
      {txt(
        () => "x ≈ −1.7693",
        { x: SX * ROOT - 0.1, y: -0.55 },
        0.26,
        () => s().final,
      )}
      {txt(
        () => "f(x) ≈ 0",
        { x: SX * ROOT - 0.1, y: -0.94 },
        0.22,
        () => s().final,
      )}
    </>,
  );
  view.add(actor(() => s().rig, { project: p, scale, color: ORANGE }));
  view.add(
    <>
      {line(
        () => s().poleA,
        () => s().poleB,
        2.6,
        WHITE,
        () => smooth(time(), 25.1, 26.4),
      )}
      {dot(
        () => s().poleB,
        0.045,
        WHITE,
        () => pulse(time(), 48.2, 53.5, 0.6),
      )}
      {line(
        () => ({ x: g().target.x - 0.12, y: 0.035 }),
        () => ({ x: g().target.x + 0.12, y: 0.035 }),
        1.5,
        ORANGE,
        () => pulse(time(), 74.7, 76.6, 0.3),
      )}
    </>,
  );
  yield* waitFor(FILM.duration);
});
