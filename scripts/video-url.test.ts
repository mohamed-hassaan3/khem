import assert from "node:assert/strict";
import test from "node:test";

import {
  DESKTOP_TRANSFORMATION,
  PHONE_TRANSFORMATION,
  firstFramePoster,
  isCloudinaryVideo,
  originalOf,
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
  assert.deepEqual(videoSources(other), { desktop: other, mobile: other });
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

test("firstFramePoster is a so_0 JPEG at the given width", () => {
  assert.equal(firstFramePoster(HERO, 720), `${C}/so_0,w_720,q_auto/v1792146108/KHEM-40.jpg`);
  assert.equal(firstFramePoster(ARRIVAL, 1920), `${C}/so_0,w_1920,q_auto/Hero.jpg`);
});

test("the cuts are the agreed transformations", () => {
  assert.equal(PHONE_TRANSFORMATION, "f_auto,q_auto:eco,w_720,du_20,ac_none");
  assert.equal(DESKTOP_TRANSFORMATION, "f_auto,q_auto,w_1920,du_20,ac_none");
});

test("videoSources replaces whatever the editor pasted with both cuts", () => {
  for (const source of [HERO, BARE]) {
    assert.deepEqual(videoSources(source), {
      desktop: `${C}/f_auto,q_auto,w_1920,du_20,ac_none/v1792146108/KHEM-40.mp4`,
      mobile: `${C}/f_auto,q_auto:eco,w_720,du_20,ac_none/v1792146108/KHEM-40.mp4`,
    });
  }
  assert.deepEqual(videoSources(ARRIVAL), {
    desktop: `${C}/f_auto,q_auto,w_1920,du_20,ac_none/Hero.mp4`,
    mobile: `${C}/f_auto,q_auto:eco,w_720,du_20,ac_none/Hero.mp4`,
  });
  assert.equal(
    videoSources(FOLDER).mobile,
    `${C}/f_auto,q_auto:eco,w_720,du_20,ac_none/v1/home/hero_films/KHEM-40.mp4`,
  );
});

test("originalOf strips every transformation", () => {
  assert.equal(originalOf(HERO), BARE);
  assert.equal(originalOf(BARE), BARE);
  assert.equal(originalOf("https://example.com/a.mp4"), "https://example.com/a.mp4");
});
