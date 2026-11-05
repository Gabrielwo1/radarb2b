import { Composition } from "remotion";
import { DURACAO, FPS, Reel } from "./Reel";
import { DURACAO2, Reel2 } from "./Reel2";

export const Root = () => (
  <>
    <Composition id="Reel1" component={Reel} durationInFrames={DURACAO} fps={FPS} width={1080} height={1920} />
    <Composition id="Reel2" component={Reel2} durationInFrames={DURACAO2} fps={FPS} width={1080} height={1920} />
  </>
);
