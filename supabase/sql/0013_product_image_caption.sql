-- KHEM — a detail page for body care and home fragrance.
--
-- Applied by `npm run db:migrate`. Every statement is idempotent.
--
-- ## What this adds
--
-- Two columns, `"ProductImage".caption` and its `caption_ar` twin, and the
-- content that fills them: a story on each of the eight body-care and
-- home-fragrance products, and two more photographs each, so every one of them
-- has the three `/ritual/[slug]` lays out as a triptych.
--
-- ## Why the line lives on the image and not on the product
--
-- The caption belongs *to* the photograph — it names what is in that frame.
-- Stored on the product it would be three nullable `story2`/`story3` columns
-- that only mean anything in the right order, and nothing would stop an editor
-- deleting the middle photograph and leaving its sentence behind, now printed
-- under a different picture. On the image, the `on delete cascade` in
-- `0001_catalog.sql` already keeps the pair together and `"sortOrder"` already
-- orders them.
--
-- It is not the alt text reworded, either. `alt` narrates the photograph to
-- somebody who cannot see it; the caption is printed beside the photograph for
-- somebody who can, and the two sit close enough together that duplicating one
-- into the other would read as a stutter to anyone using a screen reader.
--
-- Both columns are nullable and both stay null for the fragrances: a gallery
-- with no captions renders no caption strip, which is what keeps
-- `/perfume/[slug]` exactly as it was.
--
-- ## Why the writes are guarded rather than upserted
--
-- `on conflict do nothing` on the inserts, `where … is null` on the updates.
-- The dashboard writes these same rows with the service key, so a re-run of
-- this file on a database an editor has already worked in must not put the
-- seeded placeholder back over their photograph or their copy. The same
-- reasoning as `0012_merch_page.sql`, applied to a backfill rather than a seed.
--
-- Image ids follow `db-seed.ts`'s scheme — `<slug>-image-<index>` — so seeding
-- a fresh database from `supabase/seed/catalog.json` converges on exactly these
-- rows rather than appending a second copy of each photograph.

alter table public."ProductImage" add column if not exists caption      text;
alter table public."ProductImage" add column if not exists "caption_ar" text;

-- ── The stories ─────────────────────────────────────────────
--
-- One paragraph each. `where story is null` is the guard: these eight products
-- shipped with no story at all, so a null is the untouched state and anything
-- else is an editor's work.

update public."Product"
   set story = 'Amber began as a resin burned in temple courtyards — something a room wore, not a person. The mist is the house''s concession to a modern morning: the same blood orange and benzoin, loosened until they sit on skin without announcing themselves. Sprayed at the shoulders it holds through a working day, and it deepens rather than fades when the eau de parfum goes over it.',
       story_ar = 'بدأ Amber راتنجًا يُحرق في أفنية المعابد — عطرًا ترتديه الغرفة لا الإنسان. وهذا الرذاذ هو تنازل الدار للصباح المعاصر: البرتقال الدموي واللبان الجاوي نفساهما، مخفَّفان حتى يستقرّا على البشرة دون أن يعلنا عن نفسيهما. رشّة عند الكتفين تكفي ليوم عمل كامل، ويزداد عمقًا — لا خفوتًا — حين يأتي ماء العطر فوقه.'
 where slug = 'amber-body-mist'
   and story is null;

update public."Product"
   set story = 'Opal was composed for the hour after bathing, when skin is warm and takes scent too readily. Aldehydes and silver iris give it the powder; white amber keeps the powder from going cold. It is the lightest way into the accord — worn alone it reads almost as clean skin, which is the point, and layered it turns the eau de parfum quieter and longer.',
       story_ar = 'رُكِّب Opal للساعة التي تلي الاستحمام، حين تكون البشرة دافئة وتلتقط العطر بسهولة مفرطة. الألدهيدات وسوسن الفضة تمنحه البودرة، والعنبر الأبيض يمنع تلك البودرة من أن تبرد. هو أخفّ مدخل إلى الأكورد — وحده يكاد يُقرأ كبشرة نظيفة، وهذا هو المقصد؛ وفوق ماء العطر يجعله أهدأ وأطول بقاءً.'
 where slug = 'opal-body-mist'
   and story is null;

