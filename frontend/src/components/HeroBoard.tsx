import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { GAME_DURATION, GAME_POSTER_FRAME, GAME_SIZE, HeroGame } from "@/remotion/HeroGame";

/** Lazy-loaded: pulls in remotion + the composition. Reduced motion gets one still frame. Pauses off-screen. */
export default function HeroBoard({ still }: { still: boolean }) {
  const ref = useRef<PlayerRef>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || still) return;
    const io = new IntersectionObserver(([en]) => {
      const p = ref.current;
      if (!p) return;
      if (en.isIntersecting) p.play();
      else p.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);
  return (
    <div ref={box}>
      <Player
        ref={ref}
        component={HeroGame}
        durationInFrames={GAME_DURATION}
        compositionWidth={GAME_SIZE.width}
        compositionHeight={GAME_SIZE.height}
        fps={30}
        autoPlay={!still}
        loop
        controls={false}
        initialFrame={still ? GAME_POSTER_FRAME : 0}
        clickToPlay={false}
        numberOfSharedAudioTags={0}
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: `${GAME_SIZE.width} / ${GAME_SIZE.height}` }}
      />
    </div>
  );
}
