import { Circle, Line, Node, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { waitFor } from "@motion-canvas/core";
import {
  FILMS,
  QUERIES,
  RADIUS,
  TURNS,
  doorX,
  events,
  sample,
  type FilmId,
} from "../../../web/src/series/model";
import { smooth, mix, clamp } from "../../../web/src/math";
import type { Vec } from "../../../web/src/math";
import { actor } from "../components/actor";
import type { Project } from "../geometry";
const WHITE = "#eeeae2",
  GRAY = "#83909e",
  ORANGE = "#ffb347",
  GREEN = "#a6d5ca";
export function seriesScene(id: FilmId) {
  return makeScene2D(function* (view) {
    let cachedTime = -1,
      cached: ReturnType<typeof sample>;
    const time = () => clamp(view.globalTime(), 0, FILMS[id].duration);
    const state = () => {
      const t = time();
      if (t !== cachedTime) {
        cached = sample(id, t);
        cachedTime = t;
      }
      return cached;
    };
    const scale = () => 1280 / state().camera.width;
    const project: Project = (p) => [
      (p.x - state().camera.x) * scale(),
      (state().camera.y - p.y) * scale(),
    ];
    const text = (
      value: () => string,
      p: () => Vec,
      size = 26,
      color = WHITE,
      opacity: () => number = () => 1,
    ) => (
      <Txt
        text={value}
        position={() => project(p())}
        fontFamily="DejaVu Sans"
        fontSize={size}
        fill={color}
        opacity={opacity}
      />
    );
    const line = (
      a: Vec | (() => Vec),
      b: Vec | (() => Vec),
      color = WHITE,
      width = 2,
      opacity = 1,
    ) => (
      <Line
        points={() => [
          project(typeof a === "function" ? a() : a),
          project(typeof b === "function" ? b() : b),
        ]}
        lineWidth={width}
        stroke={color}
        lineCap="round"
        opacity={opacity}
      />
    );
    const box = (
      p: () => Vec,
      w: number,
      h: number,
      fill = WHITE,
      opacity: () => number = () => 1,
    ) => (
      <Rect
        position={() => project(p())}
        width={() => w * scale()}
        height={() => h * scale()}
        fill={fill}
        opacity={opacity}
        radius={2}
      />
    );
    const gate = (x: number, y = 0, direction = 1) => (
      <Node>
        {line({ x: x - 0.15, y }, { x: x - 0.15, y: y + 2.15 }, GRAY, 2)}
        {line({ x: x + 0.15, y }, { x: x + 0.15, y: y + 2.15 }, GRAY, 2)}
        {box(() => ({ x, y: y + 1.02 + 2.2 * state().exit }), 0.12, 2.04)}
        {text(
          () => (direction > 0 ? "→" : "←"),
          () => ({ x: x + direction * 0.7, y: y + 1.9 }),
          27,
          GRAY,
        )}
      </Node>
    );
    if (id === "negative-ride") {
      const c = () => state().cart!;
      view.add(
        <>
          {line({ x: -7, y: 0 }, { x: 1.7, y: 0 })}
          {line({ x: 6.3, y: 0 }, { x: 15, y: 0 })}
          {line({ x: 1.7, y: 0 }, { x: 1.7, y: -0.7 }, GRAY, 1.5)}
          {line({ x: 6.3, y: 0 }, { x: 6.3, y: -0.7 }, GRAY, 1.5)}
          {line({ x: -7, y: -0.22 }, { x: 15, y: -0.22 }, GRAY, 1, 0.45)}
          {Array.from({ length: 32 }, (_, i) =>
            line(
              { x: i * 0.65 - 6, y: -0.27 },
              { x: i * 0.65 - 6.12, y: -0.43 },
              GRAY,
              1,
              0.3,
            ),
          )}
          {line({ x: 3.8, y: 1.43 }, { x: 5.1, y: 1.43 }, WHITE, 5)}
          {line({ x: 3.8, y: 1.43 }, { x: 3.8, y: 2.75 }, GRAY, 1.5)}
          {line({ x: 5.1, y: 1.43 }, { x: 5.1, y: 2.75 }, GRAY, 1.5)}
          {box(() => ({ x: 14.5 - 0.11 * time(), y: 1.05 }), 0.14, 2.1, GRAY)}
          {gate(-3.4, 0, -1)}
          {box(() => ({ x: c().x, y: 0.04 }), 1.04, 0.12)}
          {[-0.32, 0.32].map((dx) => (
            <Circle
              position={() => project({ x: c().x + dx, y: -0.12 })}
              size={() => 0.12 * scale()}
              stroke={WHITE}
              lineWidth={2}
            />
          ))}
          {line(
            () => ({ x: c().x - 0.35, y: 0.1 }),
            () => ({ x: c().x - 0.35, y: 1.12 }),
            GRAY,
            2,
          )}
          <Rect
            position={() => project({ x: c().x - 0.35, y: 1.12 })}
            width={76}
            height={34}
            radius={4}
            fill="#080a0d"
            stroke={() => (time() < 3 ? WHITE : GREEN)}
            lineWidth={2}
          />
          {text(
            () => "×(−1)",
            () => ({ x: c().x - 0.35, y: 1.12 }),
            19,
          )}
          {text(
            () => `u = ${c().u > 0 ? "+2" : c().u < 0 ? "−2" : "0"}`,
            () => ({ x: c().x + 0.65, y: 0.55 }),
            22,
          )}
          {text(
            () => "(+2) × (−1) = −2",
            () => ({ x: c().x, y: 2.55 }),
            31,
            WHITE,
            () => smooth(time(), 3, 3.2) * (1 - smooth(time(), 4.5, 4.85)),
          )}
          <Line
            points={() => [
              project({ x: c().x, y: -0.59 }),
              project({ x: c().x + 0.42 * c().v, y: -0.59 }),
            ]}
            lineWidth={3}
            stroke={GREEN}
            endArrow
            arrowSize={8}
          />
          {text(
            () => "v",
            () => ({ x: c().x, y: -0.88 }),
            20,
            GRAY,
          )}
          {text(
            () => "+x →",
            () => ({ x: 8, y: 2.9 }),
            19,
            GRAY,
            () => 0.55 * (1 - smooth(time(), 2, 2.5)),
          )}
        </>,
      );
    } else if (id === "binary-search") {
      const lift = () => 2.45 * smooth(time(), 12.45, 14.25),
        query = () => state().query!;
      view.add(
        <>
          {line({ x: -7, y: 0 }, { x: 10, y: 0 })}
          {line({ x: 4.42, y: 2.45 }, { x: 11, y: 2.45 })}
          {text(
            () => "a₁ < a₂ < ··· < a₁₆",
            () => ({ x: 0.15, y: 3.35 }),
            24,
            GRAY,
            () => 1 - smooth(time(), 8.8, 9.3),
          )}
          {Array.from({ length: 16 }, (_, i) => {
            const x = doorX(i + 1),
              q = QUERIES.find((q) => q.index === i + 1),
              active = () => i >= query().range[0] && i <= query().range[1],
              revealed = () => (q ? time() >= q.t : false);
            return (
              <Node
                opacity={() =>
                  active()
                    ? 1
                    : q
                      ? mix(1, 0.17, smooth(time(), q.t + 0.8, q.t + 1.1))
                      : 0.17
                }
              >
                <Rect
                  position={() => project({ x, y: 0.98 })}
                  width={() => 0.57 * scale()}
                  height={() => 1.96 * scale()}
                  stroke={GRAY}
                  lineWidth={1.5}
                  radius={4}
                />
                {box(() => ({ x, y: 1.1 }), 0.07, 0.17, WHITE)}
                {text(
                  () => (revealed() ? String(q!.value) : "·"),
                  () => ({ x, y: 2.24 }),
                  27,
                  WHITE,
                )}
                {text(
                  () => String(i + 1),
                  () => ({ x, y: -0.23 }),
                  16,
                  GRAY,
                )}
                <Node
                  opacity={() =>
                    q
                      ? smooth(time(), q.t, q.t + 0.08) *
                        (1 - smooth(time(), q.t + 0.75, q.t + 1.05))
                      : 0
                  }
                >
                  {text(
                    () => (q ? `${q.value} ${q.comparison} 63` : ""),
                    () => ({ x, y: 2.65 }),
                    28,
                    q?.comparison === "=" ? GREEN : WHITE,
                  )}
                </Node>
              </Node>
            );
          })}
          <Line
            points={() => {
              const done = QUERIES.filter((q) => time() >= q.t),
                last = done.at(-1),
                prev = done.length > 1 ? done.at(-2)!.after : [0, 15],
                w = last ? smooth(time(), last.t, last.t + 0.35) : 0,
                lo = mix(prev[0], query().range[0], w),
                hi = mix(prev[1], query().range[1], w),
                a = doorX(lo + 1) - 0.3,
                b = doorX(hi + 1) + 0.3;
              return [
                project({ x: a, y: -0.48 }),
                project({ x: a, y: -0.63 }),
                project({ x: b, y: -0.63 }),
                project({ x: b, y: -0.48 }),
              ];
            }}
            lineWidth={2.5}
            stroke={GREEN}
            lineJoin="round"
          />
          {text(
            () => `${query().range[1] - query().range[0] + 1}`,
            () => ({
              x:
                (doorX(query().range[0] + 1) + doorX(query().range[1] + 1)) / 2,
              y: -0.91,
            }),
            23,
            GREEN,
          )}
          {box(() => ({ x: doorX(13), y: lift() - 0.03 }), 1.1, 0.07)}
          {line(
            () => ({ x: doorX(13) + 0.08, y: lift() }),
            () => ({ x: doorX(13) + 0.08, y: 1.06 + lift() }),
            GRAY,
            1.5,
            0.5,
          )}
          {line(
            { x: doorX(13) - 0.4, y: 0 },
            { x: doorX(13) - 0.4, y: 4.2 },
            GRAY,
            1,
            0.45,
          )}
          {line(
            { x: doorX(13) + 0.4, y: 0 },
            { x: doorX(13) + 0.4, y: 4.2 },
            GRAY,
            1,
            0.45,
          )}
          {gate(7.6, 2.45)}
          <Rect
            position={() => project(state().cell!)}
            width={40}
            height={27}
            radius={4}
            fill="#080a0d"
            stroke={ORANGE}
            lineWidth={2}
          />
          {text(
            () => "63",
            () => state().cell!,
            18,
            ORANGE,
          )}
        </>,
      );
    } else {
      const orbit = () => state().orbit!;
      view.add(
        <>
          {line({ x: 2.25, y: 0 }, { x: 7, y: 0 })}
          {line({ x: -2.9, y: 0 }, { x: -2.12, y: 0 })}
          {line({ x: -2.3, y: 0 }, { x: 2.2, y: 0 }, GRAY, 1, 0.6)}
          {line({ x: 0, y: -2.15 }, { x: 0, y: 2.3 }, GRAY, 1, 0.6)}
          <Circle
            position={() => project({ x: 0, y: 0 })}
            size={() => 2 * RADIUS * scale()}
            stroke={GRAY}
            lineWidth={1.5}
            opacity={0.32}
          />
          <Line
            points={() =>
              Array.from({ length: 129 }, (_, i) => {
                const q = (orbit().theta * i) / 128;
                return project({
                  x: RADIUS * Math.cos(q),
                  y: RADIUS * Math.sin(q),
                });
              })
            }
            stroke={GREEN}
            lineWidth={3.5}
            lineCap="round"
            lineJoin="round"
          />
          {line(
            { x: 0, y: 0 },
            () => ({ x: orbit().x, y: orbit().y }),
            GRAY,
            1.5,
            0.75,
          )}
          <Circle
            position={() => project({ x: 0, y: 0 })}
            size={6}
            fill={WHITE}
          />
          {[
            { x: 2, y: -0.35, z: "1" },
            { x: 0, y: 2.03, z: "i" },
            { x: -2.02, y: -0.35, z: "−1" },
            { x: 0, y: -2.05, z: "−i" },
          ].map((p) =>
            text(
              () => p.z,
              () => p,
              29,
            ),
          )}
          {text(
            () => "Re",
            () => ({ x: 2.25, y: 0.2 }),
            18,
            GRAY,
          )}
          {text(
            () => "Im",
            () => ({ x: 0.32, y: 2.32 }),
            18,
            GRAY,
          )}
          {box(() => ({ x: orbit().x, y: orbit().y - 0.035 }), 0.9, 0.07)}
          {line(
            () => ({ x: orbit().x + 0.38, y: orbit().y }),
            () => ({ x: orbit().x + 0.38, y: orbit().y + 1.08 }),
            GRAY,
            1.5,
          )}
          <Rect
            position={() =>
              project({ x: orbit().x + 0.38, y: orbit().y + 1.08 })
            }
            width={45}
            height={31}
            fill="#080a0d"
            stroke={WHITE}
            lineWidth={1.5}
            radius={3}
          />
          {text(
            () => "×i",
            () => ({ x: orbit().x + 0.38, y: orbit().y + 1.08 }),
            21,
          )}
          {TURNS.map((q, i) => (
            <Node
              opacity={() =>
                smooth(time(), q.b, q.b + 0.1) *
                (1 - smooth(time(), q.b + 0.65, q.b + 0.9))
              }
            >
              {text(
                () =>
                  ["1 × i = i", "i × i = −1", "(−1) × i = −i", "(−i) × i = 1"][
                    i
                  ],
                () => ({ x: 0, y: 0.45 }),
                30,
              )}
            </Node>
          ))}
          {text(
            () => "i⁴ = 1",
            () => ({ x: 0, y: 0.45 }),
            37,
            WHITE,
            () => smooth(time(), 15.05, 15.3),
          )}
          {gate(5.25)}
          {box(
            () => ({ x: 5.03, y: 1.08 }),
            0.27,
            0.37,
            GRAY,
            () => 0.38,
          )}
          <Rect
            position={() => project(state().cell!)}
            width={() => 0.19 * scale()}
            height={() => 0.29 * scale()}
            fill={GREEN}
            radius={3}
          />
          {line({ x: -2.7, y: 0.77 }, { x: -1.97, y: 0.77 }, GRAY, 2)}
        </>,
      );
    }
    view.add(actor(() => state().rig, { project, scale, stroke: 0.85 }));
    const contacts = events(id).filter((e) =>
      ["footstep", "landing"].includes(e.kind),
    );
    view.add(
      <>
        {contacts.map((e) => (
          <Node
            opacity={() => {
              const d = time() - e.t;
              return d < 0 || d > 0.12 ? 0 : 0.45 * (1 - d / 0.12);
            }}
          >
            {[0, 1].map((i) => (
              <Circle
                position={() => {
                  const dt = clamp(time() - e.t, 0, 0.12);
                  const s = sample(id, e.t);
                  const f = s.rig.feet[i];
                  return project({
                    x: e.x + (i ? 1 : -1) * dt * 1.2,
                    y: Math.min(f.ankle.y, f.toe.y) + 0.02 + dt * 0.3,
                  });
                }}
                size={2.5}
                fill={GRAY}
              />
            ))}
          </Node>
        ))}
      </>,
    );
    yield* waitFor(FILMS[id].duration);
  });
}
