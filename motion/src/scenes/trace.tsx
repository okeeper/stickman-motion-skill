import {
  Circle,
  CubicBezier,
  Latex,
  Line,
  Txt,
  makeScene2D,
} from "@motion-canvas/2d";
import { createRef, waitFor } from "@motion-canvas/core";
import { smooth } from "../../../web/src/math";
import { FILM, JUMP, sample } from "../model";
import { project } from "../geometry";
import { actor } from "../components/actor";
export default makeScene2D(function* (view) {
  const time = () => view.globalTime();
  const state = () => sample(time());
  const equation = createRef<Latex>();
  const formulaOpacity = () => smooth(time(), 6.8, 7.6);
  view.add(
    <>
      <Txt
        text="A TRACE OF GRAVITY"
        x={-375}
        y={-303}
        fontSize={18}
        letterSpacing={4}
        fill="#858b95"
        fontFamily="DejaVu Sans"
      />
      <Line
        points={[project({ x: 0.5, y: 0 }), project({ x: 6.35, y: 0 })]}
        stroke="#f3f0e9"
        lineWidth={3}
        lineCap="round"
      />
      {[1.8, 4.05].map((x) => (
        <Line
          points={[project({ x, y: 0 }), project({ x, y: -0.08 })]}
          stroke="#858b95"
          lineWidth={2}
        />
      ))}
      <CubicBezier
        p0={() => state().arc.p0}
        p1={() => state().arc.p1}
        p2={() => state().arc.p2}
        p3={() => state().arc.p3}
        stroke="#eeeae2"
        lineWidth={3.5}
        lineCap="round"
        opacity={() =>
          smooth(time(), JUMP.takeoff, JUMP.takeoff + 0.08) *
          (1 - 0.55 * smooth(time(), 5.2, 6.2))
        }
      />
      <Circle
        position={() => state().arc.p0}
        size={8}
        fill="#eeeae2"
        opacity={() => smooth(time(), JUMP.land + 0.6, JUMP.land + 1)}
      />
      <Circle
        position={() => state().arc.p3}
        size={8}
        fill="#eeeae2"
        opacity={() => smooth(time(), JUMP.land + 0.6, JUMP.land + 1)}
      />
      {actor(() => state().rig)}
      <Latex
        ref={equation}
        tex={String.raw`{{\Delta y}}{{=}}{{v_0\tau}}{{-}}{{\frac12 g\tau^2}}`}
        position={[120, -245]}
        fontSize={39}
        fill="#f3f0e9"
        opacity={formulaOpacity}
      />
      <Latex
        tex={String.raw`g>0,\quad\tau>0,\quad v_0=v_y(0)`}
        position={[320, -110]}
        fontSize={21}
        fill="#858b95"
        opacity={() => smooth(time(), 7.6, 8.1)}
      />
      <Txt
        text="CONSTANT GRAVITY  /  NO AIR RESISTANCE"
        position={[40, 303]}
        fontSize={15}
        letterSpacing={2}
        fill="#858b95"
        fontFamily="DejaVu Sans"
        opacity={formulaOpacity}
      />
    </>,
  );
  yield* waitFor(8.2);
  yield* equation().tex(
    String.raw`{{2}}{{\Delta y}}{{=}}{{2}}{{v_0\tau}}{{-}}{{g\tau^2}}`,
    1.1,
  );
  yield* waitFor(1.7);
  yield* equation().tex(
    String.raw`{{g\tau^2}}{{=}}{{2}}{{v_0\tau}}{{-}}{{2}}{{\Delta y}}`,
    1.2,
  );
  yield* waitFor(1.6);
  yield* equation().tex(
    String.raw`{{g}}{{=}}{{\frac{2(v_0\tau-\Delta y)}{\tau^2}}}`,
    1.3,
  );
  yield* waitFor(FILM.duration - 15.1);
});
