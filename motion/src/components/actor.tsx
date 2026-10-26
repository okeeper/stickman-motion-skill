import { Circle, Knot, Line, Node, Spline } from "@motion-canvas/2d";
import type { Rig, Limb } from "../../../web/src/rig";
import { jointKnots, project } from "../geometry";
const ORANGE = "#ffb347";
/** This is a skin adapter. It never moves IK joints, hands, or planted feet. */
export function actor(rig: () => Rig) {
  const limb = (get: () => Limb, opacity: number) => (
    <Spline
      lineWidth={10}
      stroke={ORANGE}
      opacity={opacity}
      lineCap="round"
      lineJoin="round"
    >
      {[0, 1, 2].map((i) => (
        <Knot
          position={() => jointKnots(get().a, get().hinge, get().b)[i].position}
          startHandle={() =>
            jointKnots(get().a, get().hinge, get().b)[i].startHandle ?? [0, 0]
          }
          endHandle={() =>
            jointKnots(get().a, get().hinge, get().b)[i].endHandle ?? [0, 0]
          }
        />
      ))}
    </Spline>
  );
  return (
    <Node>
      {limb(() => rig().arms[0], 0.45)}
      {limb(() => rig().legs[0], 0.45)}
      <Spline
        points={() =>
          [rig().hip, rig().spine, rig().shoulder, rig().neck].map(project)
        }
        smoothness={0.35}
        stroke={ORANGE}
        lineWidth={11}
        lineCap="round"
      />
      {limb(() => rig().legs[1], 1)}
      {[0, 1].map((i) => (
        <Line
          points={() => [rig().feet[i].ankle, rig().feet[i].toe].map(project)}
          lineWidth={8}
          lineCap="round"
          stroke={ORANGE}
          opacity={i ? 1 : 0.45}
        />
      ))}
      {limb(() => rig().arms[1], 1)}
      <Circle
        position={() => project(rig().head)}
        size={46}
        lineWidth={9}
        stroke={ORANGE}
        fill="#080a0d"
      />
    </Node>
  );
}