update public."Product"
   set story = 'The stone this accord is named for was ground for eyelids long before it was set in gold. Blue iris, violet leaf and cashmere wood keep something of that mineral coolness — the mist sits a little away from the skin rather than melting into it. It is the one to reach for on a day too warm for an extrait, and the one that layers cleanest.',
       story_ar = 'الحجر الذي حمل هذا الأكورد اسمه كان يُسحق للجفون قبل أن يُرصَّع في الذهب بزمن طويل. يحتفظ السوسن الأزرق وورق البنفسج وخشب الكشمير بشيء من ذلك البرود المعدني — فيستقرّ الرذاذ على مبعدة قليلة من البشرة بدل أن يذوب فيها. هو ما تختاره في يوم أدفأ من أن يحتمل الإكستريه، وهو الأنظف حين يُطبَّق طبقات.'
 where slug = 'lapis-body-mist'
   and story is null;

update public."Product"
   set story = 'The lightest thing the house makes, and deliberately so. Neroli, sea salt and white musk, misted over skin after sun or shower, where anything heavier would sit wrongly. It does not last the day and is not meant to — this is the fragrance of the hour just after water, and the house would rather it were reapplied than made to endure.',
       story_ar = 'أخفّ ما تصنعه الدار، وعن قصد. نيرولي وملح البحر والمسك الأبيض، تُرذّ على البشرة بعد الشمس أو الاستحمام، حيث يستقرّ أي شيء أثقل في غير موضعه. لا يدوم اليوم كلّه، ولم يُصنع ليدوم — هذا عطر الساعة التي تلي الماء مباشرة، والدار تفضّل أن يُعاد رشّه على أن يُثقَل ليبقى.'
 where slug = 'turquoise-body-mist'
   and story is null;

update public."Product"
   set story = 'Five pumps and a room changes. Amber was always a room''s fragrance first — resin on coals, in a courtyard, for hours — and the spray is the shortest way back to that. It hangs at head height without settling into anything sweet, and it suits the rooms people sit still in: a study after dark, a dining table between courses.',
       story_ar = 'خمس ضغطات وتتبدّل الغرفة. كان Amber عطر غرفة قبل كل شيء — راتنج على الجمر، في فناء، لساعات — وهذا البخّاخ هو أقصر طريق للعودة إلى ذلك. يعلق في مستوى الرأس دون أن يستقرّ في حلاوة، ويليق بالغرف التي يسكن فيها الناس: مكتب بعد حلول الظلام، أو مائدة بين طبقين.'
 where slug = 'amber-room-spray'
   and story is null;

update public."Product"
   set story = 'Clean rather than sweet, which is rarer in a room spray than it should be. Aldehydes and silver iris give a room the quality of fresh linen without the laundry note that usually stands in for it. It belongs in a bedroom, a bathroom, or any room that should feel recently opened — and it leaves politely rather than lingering into the evening.',
       story_ar = 'نظيف لا حلو، وهو أمر أندر في بخّاخات الغرف مما ينبغي. تمنح الألدهيدات وسوسن الفضة الغرفة صفة الكتّان الطازج، دون نغمة الغسيل التي تحلّ محلّها عادة. مكانه غرفة نوم أو حمّام، أو أي غرفة يُراد لها أن تبدو حديثة الفتح — ثم ينصرف بلياقة بدل أن يتمدّد حتى المساء.'
 where slug = 'opal-room-spray'
   and story is null;

update public."Product"
   set story = 'Cool where the others are warm. Blue iris, juniper and cashmere wood hold a room at a slight distance instead of filling it, which is why it works in a hallway or a study and not especially well in a bedroom. Use it early in the day. It is the only home fragrance the house makes that reads as morning.',
       story_ar = 'بارد حيث تكون البقية دافئة. يُبقي السوسن الأزرق والعرعر وخشب الكشمير الغرفة على مسافة بدل أن يملأها، ولهذا ينجح في ممرّ أو مكتب ولا ينجح كثيرًا في غرفة نوم. استخدمه في أول النهار. هو عطر المنزل الوحيد في الدار الذي يُقرأ صباحًا.'
 where slug = 'lapis-room-spray'
   and story is null;

