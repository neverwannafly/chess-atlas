import { Player } from "@remotion/player";
import { OPERA_DURATION, OPERA_POSTER_FRAME, OPERA_SIZE, OperaGame, type OperaProps } from "@/remotion/OperaGame";

/** Lazy-loaded: pulls in remotion + the composition. Reduced motion gets one still frame. */
export default function HeroBoard({ places, total, still }: OperaProps & { still: boolean }) {
  return (
    <Player
      component={OperaGame}
      inputProps={{ places, total }}
      durationInFrames={OPERA_DURATION}
      compositionWidth={OPERA_SIZE.width}
      compositionHeight={OPERA_SIZE.height}
      fps={30}
      autoPlay={!still}
      loop
      controls={false}
      initialFrame={still ? OPERA_POSTER_FRAME : 0}
      clickToPlay={false}
      numberOfSharedAudioTags={0}
      initiallyMuted
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: `${OPERA_SIZE.width} / ${OPERA_SIZE.height}` }}
      aria-label="A chess game from Paris, 1858, played out beside live tournament counts"
    />
  );
}
