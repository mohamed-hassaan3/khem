import PrelaunchVideo from "./PrelaunchVideo";

/**
 * ⚠️ TEMPORARY — the cover's moving background. Server Component.
 *
 * Six layers of authored light — see the header of `app/prelaunch/prelaunch.css`
 * for what each one is and why. All of it is CSS, so with no film configured
 * this background costs **no** network payload and **no** client JavaScript.
 *
 * ## The swap
 *
 * When `KHEM_PRELAUNCH_VIDEO_URL` is set, `<PrelaunchVideo>` renders on top and
 * fades in when its first frame decodes. The field stays mounted underneath
 * forever, which is the whole trick:
 *
 *  - there is no poster asset to produce, because the field *is* the poster;
 *  - there is no black frame at any point in loading;
 *  - a film that fails, is blocked, or is refused autoplay degrades to a
 *    finished composition rather than to an empty box;
 *  - no part of the cover is tuned to one frame of one video, so replacing the
 *    film is a change to one environment variable and nothing else.
 *
 * The layers are `<div>`s with no content and `aria-hidden` on the wrapper: the
 * whole background is decorative and must not appear in the accessibility tree.
 */
export default function PrelaunchFilm({ src }: { src: string | null }) {
  return (
    <div className="khem-cover-film" aria-hidden="true">
      <div className="khem-cover-sun" />
      <div className="khem-cover-bloom" />
      <div className="khem-cover-flutes" />
      <div className="khem-cover-haze" />
      <div className="khem-cover-grain" />
      {src === null ? null : <PrelaunchVideo src={src} />}
    </div>
  );
}