update public."Product"
   set story = 'A window opened onto the sea, for a room that has no window onto anything. Neroli, sea salt and driftwood, and no sweetness at all — it is the one for a room that has been closed up, or lived in a little too long. Three pumps is usually enough; it is stronger than its lightness suggests.',
       story_ar = 'نافذة مفتوحة على البحر، لغرفة لا نافذة لها على شيء. نيرولي وملح البحر وخشب الطافي، وبلا أي حلاوة على الإطلاق — هو ما تستخدمه في غرفة ظلّت مغلقة، أو سُكنت أطول قليلًا مما ينبغي. ثلاث ضغطات تكفي عادة؛ فهو أقوى مما توحي خفّته.'
 where slug = 'turquoise-room-spray'
   and story is null;

-- ── The primary photograph gains its caption ────────────────
--
-- These rows already exist; only the new column is written, and only where it
-- has never been written before.

update public."ProductImage"
   set caption = 'The bottle, photographed under the same low light the accord was corrected in.',
       "caption_ar" = 'الزجاجة، مصوَّرة تحت الضوء الخافت نفسه الذي صُحِّح فيه الأكورد.'
 where "productSlug" = 'amber-body-mist'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Photographed against a bathing-chamber wall, which is where it was meant to stand.',
       "caption_ar" = 'مصوَّرة أمام جدار حجرة استحمام، وهو المكان الذي صُنعت لتقف فيه.'
 where "productSlug" = 'opal-body-mist'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Deep blue in low light only; by a window the bottle reads almost grey.',
       "caption_ar" = 'أزرق عميق في الضوء الخافت وحده؛ وقرب النافذة تكاد الزجاجة تُقرأ رمادية.'
 where "productSlug" = 'lapis-body-mist'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Pale sea-lit stone — the light the accord was corrected under.',
       "caption_ar" = 'حجر شاحب يضيئه ضوء البحر — الضوء الذي صُحِّح الأكورد تحته.'
 where "productSlug" = 'turquoise-body-mist'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Against a warm interior wall — the light this accord furnishes best.',
       "caption_ar" = 'أمام جدار داخلي دافئ — الضوء الذي يؤثّثه هذا الأكورد أفضل ما يكون.'
 where "productSlug" = 'amber-room-spray'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'A dim interior, which is where the powder in it becomes legible.',
       "caption_ar" = 'غرفة خافتة الضوء، وفيها تصير البودرة في تركيبته مقروءة.'
 where "productSlug" = 'opal-room-spray'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Blue thrown across dark stone — the only way this accord photographs honestly.',
       "caption_ar" = 'أزرق يُلقى على حجر داكن — الطريقة الوحيدة التي يُصوَّر بها هذا الأكورد بصدق.'
 where "productSlug" = 'lapis-room-spray'
   and "isPrimary"
   and caption is null;

update public."ProductImage"
   set caption = 'Pale stone, sea light — the room this was made for, if you have one.',
       "caption_ar" = 'حجر شاحب وضوء بحر — الغرفة التي صُنع لها، إن كانت لديك.'
 where "productSlug" = 'turquoise-room-spray'
   and "isPrimary"
   and caption is null;

-- ── The second and third photographs ────────────────────────
--
-- `isPrimary` is false on every row here: `0001_catalog.sql` holds a unique
-- partial index on one primary per product, and these join a gallery that
-- already has one.

insert into public."ProductImage"
  (id, "productSlug", url, alt, alt_ar, caption, "caption_ar", "isPrimary", "sortOrder")
