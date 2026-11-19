import assert from "node:assert/strict";
import test from "node:test";

import {
  firstFramePoster,
  isCloudinaryVideo,
  mobileFallback,
  videoSources,
  withoutAudio,
} from "../src/lib/video-url";

const C = "https://res.cloudinary.com/co1xzkhf/video/upload";
const HERO = `${C}/f_auto,q_auto,w_828/v1792146108/KHEM-40.mp4`;
const ARRIVAL = `${C}/f_auto,q_auto,w_828/Hero.mp4`;
const BARE = `${C}/v1792146108/KHEM-40.mp4`;
const FOLDER = `${C}/v1/home/hero_films/KHEM-40.mp4`;

test("only Cloudinary video delivery URLs are understood", () => {
  assert.equal(isCloudinaryVideo(HERO), true);
  assert.equal(isCloudinaryVideo(ARRIVAL), true);
  assert.equal(isCloudinaryVideo("https://example.com/film.mp4"), false);
  assert.equal(isCloudinaryVideo(`https://res.cloudinary.com/co1xzkhf/image/upload/a.jpg`), false);
  assert.equal(isCloudinaryVideo("http://res.cloudinary.com/co1xzkhf/video/upload/a.mp4"), false);
  assert.equal(isCloudinaryVideo("not a url"), false);
});

test("anything else passes through every helper unchanged", () => {
  const other = "https://example.com/film.mp4?x=1";
  assert.equal(withoutAudio(other), other);
  assert.equal(mobileFallback(other), other);
  assert.equal(firstFramePoster(other, 720), null);
});

test("withoutAudio adds ac_none to the last transformation", () => {
  assert.equal(withoutAudio(HERO), `${C}/f_auto,q_auto,w_828,ac_none/v1792146108/KHEM-40.mp4`);
  assert.equal(withoutAudio(ARRIVAL), `${C}/f_auto,q_auto,w_828,ac_none/Hero.mp4`);
});

test("withoutAudio inserts a segment when there is no transformation", () => {
  assert.equal(withoutAudio(BARE), `${C}/ac_none/v1792146108/KHEM-40.mp4`);
});

test("withoutAudio is idempotent and respects an explicit ac_", () => {
  assert.equal(withoutAudio(withoutAudio(HERO)), withoutAudio(HERO));
  const explicit = `${C}/ac_aac/v1/a.mp4`;
  assert.equal(withoutAudio(explicit), explicit);
});

test("folders are not mistaken for transformations", () => {
  assert.equal(withoutAudio(FOLDER), `${C}/ac_none/v1/home/hero_films/KHEM-40.mp4`);
});

test("mobileFallback replaces the transformation", () => {
  assert.equal(
    mobileFallback(HERO),
    `${C}/f_auto,q_auto:eco,w_720,ac_none/v1792146108/KHEM-40.mp4`,
  );
  assert.equal(mobileFallback(BARE), `${C}/f_auto,q_auto:eco,w_720,ac_none/v1792146108/KHEM-40.mp4`);
});

test("firstFramePoster is a so_0 JPEG at the given width", () => {
  assert.equal(firstFramePoster(HERO, 720), `${C}/so_0,w_720,q_auto/v1792146108/KHEM-40.jpg`);
  assert.equal(firstFramePoster(ARRIVAL, 1920), `${C}/so_0,w_1920,q_auto/Hero.jpg`);
});

test("videoSources: the editor's mobile film wins, else the fallback", () => {
  const mobile = `${C}/v2/KHEM-40-portrait.mp4`;
  assert.deepEqual(videoSources(HERO, mobile), {
    desktop: `${C}/f_auto,q_auto,w_828,ac_none/v1792146108/KHEM-40.mp4`,
    mobile: `${C}/ac_none/v2/KHEM-40-portrait.mp4`,
  });
  for (const none of [null, undefined, "", "  "]) {
    assert.equal(
      videoSources(HERO, none).mobile,
      `${C}/f_auto,q_auto:eco,w_720,ac_none/v1792146108/KHEM-40.mp4`,
    );
  }
});
