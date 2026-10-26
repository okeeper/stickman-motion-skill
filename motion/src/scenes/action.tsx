import { Circle, Line, Node, Rect, Txt, makeScene2D } from "@motion-canvas/2d";
import { waitFor } from "@motion-canvas/core";
import { clamp, smooth } from "../../../web/src/math";
import {
  EVENTS,
  FILM,
  GAP,
  GATE_X,
  SHARD_X,
  sample,
} from "../../../web/src/action/model";
import { actor } from "../components/actor";
import type { Point, Project } from "../geometry";
export default makeScene2D(function* (view) {
  let cachedTime = -1,
    cached: ReturnType<typeof sample>;
  const time = () => Math.min(FILM.duration, Math.max(0, view.globalTime()));
  const state = () => {
    const t = time();
    if (t !== cachedTime) {
      cached = sample(t);
      cachedTime = t;
    }
    return cached;
  };
  const scale = 190;
  const project: Project = (p) => [
    (p.x - state().camera) * scale,
    210 - p.y * scale,
  ];
  const line = (a: Point, b: Point, color = "#eeeae2", width = 3) => (
    <Line
      points={() => [project(a), project(b)]}
      lineWidth={width}
      lineCap="round"
      stroke={color}
    />
  );
  view.add(
    <>
      {[-1, 6, 12, 19, 26, 33, 40].map((x, i) => (
        <Txt
          text={["[ ]", "01", "∥", "[]", "10", "∥", "01"][i]}
          fontSize={44}
          position={() => project({ x, y: 2.65 })}
          fill="#667381"
          opacity={0.13}
          fontFamily="DejaVu Sans"
        />
      ))}
      {line({ x: -6, y: 0 }, { x: GAP.from, y: 0 })}
      {line({ x: GAP.to, y: 0 }, { x: SHARD_X - 0.55, y: 0 })}
      {line({ x: SHARD_X + 0.07, y: 0 }, { x: 48, y: 0 })}
      {line({ x: GAP.from, y: 0 }, { x: GAP.from, y: -0.8 }, "#69717b", 2)}
      {line({ x: GAP.to, y: 0 }, { x: GAP.to, y: -0.8 }, "#69717b", 2)}
      <Line
        points={() => [
          project({ x: SHARD_X - 0.55, y: 0 }),
          project({ x: SHARD_X, y: 0.14 * smooth(time(), 5.26, 5.32) }),
        ]}
        stroke="#eeeae2"
        lineWidth={4}
        lineCap="round"
      />
      <Line
        points={() => [
          project({ x: SHARD_X, y: 0 }),
          project({ x: SHARD_X, y: 0.14 * smooth(time(), 5.26, 5.32) }),
        ]}
        stroke="#eeeae2"
        lineWidth={3}
      />
      <Line
        points={() => [
          project({ x: 3.4, y: 1.75 }),
          project({ x: 3.85, y: 1.75 }),
          project({ x: 3.7, y: 1.86 }),
          project({ x: 3.85, y: 1.75 }),
          project({ x: 3.7, y: 1.64 }),
        ]}
        stroke="#b9c0c8"
        lineWidth={2.8}
        lineCap="round"
      />
      <Node
        opacity={() =>
          smooth(time(), 1.15, 1.25) * (1 - smooth(time(), 8.8, 9.08))
        }
      >
        <Rect
          width={18}
          height={1120}
          fill="#cbd3dd"
          opacity={0.18}
          x={() =>
            project({ x: -0.2 + 3.3 * Math.max(0, time() - 1.15), y: 0 })[0]
          }
        />
        <Line
          points={() => [
            project({ x: -0.2 + 3.3 * Math.max(0, time() - 1.15), y: 0 }),
            project({ x: -0.2 + 3.3 * Math.max(0, time() - 1.15), y: 2.6 }),
          ]}
          stroke="#e1e6ed"
          lineWidth={3}
        />
      </Node>
      <Node>
        {line(
          { x: GATE_X - 0.12, y: 0 },
          { x: GATE_X - 0.12, y: 2.4 },
          "#76818e",
          2,
        )}
        {line(
          { x: GATE_X + 0.12, y: 0 },
          { x: GATE_X + 0.12, y: 2.4 },
          "#76818e",
          2,
        )}
        <Rect
          position={() =>
            project({
              x: GATE_X,
              y: 3.8 * (1 - smooth(time(), 8.12, 9.08)) + 1.5,
            })
          }
          width={20}
          height={570}
          fill="#eeeae2"
        />
        <Line
          points={() => [
            project({ x: GATE_X - 0.17, y: 0.02 }),
            project({ x: GATE_X + 0.17, y: 0.02 }),
          ]}
          lineWidth={5}
          stroke="#eeeae2"
        />
      </Node>
      {actor(() => state().rig, { project, scale: () => scale, stroke: 0.78 })}
      {EVENTS.filter((e) =>
        ["footstep", "landing", "body"].includes(e.kind),
      ).map((event) => (
        <Node
          opacity={() => {
            const dt = time() - event.t;
            return dt < 0 || dt > 0.13
              ? 0
              : (1 - dt / 0.13) * (event.kind === "footstep" ? 0.45 : 0.7);
          }}
        >
          {[0, 1, 2].map((j) => (
            <Circle
              size={j ? 2 : 3}
              fill="#aab0b8"
              position={() => {
                const dt = clamp(time() - event.t, 0, 0.13),
                  direction = j === 0 ? -1 : 1;
                return project({
                  x: event.x + direction * dt * (0.5 + j * 0.7),
                  y:
                    0.03 +
                    Math.sin((dt / 0.13) * Math.PI) * (0.015 + j * 0.008),
                });
              }}
            />
          ))}
        </Node>
      ))}
    </>,
  );
  // Match real-world timing; slow motion is a preview diagnostic only.
  yield* waitFor(FILM.duration);
});
