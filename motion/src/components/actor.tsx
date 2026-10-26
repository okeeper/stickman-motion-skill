import { Circle, Knot, Line, Node, Spline } from "@motion-canvas/2d";
import type { Rig, Limb } from "../../../web/src/rig";
import {
  jointKnots,
  project as defaultProject,
  type Project,
} from "../geometry";
const ORANGE = "#ffb347";
/** This is a skin adapter. It never moves IK joints, hands, or planted feet. */
export function actor(
  rig: () => Rig,
  options: {
    project?: Project;
    scale?: () => number;
    stroke?: number;
    color?: string;
    armOpacity?: () => number[];
  } = {},
) {
  const project = options.project ?? defaultProject;
  const color = options.color ?? ORANGE;
  const factor = () =>
    ((options.scale?.() ?? 150) / 150) * (options.stroke ?? 1);
  const knots = (get: () => Limb) =>
    jointKnots(get().a, get().hinge, get().b, project);
  const limb = (get: () => Limb, opacity: number | (() => number)) => (
    <Spline
      lineWidth={() => 10 * factor()}
      stroke={color}
      opacity={opacity}
      lineCap="round"
      lineJoin="round"
    >
      {[0, 1, 2].map((i) => (
        <Knot
          position={() => knots(get)[i].position}
          startHandle={() => knots(get)[i].startHandle ?? [0, 0]}
          endHandle={() => knots(get)[i].endHandle ?? [0, 0]}
        />
      ))}
    </Spline>
  );
  return (
    <Node>
      {limb(
        () => rig().arms[0],
        () => options.armOpacity?.()[0] ?? 0.45,
      )}
      {limb(() => rig().legs[0], 0.45)}
      <Spline
        points={() =>
          [rig().hip, rig().spine, rig().shoulder, rig().neck].map(project)
        }
        smoothness={0.35}
        stroke={color}
        lineWidth={() => 11 * factor()}
        lineCap="round"
      />
      {limb(() => rig().legs[1], 1)}
      {[0, 1].map((i) => (
        <Line
          points={() => [rig().feet[i].ankle, rig().feet[i].toe].map(project)}
          lineWidth={() => 8 * factor()}
          lineCap="round"
          stroke={color}
          opacity={i ? 1 : 0.45}
        />
      ))}
      {limb(
        () => rig().arms[1],
        () => options.armOpacity?.()[1] ?? 1,
      )}
      <Circle
        position={() => project(rig().head)}
        size={() => (46 * (options.scale?.() ?? 150)) / 150}
        lineWidth={() => 9 * factor()}
        stroke={color}
        fill="#080a0d"
      />
    </Node>
  );
}