values
  ('amber-body-mist-image-1', 'amber-body-mist',
   'https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=800&h=1000&fit=crop&auto=format',
   'Frankincense resin tears in low golden light',
   'دموع راتنج اللبان في ضوء ذهبي خافت',
   'Benzoin arrives as resin, is weighed as resin, and is never rushed into solution.',
   'يصل اللبان الجاوي راتنجًا، ويُوزن راتنجًا، ولا يُستعجَل ذوبانه أبدًا.',
   false, 1),
  ('amber-body-mist-image-2', 'amber-body-mist',
   'https://images.unsplash.com/photo-1760860992203-85ca32536788?w=800&h=1000&fit=crop&auto=format',
   'A weathered piece of ambergris against deep shadow',
   'قطعة عنبر بحري متعتّقة أمام ظلّ عميق',
   'Red amber — what the courtyards burned, at a fraction of the strength.',
   'العنبر الأحمر — ما كانت تحرقه الأفنية، بجزء يسير من قوّته.',
   false, 2),
  ('opal-body-mist-image-1', 'opal-body-mist',
   'https://images.unsplash.com/photo-1631189944771-466264f05965?w=800&h=1000&fit=crop&auto=format',
   'A dark iris bloom against deep shadow',
   'زهرة سوسن داكنة أمام ظلّ عميق',
   'Silver iris, cut at dawn — the rhizome, not the flower, is what is distilled.',
   'سوسن فضي يُقطف عند الفجر — والجذمور، لا الزهرة، هو ما يُقطَّر.',
   false, 1),
  ('opal-body-mist-image-2', 'opal-body-mist',
   'https://images.unsplash.com/photo-1618994492420-b4f4d6b4890c?w=800&h=1000&fit=crop&auto=format',
   'A mouth-blown crystal flacon resting after hand-polishing',
   'قارورة كريستال منفوخة بالفم تستريح بعد الصقل اليدوي',
   'Even the mist is finished by hand; nothing leaves the atelier unpolished.',
   'حتى الرذاذ يُنهى يدويًا؛ لا شيء يغادر المشغل دون صقل.',
   false, 2),
  ('lapis-body-mist-image-1', 'lapis-body-mist',
   'https://images.unsplash.com/photo-1613549026666-73c9c9083c62?w=800&h=1000&fit=crop&auto=format',
   'Vetiver roots drying before distillation',
   'جذور نجيل الهند تجفّ قبل التقطير',
   'Vetiver roots, dried upright for a season before they are allowed near a still.',
   'جذور نجيل الهند، تُجفَّف واقفة موسمًا كاملًا قبل أن يُسمح لها بالاقتراب من الإنبيق.',
   false, 1),
  ('lapis-body-mist-image-2', 'lapis-body-mist',
   'https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=800&h=1000&fit=crop&auto=format',
   'Carved hieroglyphs lit by low raking light',
   'نقوش هيروغليفية محفورة يضيئها ضوء مائل خافت',
   'The blue the tomb painters ground by hand, and the reason for the name.',
   'الأزرق الذي سحقه رسّامو المقابر بأيديهم، وهو سبب التسمية.',
   false, 2),
  ('turquoise-body-mist-image-1', 'turquoise-body-mist',
   'https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=800&h=1000&fit=crop&auto=format',
   'Neroli blossoms from the Egyptian bitter orange harvest',
   'أزهار نيرولي من حصاد البرتقال المرّ المصري',
   'Neroli from the Egyptian bitter orange harvest, picked before the heat reaches it.',
   'نيرولي من حصاد البرتقال المرّ المصري، يُقطف قبل أن يبلغه حرّ النهار.',
   false, 1),
  ('turquoise-body-mist-image-2', 'turquoise-body-mist',
   'https://images.unsplash.com/photo-1615885108069-7d5bef9a7e22?w=800&h=1000&fit=crop&auto=format',
   'Raw botanical materials laid out for grading before selection',
   'مواد نباتية خام مفروشة للتصنيف قبل الاختيار',
   'Every botanical is graded by hand before it is allowed into a mist this light.',
   'تُصنَّف كل مادة نباتية يدويًا قبل أن يُسمح لها بدخول رذاذ بهذه الخفّة.',
   false, 2),
  ('amber-room-spray-image-1', 'amber-room-spray',
   'https://images.unsplash.com/photo-1762530211537-011645caef57?w=800&h=1000&fit=crop&auto=format',
   'Ancient Egyptian vessels used for blending sacred oils',
   'أوانٍ مصرية قديمة كانت تُستخدم لمزج الزيوت المقدّسة',
   'The vessels the oils were blended in, before a room could be scented in seconds.',
   'الأواني التي كانت تُمزج فيها الزيوت، قبل أن يصير تعطير غرفة أمر ثوانٍ.',
   false, 1),
  ('amber-room-spray-image-2', 'amber-room-spray',
   'https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=800&h=1000&fit=crop&auto=format',
   'Ancient Egyptian relief carvings in warm low light',
   'نقوش مصرية قديمة بارزة في ضوء دافئ خافت',
   'Courtyard walls held this smell for a thousand years. The spray holds it for six hours.',
   'احتفظت جدران الأفنية بهذه الرائحة ألف عام. ويحتفظ بها البخّاخ ست ساعات.',
   false, 2),
  ('opal-room-spray-image-1', 'opal-room-spray',
   'https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=800&h=1000&fit=crop&auto=format',
   'A bottle being filled by hand and fitted with its onyx stopper',
   'زجاجة تُعبّأ يدويًا وتُركَّب لها سدادة الأونيكس',
   'Filled by hand, one bottle at a time, and stoppered the same way.',
   'يُعبّأ يدويًا، زجاجة تلو الأخرى، وتُركَّب سدادته بالطريقة نفسها.',
   false, 1),
  ('opal-room-spray-image-2', 'opal-room-spray',
   'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?w=800&h=1000&fit=crop&auto=format',
   'A lacquered black presentation box lined with hand-marbled tissue',
   'علبة تقديم سوداء مطليّة بالورنيش مبطّنة بورق مرمَّر يدويًا',
   'It arrives boxed like a flacon; a room spray is not a lesser object here.',
   'يصل معلَّبًا كقارورة عطر؛ فبخّاخ الغرفة ليس شيئًا أدنى في هذه الدار.',
   false, 2),
  ('lapis-room-spray-image-1', 'lapis-room-spray',
   'https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=800&h=1000&fit=crop&auto=format',
   'A caravan route at dusk, tracing the historic oud trade',
   'درب قافلة عند الغسق، يتتبّع تجارة العود التاريخية',
   'Juniper came down the same routes as the resins, and arrived the colder of the two.',
   'جاء العرعر عبر الطرق نفسها التي جاءت منها الراتنجات، ووصل أبردهما.',
   false, 1),
  ('lapis-room-spray-image-2', 'lapis-room-spray',
   'https://images.unsplash.com/photo-1709666414115-47ecd5143293?w=800&h=1000&fit=crop&auto=format',
   'The perfumer''s organ, ranked with trial vials mid-formulation',
   'أرغن العطّار مصفوفًا بقوارير التجربة في منتصف التركيب',
   'Nineteen trials before the juniper stopped reading as gin.',
   'تسع عشرة تجربة قبل أن يكفّ العرعر عن أن يُقرأ كالجن.',
   false, 2),
  ('turquoise-room-spray-image-1', 'turquoise-room-spray',
   'https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=800&h=1000&fit=crop&auto=format',
   'Neroli blossoms from the Egyptian bitter orange harvest',
   'أزهار نيرولي من حصاد البرتقال المرّ المصري',
   'The same neroli as the body mist, at twice the concentration.',
   'النيرولي نفسه الذي في رذاذ الجسم، بضعف التركيز.',
   false, 1),
  ('turquoise-room-spray-image-2', 'turquoise-room-spray',
   'https://images.unsplash.com/photo-1618994492420-b4f4d6b4890c?w=800&h=1000&fit=crop&auto=format',
   'A mouth-blown crystal flacon resting after hand-polishing',
   'قارورة كريستال منفوخة بالفم تستريح بعد الصقل اليدوي',
   'Glass this heavy is a decision about where a bottle will stand, not how it travels.',
   'زجاج بهذا الثقل قرار يخصّ المكان الذي ستقف فيه الزجاجة، لا كيف تُنقل.',
   false, 2)
on conflict (id) do nothing;

-- ── Row Level Security ──────────────────────────────────────
--
-- Nothing to do. `"ProductImage"`'s select policy (`0001_catalog.sql`) is
-- written against the parent product's visibility, not against a column list,
-- so the two new columns are already covered by it — and there is no write
-- policy for `anon` or `authenticated` to widen, which is the arrangement
-- `0006_privileges.sql` argues for.
