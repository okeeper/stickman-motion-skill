import {
  Circle,
  Line,
  Node,
  Rect,
  Spline,
  Txt,
  makeScene2D,
} from "@motion-canvas/2d";
import { waitFor } from "@motion-canvas/core";
import {
  FILMS,
  QUERIES,
  RADIUS,
  TURNS,
  LEDGE,
  DECK,
  doorX,
  sample,
  type FilmId,
} from "../../../web/src/series/model";
import { smooth, mix, clamp, type Vec } from "../../../web/src/math";
import { pulse } from "../../../web/src/series/acting";
import { actor } from "../components/actor";
import type { Project } from "../geometry";
const WHITE = "#eeeae5",
  DIM = "#697079",
  BG = "#080a0d",
  ORANGE = "#ffa43b";
export function seriesScene(id: FilmId) {
  return makeScene2D(function* (view) {
    let last = -1,
      cached: ReturnType<typeof sample>;
    const time = () => clamp(view.globalTime(), 0, FILMS[id].duration);
    const state = () => {
      const t = time();
      if (t !== last) {
        cached = sample(id, t);
        last = t;
      }
      return cached;
    };
    const scale = () => 1280 / state().camera.width;
    const p: Project = (q) => [
      (q.x - state().camera.x) * scale(),
      (state().camera.y - q.y) * scale(),
    ];
    type V = Vec | (() => Vec);
    const value = (q: V) => (typeof q === "function" ? q() : q);
    const line = (
      a: V,
      b: V,
      width = 2,
      color = WHITE,
      opacity: () => number = () => 1,
    ) => (
      <Line
        points={() => [p(value(a)), p(value(b))]}
        stroke={color}
        lineWidth={width}
        lineCap="round"
        opacity={opacity}
      />
    );
    const text = (
      content: () => string,
      pos: () => Vec,
      size = 0.25,
      opacity: () => number = () => 1,
      color = WHITE,
    ) => (
      <Txt
        text={content}
        position={() => p(pos())}
        fill={color}
        fontFamily="DejaVu Sans"
        fontSize={() => size * scale()}
        opacity={opacity}
      />
    );
    const rect = (
      pos: () => Vec,
      w: number,
      h: number,
      opacity: () => number = () => 1,
      fill = BG,
      stroke = WHITE,
      width = 2,
    ) => (
      <Rect
        position={() => p(pos())}
        size={() => [w * scale(), h * scale()]}
        fill={fill}
        stroke={stroke}
        lineWidth={width}
        radius={1.5}
        opacity={opacity}
      />
    );
    const world = new Node({});
    view.add(world);
    if (id === "negative-ride") {
      const c = () => state().cart!;
      world.add(
        <>
          {line(
            () => ({ x: state().camera.x - state().camera.width, y: 0 }),
            () => ({ x: state().camera.x + state().camera.width, y: 0 }),
            1,
            DIM,
            () => 0.14,
          )}
          <Line
            points={() => [
              p({ x: c().x - Math.sign(c().v || 1) * 1.7, y: DECK }),
              p({ x: c().x - Math.sign(c().v || 1) * 0.72, y: DECK }),
            ]}
            stroke={WHITE}
            lineWidth={1}
            opacity={0.18}
          />
          {line(
            () => ({ x: c().x - 0.66, y: DECK }),
            () => ({ x: c().x + 0.66, y: DECK }),
            3.2,
          )}
          <Line
            points={() => {
              const dir = mix(-1, 1, smooth(c().v, -0.08, 0.08)),
                tip = { x: c().x + dir * 0.66, y: DECK };
              return [
                p({ x: tip.x - dir * 0.2, y: DECK + 0.13 }),
                p(tip),
                p({ x: tip.x - dir * 0.2, y: DECK - 0.13 }),
              ];
            }}
            stroke={WHITE}
            lineWidth={3.2}
            lineCap="round"
            lineJoin="round"
          />
          {line(
            () => ({ x: c().x - 0.35, y: DECK + 0.03 }),
            () => ({ x: c().x - 0.35, y: 0.62 }),
            1.1,
            WHITE,
            () => 0.35 * c().tab,
          )}
          <Line
            points={() => [
              p({ x: c().x - 0.52, y: 0.61 }),
              p({ x: c().x - 0.35, y: 0.66 + 0.08 * c().tab }),
              p({ x: c().x - 0.18, y: 0.61 }),
            ]}
            stroke={WHITE}
            lineWidth={1.6}
            opacity={() => 0.45 + 0.55 * c().tab}
          />
          {text(
            () => "×(−1)",
            () => ({ x: c().x - 0.35, y: 0.86 }),
            0.235,
            () => c().tab,
          )}
          {text(
            () => `u = ${c().u > 0 ? "+2" : "−2"}`,
            () => ({ x: c().x + 1.05, y: 1.45 }),
            0.24,
            () => clamp(c().readout),
          )}
          {text(
            () => "(+2) × (−1) × (−1) = +2",
            () => ({ x: c().x, y: 2.08 }),
            0.245,
            () => c().equation,
          )}
        </>,
      );
    }
    if (id === "binary-search") {
      const q = () => state().query!;
      const portX = (i: number) => Math.min(i, q().unfold * 15) * 0.72;
      world.add(
        line(
          () => ({ x: -1.9, y: 0 }),
          () => ({ x: 11.8 * q().unfold, y: 0 }),
          1,
          DIM,
          () => 0.12,
        ),
      );
      for (let i = 0; i < 16; i++) {
        const shown = () =>
          i === 0 ? 1 : smooth(q().unfold * 15, i - 0.55, i + 0.1);
        const hit = () => q().queries.find((v) => v.index === i + 1);
        const reveal = () => {
          const h = hit();
          return Math.max(
            (1 - q().close) * shown(),
            h ? smooth(time(), h.t, h.t + 0.26) : 0,
          );
        };
        const alpha = () => {
          const h = hit(),
            outside = i < q().range[0] || i > q().range[1];
          return shown() * (h ? 0.7 : outside ? 0.23 : 0.9);
        };
        world.add(
          <>
            {rect(() => ({ x: portX(i), y: 0.98 }), 0.58, 0.72, alpha)}
            <Rect
              position={() => p({ x: portX(i), y: 0.98 })}
              width={() => 0.5 * scale()}
              height={() => 0.62 * scale() * (1 - reveal())}
              fill={WHITE}
              opacity={() => shown() * 0.075}
            />
            {line(
              () => ({ x: portX(i) - 0.2, y: 1.31 }),
              () => ({ x: portX(i) + 0.2, y: 1.31 }),
              1,
              WHITE,
              () => shown() * (0.3 + 0.4 * reveal()),
            )}
            {text(
              () => String(q().original[i]),
              () => ({ x: portX(i), y: 1.02 }),
              0.255,
              () => shown() * reveal(),
            )}
            {i < 15 &&
              text(
                () => "<",
                () => ({ x: portX(i) + 0.36, y: 1.46 }),
                0.14,
                () => shown() * 0.32 * q().unfold,
              )}
          </>,
        );
      }
      for (const query of QUERIES)
        world.add(
          text(
            () => `${query.value} ${query.comparison} 63`,
            () => ({ x: doorX(query.index), y: 1.94 }),
            0.245,
            () => pulse(time(), query.t + 0.7, query.t + 2.5, 0.25),
          ),
        );
      world.add(
        <>
          <Rect
            position={() => p({ x: doorX(13), y: 0.98 })}
            size={() => [0.5 * scale(), 0.62 * scale() * q().inner]}
            fill={BG}
            opacity={() => q().inner}
          />
          {line(
            () => ({ x: doorX(13) - 0.25, y: 0.67 }),
            () => ({ x: doorX(13) + 0.25, y: 0.67 }),
            1.5,
            WHITE,
            () => q().inner,
          )}
        </>,
      );
    }
    if (id === "complex-rotation") {
      const o = () => state().orbit!;
      const light = () => smooth(time(), 12.6, 13.1);
      world.add(
        <>
          {line(
            { x: LEDGE.x, y: LEDGE.y },
            { x: LEDGE.x + 2.3, y: LEDGE.y },
            2.3,
          )}
          {line(
            { x: LEDGE.x, y: LEDGE.y },
            { x: LEDGE.x, y: LEDGE.y - 0.45 },
            1,
            DIM,
            () => 0.45,
          )}
          {line(
            { x: 0, y: 0 },
            () => ({ x: o().x, y: o().y }),
            1,
            WHITE,
            () => 0.05,
          )}
          <Line
            points={() => {
              const n = Math.max(2, Math.ceil(o().theta * 48));
              return Array.from({ length: n + 1 }, (_, i) =>
                p({
                  x: RADIUS * Math.cos((o().theta * i) / n),
                  y: RADIUS * Math.sin((o().theta * i) / n),
                }),
              );
            }}
            stroke={WHITE}
            lineWidth={1.2}
            opacity={() => 0.32 * light()}
            lineCap="round"
          />
          {line(
            () => ({
              x: o().x * (1 - light()) * 0.8,
              y: o().y * (1 - light()) * 0.8,
            }),
            () => ({ x: o().x, y: o().y }),
            3.5,
          )}
          <Circle
            position={() => p({ x: 0, y: 0 })}
            size={() => 0.13 * scale()}
            fill={BG}
            stroke={WHITE}
            lineWidth={1.8}
            opacity={light}
          />
          {text(
            () => "0",
            () => ({ x: -0.2, y: -0.23 }),
            0.19,
            light,
            DIM,
          )}
          <Circle
            position={() => p({ x: o().x, y: o().y })}
            size={() => 0.065 * scale()}
            fill={WHITE}
          />
          {text(
            () => o().z,
            () => ({ x: o().x + 0.13, y: o().y + 0.36 }),
            0.28,
            () => (o().turning ? 0 : 1),
          )}
          {TURNS.map((turn, i) =>
            text(
              () =>
                ["1 × i = i", "i × i = −1", "(−1) × i = −i", "(−i) × i = 1"][i],
              () => ({ x: state().orbit!.x, y: state().orbit!.y + 0.8 }),
              0.25,
              () => pulse(time(), turn.b + 0.15, turn.b + 3, 0.35),
            ),
          )}
          {text(
            () => "i⁴ = 1",
            () => ({ x: 1.2, y: 4.65 }),
            0.31,
            () => smooth(time(), 85, 86),
          )}
        </>,
      );
    }
    view.add(
      actor(() => state().rig, {
        project: p,
        scale,
        color: ORANGE,
        armOpacity: () =>
          id === "binary-search" &&
          state().query!.insert * (1 - state().query!.withdraw) > 0.02
            ? [0.45, 0]
            : [0.45, 1],
      }),
    );
    if (id === "binary-search") {
      const q = () => state().query!,
        f = () => state().frame!;
      const inserted = () => q().insert * (1 - q().withdraw);
      view.add(
        <>
          <Spline
            points={() => {
              const r = state().rig,
                a = r.arms[1];
              return [a.a, a.hinge, { x: doorX(13) - 0.16, y: 1.04 }].map(p);
            }}
            smoothness={0.24}
            lineWidth={() => (10 * scale()) / 150}
            stroke={ORANGE}
            lineCap="round"
            opacity={() => (inserted() > 0.02 ? 1 : 0)}
          />
          <Rect
            position={() => p(f())}
            size={() => [0.58 * scale(), 0.42 * scale()]}
            rotation={() => (f().rotation * 180) / Math.PI}
            fill={BG}
            stroke={WHITE}
            lineWidth={2.1}
          />
          {text(
            () => "63",
            () => ({ x: f().x, y: f().y + 0.31 }),
            0.19,
            () => q().target,
          )}
          <Spline
            points={() => {
              const k = inserted();
              return [
                p({ x: f().x - 0.05, y: f().y - 0.1 }),
                p({ x: f().x + 0.025, y: f().y - 0.01 }),
                p({ x: f().x + 0.17 * k, y: f().y + 0.055 * k }),
              ];
            }}
            smoothness={0.32}
            lineWidth={() => (7 * scale()) / 150}
            stroke={ORANGE}
            lineCap="round"
            opacity={() => inserted()}
          />
          {[0, 1, 2].map((i) => (
            <Line
              points={() => {
                const k = inserted(),
                  curl = time() > 70 && time() < 75 ? q().finger : 0.2,
                  tap =
                    pulse(time(), 77.1, 77.28, 0.05) +
                    pulse(time(), 77.38, 77.56, 0.05),
                  x = f().x + 0.17 * k,
                  y = f().y + 0.055 * k;
                return [
                  p({ x, y }),
                  p({
                    x: x + (0.065 - 0.02 * i) * k,
                    y: y + (0.055 - 0.03 * i) * k * (1 - curl) - tap * 0.04,
                  }),
                  p({
                    x: x + (0.09 - 0.02 * i) * k,
                    y:
                      y +
                      (0.045 - 0.03 * i) * k * (1 - curl) -
                      curl * 0.035 -
                      tap * 0.04,
                  }),
                ];
              }}
              stroke={ORANGE}
              lineWidth={() => (3.4 * scale()) / 150}
              lineCap="round"
              lineJoin="round"
              opacity={inserted}
            />
          ))}
        </>,
      );
    }
    if (id === "complex-rotation") {
      const c = () => state().clip!;
      view.add(
        <>
          <Rect
            position={() => p(c())}
            size={() => [0.24 * scale(), (0.11 + 0.15 * c().open) * scale()]}
            fill={BG}
            stroke={WHITE}
            lineWidth={1.3}
          />
          {text(
            () => "i",
            () => ({ x: c().x, y: c().y }),
            0.22,
            () => c().open,
          )}
          {line(
            () => ({ x: c().x - 0.13, y: c().y + 0.14 }),
            () => ({ x: c().x + 0.13, y: c().y + 0.14 }),
            1,
            WHITE,
            () => c().open * c().detach,
          )}
        </>,
      );
    }
    yield* waitFor(FILMS[id].duration);
  });
}
