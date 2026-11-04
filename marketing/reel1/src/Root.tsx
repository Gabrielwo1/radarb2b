import { Composition } from "remotion";
import { Reel, DURACAO, FPS } from "./Reel";

export const Root = () => (
  <Composition id="Reel1" component={Reel} durationInFrames={DURACAO} fps={FPS} width={1080} height={1920} />
);
