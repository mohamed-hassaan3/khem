import {
  AdminCardListSpec,
  AdminFormSpec,
  AdminMobileBar,
  AdminRail,
  AdminTableSpec,
  StatCard,
} from "./_kit/AdminSpec";
import { Block, Change, Device, Pair, Rule, Section, Stage, Swatch } from "./_kit/Kit";
import { AnnouncementSpec, OfferPopupSpec } from "./_kit/MarketingSpec";
import NavSpec from "./_kit/NavSpec";
import { ProductCardSpec, SAMPLE_PRODUCTS } from "./_kit/ProductCardSpec";
import { BagButton, Flacon, Flag, PriceTag } from "./_kit/Specimens";

/**
 * ⚠️ TEMPORARY — design review surface. Delete before this direction ships.
 *
 * The proposal in `src/docs/khem-ui-design-system.md`, drawn, so it can be
 * judged before a single production component is touched.
 *
 * ## What this page is arguing
 *
 * The site today is **one ground**: obsidian, everywhere, with gold doing most
 * of the work of distinguishing one element from the next. The document asks
 * for four grounds and gold demoted to roughly a twentieth of the surface.
 * That is not a palette swap — it is a second half of the system that has
 * never existed here, and almost every component needs a light rendering it
 * does not currently have. So each specimen below is shown on the grounds it
 * would actually have to survive, not on the one that flatters it.
 *
 * ## What it is not
 *
 * Nothing here is imported from `src/components/`, and nothing here is
 * imported *by* anything. It reads no database, no session, no dictionary, and
 * no environment variable, so it renders identically for every reviewer and
 * cannot break a build it is not part of.
 */

export const metadata = { title: "KHEM — Design Preview" };

const INDEX = [
  ["01", "colour", "Colour system"],
  ["02", "type", "Typography"],
  ["03", "buttons", "Buttons"],
  ["04", "inputs", "Inputs"],
  ["05", "product-cards", "Product cards"],
  ["06", "surfaces", "Cards & surfaces"],
  ["07", "navigation", "Navigation"],
  ["08", "announcement", "Announcement bar"],
  ["09", "popup", "Subscribe popup"],
  ["10", "pricing", "Pricing & promotions"],
  ["11", "admin", "Admin dashboard"],
  ["12", "responsive", "Mobile & desktop"],
] as const;

export default function DesignPreviewPage() {
  return (
    <main>
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="k-dark px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20 lg:px-14">
        <p className="k-sans text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--k-on-dark-accent)]">
          Internal · Not production
        </p>
        <h1 className="k-serif mt-5 text-3xl leading-tight tracking-[0.08em] text-[var(--k-on-dark)] sm:text-4xl md:text-5xl">
          Proposed design system
        </h1>
        <div className="k-rule mt-6" />
        <p className="k-sans mt-6 max-w-2xl text-sm leading-relaxed text-[var(--k-on-dark-muted)]">
          Every specimen below is drawn from the proposed token set and nothing
          else. The storefront and the dashboard are untouched — this route
          shares no component and no stylesheet with either of them.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "The one-line thesis",
              "Dark for emotion. Ivory for shopping. Sand for heritage. Gold for identity.",
            ],
            [
              "The largest change",
              "A light half of the system that does not exist today — shop, cart, checkout, account, and admin all move to ivory.",
            ],
            [
              "The second largest",
              "Gold stops being the default. Primary buttons become obsidian; gold arrives on hover and on the rare house moment.",
            ],
            [
              "What it costs",
              "Every component needs a second rendering. Nothing can assume its ground any more — that is the work this approves.",
            ],
          ].map(([title, body]) => (
            <div
              key={title}
              className="border-t border-[var(--k-line-gold)] pt-4"
            >
              <p className="k-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--k-on-dark-accent)]">
                {title}
              </p>
              <p className="k-sans mt-3 text-[12px] leading-relaxed text-[var(--k-on-dark-muted)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </header>

      {/* ── Index ───────────────────────────────────────────── */}
      <nav
        aria-label="Sections"
        className="k-sand sticky top-0 z-10 border-b border-[var(--k-line-light)] px-5 py-3 sm:px-8 lg:px-14"
      >
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {INDEX.map(([number, id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="k-sans text-[10px] uppercase tracking-[0.16em] text-[var(--k-on-light-muted)] no-underline transition-colors duration-300 hover:text-[var(--k-on-light-accent)]"
              >
                <span className="tabular-nums opacity-50">{number}</span> {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 01 · Colour ─────────────────────────────────────── */}
      <Section
        id="colour"
        index="01"
        title="Colour system"
        intent="Four grounds and one accent. The grounds are chosen by what the visitor is doing — being told a story, or buying something — and the accent is rationed rather than applied."
      >
        <Block title="Grounds">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch
              name="Obsidian"
              hex="#0D0D0D"
              role="Hero, storytelling, NOIR, footer. The ground the house is introduced on."
            />
            <Swatch
              name="Charcoal"
              hex="#1A1A1A"
              role="Depth against obsidian — dark cards, menus, modals, the admin rail. Stops every dark section looking identical."
            />
            <Swatch
              name="Royal Ivory"
              hex="#F7F5F0"
              role="The default light ground. Shop, product, cart, checkout, account, dashboard content. Never pure white."
              border
            />
            <Swatch
              name="Egyptian Sand"
              hex="#E8E1D5"
              role="Heritage, olfactory notes, collection introductions, discovery. The warm transition between dark and light."
              border
            />
          </div>
          <Rule>
            Pure white is not in the system. Ivory at #F7F5F0 is what keeps a
            long product grid from reading as a spreadsheet — and it is the
            single cheapest thing that separates this from a generic store.
          </Rule>
        </Block>

        <Block title="Accent & surface">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch
              name="KHEM Gold"
              hex="#B08D57"
              role="Rules, borders, hovers, the active marker. On dark grounds it is also accent text."
            />
            <Swatch
              name="Soft Gold"
              hex="#D4B77A"
              role="Hover of the hover. Limited editions and small highlights only."
            />
            <Swatch
              name="Deep Gold"
              hex="#8A6A3F"
              role="Gold that survives as text on ivory. #B08D57 on #F7F5F0 is ~2.6:1 and fails; this is ~4.9:1."
            />
            <Swatch
              name="Cream"
              hex="#FBFAF7"
              role="One step above ivory — a card lifted off the ground without spending a shadow on it."
              border
            />
          </div>
          <Change
            from="Gold #C8A96A used as fills, borders, prices, buttons, and most accent text"
            to="Gold #B08D57 as jewellery — hairlines, hovers, and markers, with a deeper variant for gold text on light"
          />
        </Block>

        <Block
          title="Distribution"
          note="Not arithmetic — a target for how a whole journey should feel. Roughly 40 / 40 / 15 / 5."
        >
          <div className="flex h-14 w-full overflow-hidden border border-[var(--k-line-light)]">
            {[
              { hex: "#0D0D0D", pct: 40, label: "Dark" },
              { hex: "#F7F5F0", pct: 40, label: "Ivory" },
              { hex: "#E8E1D5", pct: 15, label: "Sand" },
              { hex: "#B08D57", pct: 5, label: "Gold" },
            ].map((band) => (
              <div
                key={band.label}
                style={{ background: band.hex, width: `${band.pct}%` }}
                className="flex items-center justify-center"
              >
                <span
                  className="k-sans text-[9px] font-medium uppercase tracking-[0.18em]"
                  style={{ color: band.pct === 40 && band.hex === "#0D0D0D" ? "#F7F5F0" : "#151515" }}
                >
                  {band.pct}%
                </span>
              </div>
            ))}
          </div>
        </Block>

        <Block
          title="Text colour, resolved against ground"
          note="Every pairing below clears 4.5:1. The muted tones are the ones worth checking — they are where a light system usually goes wrong."
        >
          <Pair>
            <Stage ground="dark" label="On dark" className="space-y-3 p-7">
              <p className="k-sans text-sm text-[var(--k-on-dark)]">
                Primary · #F7F5F0
              </p>
              <p className="k-sans text-sm text-[var(--k-on-dark-muted)]">
                Secondary · #B8B3AA
              </p>
              <p className="k-sans text-sm text-[var(--k-on-dark-accent)]">
                Accent · #B08D57
              </p>
            </Stage>
            <Stage ground="light" label="On light" className="space-y-3 p-7">
              <p className="k-sans text-sm text-[var(--k-on-light)]">
                Primary · #151515
              </p>
              <p className="k-sans text-sm text-[var(--k-on-light-muted)]">
                Secondary · #5F5A52
              </p>
              <p className="k-sans text-sm text-[var(--k-on-light-accent)]">
                Accent · #8A6A3F
              </p>
            </Stage>
          </Pair>
        </Block>
      </Section>

      {/* ── 02 · Typography ─────────────────────────────────── */}
      <Section
        id="type"
        index="02"
        title="Typography"
        intent="Unchanged faces, changed job. Cinzel and Inter stay; what moves is that both now have to hold on a light ground, where Cinzel's thin strokes read very differently."
      >
        <Block title="Display scale — Cinzel">
          <Pair>
            <Stage ground="dark" label="On obsidian" className="space-y-6 p-8">
              {[
                ["Display", "text-4xl", "Essence of Heritage"],
                ["H1", "text-3xl", "The Gemstone Collection"],
                ["H2", "text-2xl", "Obsidian Oud"],
                ["H3", "text-lg", "Olfactory pyramid"],
              ].map(([role, size, text]) => (
                <div key={role}>
                  <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-dark-muted)]">
                    {role}
                  </p>
                  <p
                    className={`k-serif ${size} leading-tight tracking-[0.08em] text-[var(--k-on-dark)]`}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </Stage>
            <Stage ground="light" label="On ivory" className="space-y-6 p-8">
              {[
                ["Display", "text-4xl", "Essence of Heritage"],
                ["H1", "text-3xl", "The Gemstone Collection"],
                ["H2", "text-2xl", "Obsidian Oud"],
                ["H3", "text-lg", "Olfactory pyramid"],
              ].map(([role, size, text]) => (
                <div key={role}>
                  <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                    {role}
                  </p>
                  <p
                    className={`k-serif ${size} leading-tight tracking-[0.08em] text-[var(--k-on-light)]`}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </Stage>
          </Pair>
          <Rule>
            Cinzel is an inscriptional face — it has no lowercase to speak of
            and it thins at small sizes. It stays for display only; every label,
            price, and paragraph below 15px is Inter. That boundary is what
            keeps the site legible once half of it is ivory.
          </Rule>
        </Block>

        <Block title="Body & UI — Inter">
          <Stage ground="cream" label="On cream" className="space-y-6 p-8">
            <div>
              <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                Lead · 15px / 1.7
              </p>
              <p className="k-sans max-w-2xl text-[15px] leading-[1.7] text-[var(--k-on-light)]">
                Distilled in Cairo from botanicals sourced within a day&rsquo;s
                travel of the Nile, each flacon is filled, sealed, and numbered
                by hand.
              </p>
            </div>
            <div>
              <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                Body · 13px / 1.7
              </p>
              <p className="k-sans max-w-2xl text-[13px] leading-[1.7] text-[var(--k-on-light-muted)]">
                The heart opens on iris and papyrus, settles through a dry
                cedar, and finishes on ambergris. It is a long fragrance; a
                single application holds through an evening.
              </p>
            </div>
            <div>
              <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                Eyebrow · 10px / 0.3em
              </p>
              <p className="k-eyebrow">Signature Collection</p>
            </div>
            <div>
              <p className="k-sans mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                Label · 10px / 0.18em
              </p>
              <p className="k-label">Delivery address</p>
            </div>
          </Stage>
          <Rule>
            Arabic keeps the existing swap — Amiri for Cinzel, IBM Plex Sans
            Arabic for Inter, under the same two CSS variables — and the
            existing rule that strips tracking under <code>dir=&quot;rtl&quot;</code>,
            since positive letter-spacing breaks Arabic letter joins. Nothing in
            this proposal changes that mechanism.
          </Rule>
        </Block>
      </Section>

      {/* ── 03 · Buttons ────────────────────────────────────── */}
      <Section
        id="buttons"
        index="03"
        title="Buttons"
        intent="One geometry, five roles. The proposal's real content is which role is the default — and it is no longer the gold one."
      >
        <Pair>
          <Stage ground="cream" label="On light" className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="k-btn k-btn-primary">
                Add to bag
              </button>
              <button type="button" className="k-btn k-btn-outline">
                View details
              </button>
              <button type="button" className="k-btn k-btn-gold">
                Join the house
              </button>
              <button type="button" className="k-btn k-btn-ghost">
                Continue shopping
              </button>
              <button type="button" className="k-btn k-btn-primary" disabled>
                Sold out
              </button>
              <BagButton productName="Nile Iris" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="k-btn k-btn-sm k-btn-primary">
                Small
              </button>
              <button type="button" className="k-btn k-btn-sm k-btn-outline">
                Small outline
              </button>
            </div>
          </Stage>

          <Stage ground="dark" label="On dark" className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="k-btn k-btn-inverse">
                Add to bag
              </button>
              <button type="button" className="k-btn k-btn-outline">
                View details
              </button>
              <button type="button" className="k-btn k-btn-gold">
                Join the house
              </button>
              <button type="button" className="k-btn k-btn-inverse" disabled>
                Sold out
              </button>
              <BagButton productName="Obsidian Oud" ground="dark" />
            </div>
          </Stage>
        </Pair>

        <Change
          from="Every primary action is a gold fill or a gold hairline"
          to="Primary is obsidian on light and ivory on dark; gold arrives on hover, and a gold fill is reserved for house moments"
        />
        <Rule>
          Hover and focus are live — put a pointer on any button, and tab
          through them. Focus is a 2px gold ring at 3px offset on every control,
          including the bag icon, which the current cards have no focus state
          for at all. Minimum target is 44px in every size, small included.
        </Rule>
      </Section>

      {/* ── 04 · Inputs ─────────────────────────────────────── */}
      <Section
        id="inputs"
        index="04"
        title="Inputs"
        intent="Checkout and the dashboard are where a light ground earns its keep. These are the controls a customer fills in under pressure and an administrator fills in fifty times a day."
      >
        <Pair>
          <Stage ground="cream" label="On light" className="space-y-5 p-8">
            <div>
              <label className="k-label" htmlFor="k-p-name">
                Full name
              </label>
              <input id="k-p-name" className="k-field" placeholder="Nour Farouk" />
            </div>
            <div>
              <label className="k-label" htmlFor="k-p-city">
                City
              </label>
              <select id="k-p-city" className="k-field" defaultValue="cairo">
                <option value="cairo">Cairo</option>
                <option value="alex">Alexandria</option>
                <option value="giza">Giza</option>
              </select>
            </div>
            <div>
              <label className="k-label" htmlFor="k-p-note">
                Gift note
              </label>
              <textarea
                id="k-p-note"
                rows={3}
                className="k-field resize-y leading-relaxed"
                placeholder="Written by hand on house card stock."
              />
              <p className="k-sans mt-2 text-[11px] text-[var(--k-on-light-muted)]">
                Up to 200 characters.
              </p>
            </div>
            <div>
              <label className="k-label" htmlFor="k-p-phone">
                Phone
              </label>
              <input
                id="k-p-phone"
                className="k-field k-field-error"
                defaultValue="+20 10"
                aria-invalid
              />
              <p className="k-sans mt-2 text-[11px] text-[#9a2b23]" role="alert">
                Enter a complete Egyptian mobile number.
              </p>
            </div>
            <div>
              <p className="k-label">Quantity</p>
              <div className="inline-flex items-center border border-[var(--k-line-light)]">
                {["−", "1", "+"].map((glyph, index) => (
                  <span
                    key={glyph}
                    className={`k-sans flex h-11 w-11 items-center justify-center text-[13px] tabular-nums text-[var(--k-on-light)] ${
                      index === 1
                        ? "border-x border-[var(--k-line-light)]"
                        : "cursor-pointer"
                    }`}
                  >
                    {glyph}
                  </span>
                ))}
              </div>
            </div>
          </Stage>

          <Stage ground="dark" label="On dark" className="space-y-5 p-8">
            <div>
              <label className="k-label" htmlFor="k-d-email">
                Email address
              </label>
              <input
                id="k-d-email"
                className="k-field"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="k-label" htmlFor="k-d-search">
                Search the house
              </label>
              <input id="k-d-search" type="search" className="k-field" placeholder="Oud, iris, amber…" />
            </div>
            <button
              type="button"
              className="flex w-full items-start gap-4 border border-[var(--k-line-dark)] bg-[rgba(247,245,240,0.03)] p-4 text-start transition-colors duration-300 hover:border-[var(--k-line-gold)]"
            >
              <span className="mt-0.5 flex h-4 w-8 shrink-0 items-center rounded-full border border-[var(--k-gold)] bg-[rgba(176,141,87,0.2)] px-0.5">
                <span className="ms-auto h-2.5 w-2.5 rounded-full bg-[var(--k-gold)]" />
              </span>
              <span>
                <span className="k-sans block text-[10px] uppercase tracking-[0.2em] text-[var(--k-on-dark)]">
                  House letter
                </span>
                <span className="k-sans mt-1 block text-[11px] leading-relaxed text-[var(--k-on-dark-muted)]">
                  New releases and boutique evenings, twice a month.
                </span>
              </span>
            </button>
          </Stage>
        </Pair>

        <Rule>
          Every field is 16px at every width, not only under 768px. Below 16px
          iOS Safari force-zooms on focus and the page then pans sideways — the
          current stylesheet patches this with a <code>!important</code> media
          query; the proposal removes the need for the patch by making 16px the
          default.
        </Rule>
      </Section>

      {/* ── 05 · Product cards ──────────────────────────────── */}
      <Section
        id="product-cards"
        index="05"
        title="Product cards"
        intent="The most consequential component in the system, and the one the document changes most: the words leave, an icon takes their place, and the card has to hold its height whatever the copy does."
      >
        <Block
          title="Desktop grid — four across"
          note="Four deliberately uneven products: a long description, a one-line one, a campaign price, and a sold-out set. The price rows still align."
        >
          <Stage ground="light" className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {SAMPLE_PRODUCTS.map((product) => (
                <ProductCardSpec key={product.name} product={product} />
              ))}
            </div>
          </Stage>
          <Change
            from="A card is one anchor; the bag control is overlaid by whichever grid renders it"
            to="A card is an article with a stretched link; the bag button is a sibling, so no click handling is needed to keep them apart"
          />
        </Block>

        <Block
          title="The same cards on obsidian"
          note="Editorial pages and NOIR still run dark, so every card needs both renderings."
        >
          <Stage ground="dark" className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {SAMPLE_PRODUCTS.slice(0, 4).map((product) => (
                <ProductCardSpec
                  key={product.name}
                  product={product}
                  ground="dark"
                />
              ))}
            </div>
          </Stage>
        </Block>

        <Block
          title="Anatomy"
          note="Image · collection · name · description (2 lines, clamped) · price and meta · bag. Nothing below the image is allowed to grow."
        >
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <Stage ground="light" className="p-6">
              <ProductCardSpec product={SAMPLE_PRODUCTS[2]} />
            </Stage>
            <div className="space-y-3">
              {[
                [
                  "Collection label",
                  "9px Inter, deep gold, 0.22em. Names the collection so the card works in a mixed grid.",
                ],
                [
                  "Product name",
                  "Cinzel 15px, clamped to one line. A proper noun — stays Latin in the Arabic tree.",
                ],
                [
                  "Description",
                  "Two lines, hard clamp. This is what makes the grid align; the full copy is the detail page's job.",
                ],
                [
                  "Price + meta",
                  "Cinzel tabular figures over a 10px format line — 100 ML, 6 × 10 ML, Room Spray. Nothing assumes a bottle.",
                ],
                [
                  "Bag button",
                  "44px, icon only, aria-label names the product. Above the stretched link, so it never navigates.",
                ],
                [
                  "Corner flag",
                  "One at a time. Sold out beats campaign beats badge beats merchandising flag.",
                ],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="border-s-2 border-[var(--k-line-light)] ps-4"
                >
                  <p className="k-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--k-on-light)]">
                    {label}
                  </p>
                  <p className="k-sans mt-1.5 text-[12px] leading-relaxed text-[var(--k-on-light-muted)]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Block>
      </Section>

      {/* ── 06 · Surfaces ───────────────────────────────────── */}
      <Section
        id="surfaces"
        index="06"
        title="Cards & surfaces"
        intent="One card definition for every card in the product — storefront, editorial, and dashboard. Same radius, same hairline, same three-step elevation."
      >
        <Block title="Collection card">
          <Stage ground="light" className="p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "KHEM Noir", count: "9 fragrances", tone: "dark" as const },
                { name: "Signature", count: "12 fragrances", tone: "light" as const },
                { name: "Gemstone", count: "6 fragrances", tone: "sand" as const },
              ].map((collection) => (
                <article key={collection.name} className="k-card overflow-hidden">
                  <div className="relative">
                    <Flacon
                      tone={collection.tone}
                      cap={collection.tone === "dark" ? "#d4b77a" : "var(--k-gold)"}
                    />
                  </div>
                  <div className="p-5">
                    <p className="k-serif text-base tracking-[0.1em] text-[var(--k-on-light)]">
                      {collection.name}
                    </p>
                    <p className="k-sans mt-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--k-on-light-muted)]">
                      {collection.count}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </Stage>
          <Rule>
            On the home page these become a slider rather than a static row —
            multiple cards on desktop, one and a sliver on mobile so the swipe
            is discoverable. The card itself is what is being approved here;
            the slider mechanics come with the implementation.
          </Rule>
        </Block>

        <Block title="Sand panel — olfactory notes">
          <Stage ground="sand" className="p-8 sm:p-12">
            <p className="k-eyebrow">The pyramid</p>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {[
                ["Top", "Bergamot · Pink pepper · Blue lotus"],
                ["Heart", "Iris · Papyrus · Damask rose"],
                ["Base", "Ambergris · Cedar · Incense"],
              ].map(([tier, notes]) => (
                <div key={tier}>
                  <p className="k-serif text-[13px] uppercase tracking-[0.22em] text-[var(--k-on-light-accent)]">
                    {tier}
                  </p>
                  <div className="k-rule mt-3" />
                  <p className="k-sans mt-4 text-[13px] leading-[1.9] text-[var(--k-on-light)]">
                    {notes}
                  </p>
                </div>
              ))}
            </div>
          </Stage>
        </Block>

        <Block title="Journal card & elevation">
          <div className="grid gap-6 lg:grid-cols-2">
            <Stage ground="light" label="Editorial card" className="p-6">
              <article className="k-card overflow-hidden">
                <div className="relative">
                  <Flacon tone="sand" />
                </div>
                <div className="p-6">
                  <p className="k-eyebrow">Craft · 6 min read</p>
                  <h4 className="k-serif mt-3 text-lg leading-snug tracking-[0.04em] text-[var(--k-on-light)]">
                    What the Nile gives an iris that a greenhouse cannot
                  </h4>
                  <p className="k-sans k-clamp-2 mt-3 text-[12px] leading-relaxed text-[var(--k-on-light-muted)]">
                    Silt, humidity, and a growing season that runs three weeks
                    longer than it does anywhere in Europe.
                  </p>
                </div>
              </article>
            </Stage>

            <Stage ground="light" label="Elevation" className="space-y-5 p-8">
              {[
                ["0 — flush", "var(--k-shadow-0)", "Sections, page grounds. The default."],
                ["1 — resting", "var(--k-shadow-1)", "Cards at rest. A hairline of separation, nothing more."],
                ["2 — raised", "var(--k-shadow-2)", "Card hover, dropdowns, the sticky purchase bar."],
                ["3 — floating", "var(--k-shadow-3)", "Modals and drawers only. Never a card."],
              ].map(([label, shadow, note]) => (
                <div
                  key={label}
                  className="border border-[var(--k-line-light)] bg-[var(--k-cream)] p-4"
                  style={{ boxShadow: shadow }}
                >
                  <p className="k-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--k-on-light)]">
                    {label}
                  </p>
                  <p className="k-sans mt-1.5 text-[12px] text-[var(--k-on-light-muted)]">
                    {note}
                  </p>
                </div>
              ))}
              <Rule>
                Radius is 2px throughout, 4px for modals. Not zero — a true
                square edge reads as unfinished at this scale — and never more,
                because rounded corners are the fastest way to make a luxury
                surface look like a SaaS one.
              </Rule>
            </Stage>
          </div>
        </Block>
      </Section>

      {/* ── 07 · Navigation ─────────────────────────────────── */}
      <Section
        id="navigation"
        index="07"
        title="Navigation"
        intent="The header now has to change colour with the section beneath it. Toggle between the two states — this is the one component where getting the proposal wrong means ivory type on an ivory bar."
      >
        <NavSpec />
        <Change
          from="Ivory-on-dark in both states; solid state is obsidian at 96%"
          to="Ivory-on-transparent over dark heroes, near-black on a 94% ivory bar once scrolled onto a light section"
        />
        <Rule>
          The bag count changes tone with the bar — gold on dark, obsidian on
          ivory — because a gold pill on an ivory bar is the 5% budget spent on
          a notification badge. Open the drawer with the hamburger; it stays
          charcoal in both states, which is deliberate: an overlay is its own
          surface and does not need to agree with the page behind it.
        </Rule>
      </Section>

      {/* ── 08 · Announcement bar ───────────────────────────── */}
      <Section
        id="announcement"
        index="08"
        title="Announcement bar"
        intent="34px on a phone, 38px above it, one line, never wrapping — a bar that grows a second line moves the whole document down. What changes is that it now has to sit above a header that is sometimes ivory."
      >
        <div className="space-y-6">
          <Stage ground="light" label="Obsidian — the default, and what ships today">
            <AnnouncementSpec ground="dark" />
          </Stage>
          <Stage ground="light" label="Gold — for a single, genuinely house-level message">
            <AnnouncementSpec ground="gold" />
          </Stage>
          <Stage ground="light" label="Sand — above an ivory header on shop pages">
            <AnnouncementSpec ground="sand" />
          </Stage>
          <Stage ground="light" label="Marquee mode — three messages, obsidian">
            <AnnouncementSpec ground="dark" mode="marquee" />
          </Stage>
        </div>
        <Rule>
          Height stays a CSS variable that the header&rsquo;s <code>top</code> and
          the page wrapper&rsquo;s padding both read, so all three move together and
          the bar contributes nothing to layout shift. That mechanism is already
          right and this proposal does not touch it — only the three grounds are
          new. Reduced motion stops the marquee in CSS, before hydration.
        </Rule>
      </Section>

      {/* ── 09 · Subscribe popup ────────────────────────────── */}
      <Section
        id="popup"
        index="09"
        title="Subscribe popup"
        intent="Shown over its scrim, because half of what makes a modal read as expensive is how much of the page it puts away. Two columns from the small breakpoint up; image over copy below it."
      >
        <Pair>
          <Stage ground="light" label="Dark treatment — over editorial and hero pages">
            <OfferPopupSpec ground="dark" />
          </Stage>
          <Stage ground="light" label="Light treatment — over shop, cart, and account">
            <OfferPopupSpec ground="light" />
          </Stage>
        </Pair>
        <Rule>
          The light treatment is the new one, and the reason the image column
          takes a full half rather than a cropped banner: on an ivory modal the
          photograph is the only element carrying any weight. The primary button
          resolves against the modal&rsquo;s ground, not the page&rsquo;s — obsidian on
          the light modal, ivory on the dark one.
        </Rule>
      </Section>

      {/* ── 10 · Pricing ────────────────────────────────────── */}
      <Section
        id="pricing"
        index="10"
        title="Pricing & promotional states"
        intent="A house does not shout a reduction. The whole sale treatment is that there are now two numbers and the eye reads the second one — no red, no burst, no starburst lozenge."
      >
        <Block title="Price states">
          <Pair>
            <Stage ground="cream" label="On light" className="space-y-6 p-8">
              {[
                ["List price", <PriceTag key="a" price="EGP 4,800" size="lg" />],
                [
                  "On campaign",
                  <PriceTag key="b" price="EGP 3,200" was="EGP 4,000" size="lg" />,
                ],
                [
                  "On campaign, in a grid",
                  <PriceTag key="c" price="EGP 3,200" was="EGP 4,000" percent={20} />,
                ],
              ].map(([label, node]) => (
                <div key={label as string}>
                  <p className="k-sans mb-2 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                    {label}
                  </p>
                  {node}
                </div>
              ))}
            </Stage>
            <Stage ground="dark" label="On dark" className="space-y-6 p-8">
              {[
                ["List price", <PriceTag key="d" price="EGP 4,800" ground="dark" size="lg" />],
                [
                  "On campaign",
                  <PriceTag key="e" price="EGP 3,200" was="EGP 4,000" ground="dark" size="lg" />,
                ],
                [
                  "On campaign, in a grid",
                  <PriceTag
                    key="f"
                    price="EGP 3,200"
                    was="EGP 4,000"
                    percent={20}
                    ground="dark"
                  />,
                ],
              ].map(([label, node]) => (
                <div key={label as string}>
                  <p className="k-sans mb-2 text-[9px] uppercase tracking-[0.22em] text-[var(--k-on-dark-muted)]">
                    {label}
                  </p>
                  {node}
                </div>
              ))}
            </Stage>
          </Pair>
          <Rule>
            The percentage chip is off by default and earns its place only in a
            grid, where a shopper is comparing. On a detail page the two figures
            are already side by side and the chip is a third element saying the
            same thing.
          </Rule>
        </Block>

        <Block
          title="Flags"
          note="One per card, resolved in a fixed order: sold out, then campaign, then a merchandiser's stored badge, then the automatic flag."
        >
          <Stage ground="dark" className="p-8">
            <div className="flex flex-wrap gap-10">
              {[
                { label: "Best Seller", tone: "gold" as const, note: "Merchandising claim" },
                { label: "Ramadan Offer", tone: "campaign" as const, note: "A named campaign" },
                { label: "Sold Out", tone: "quiet" as const, note: "A withdrawal, not a claim" },
              ].map((flag) => (
                <div key={flag.label} className="relative h-16 w-44">
                  <Flag label={flag.label} tone={flag.tone} />
                  <p className="k-sans absolute bottom-0 text-[11px] text-[var(--k-on-dark-muted)]">
                    {flag.note}
                  </p>
                </div>
              ))}
            </div>
          </Stage>
          <Rule>
            A campaign flag is obsidian behind a gold hairline, never a gold
            fill: a solid gold pill is the house endorsing a product, and a sale
            is a statement about a price. Both footprints are identical, so a
            card does not re-flow when a campaign starts or ends.
          </Rule>
        </Block>

        <Block title="Stock states">
          <Stage ground="light" className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              <ProductCardSpec product={SAMPLE_PRODUCTS[0]} />
              <ProductCardSpec product={SAMPLE_PRODUCTS[1]} />
              <ProductCardSpec product={SAMPLE_PRODUCTS[3]} />
              <ProductCardSpec
                product={{
                  ...SAMPLE_PRODUCTS[2],
                  flag: { label: "Two left", tone: "campaign" },
                }}
              />
            </div>
          </Stage>
          <Rule>
            A sold-out card dims and drains its image, and nothing else — the
            name, price, and format stay at full legibility, because the card is
            still a link worth reading and a product worth being told about.
            Its bag button is disabled and says so to a screen reader.
          </Rule>
        </Block>
      </Section>

      {/* ── 11 · Admin ──────────────────────────────────────── */}
      <Section
        id="admin"
        index="11"
        title="Admin dashboard"
        intent="Charcoal rail, ivory content, gold as the active marker and nothing else. Reading a fourteen-row order table in ivory-on-black for an hour is a different job from being sold a perfume."
      >
        <Block title="Desktop">
          <Stage ground="light">
            <div className="flex min-h-[520px]">
              <AdminRail />
              <div className="k-light min-w-0 flex-1 p-6 lg:p-8">
                <p className="k-serif text-xl tracking-[0.1em] text-[var(--k-on-light)]">
                  Overview
                </p>
                <div className="k-rule mt-4" />

                <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Revenue · 30d" value="EGP 412,800" delta="18.4%" />
                  <StatCard label="Orders" value="184" delta="9.1%" />
                  <StatCard label="Average order" value="EGP 2,243" />
                  <StatCard label="Low stock" value="6" />
                </div>

                <p className="k-sans mt-8 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                  Recent orders
                </p>
                <div className="mt-4">
                  <AdminTableSpec />
                </div>
              </div>
            </div>
          </Stage>
          <Change
            from="The dashboard is the same obsidian as the storefront, table rows included"
            to="Charcoal rail against ivory content; gold survives as the active-nav marker and the delta figure"
          />
        </Block>

        <Block title="Forms — two columns on desktop, one on mobile">
          <Stage ground="light" className="p-6 sm:p-8">
            <AdminFormSpec />
          </Stage>
        </Block>

        <Block
          title="Tablet & mobile"
          note="The rail collapses to icons, then to a drawer. The order table becomes cards, because on a phone the useful comparison is between orders, not between columns."
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
            <Device kind="tablet">
              <div className="flex min-h-[420px]">
                <AdminRail compact />
                <div className="k-light min-w-0 flex-1 p-5">
                  <p className="k-serif text-base tracking-[0.1em] text-[var(--k-on-light)]">
                    Orders
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <StatCard label="Orders" value="184" delta="9.1%" />
                    <StatCard label="Low stock" value="6" />
                  </div>
                  <div className="mt-5">
                    <AdminTableSpec />
                  </div>
                </div>
              </div>
            </Device>

            <Device kind="phone">
              <div className="k-light min-h-[420px]">
                <AdminMobileBar />
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Orders" value="184" delta="9.1%" />
                    <StatCard label="Low stock" value="6" />
                  </div>
                  <p className="k-sans mt-6 text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
                    Recent orders
                  </p>
                  <div className="mt-3">
                    <AdminCardListSpec />
                  </div>
                </div>
              </div>
            </Device>
          </div>
        </Block>
      </Section>

      {/* ── 12 · Responsive ─────────────────────────────────── */}
      <Section
        id="responsive"
        index="12"
        title="Mobile & desktop"
        intent="The same shop page at three widths. The frames lay out at real pixel widths, so what you are looking at is the actual grid resolving — not a scaled screenshot."
      >
        <Block
          title="Product grid — 4 / 3 / 2"
          note="Four across on desktop, three on tablet, two on a phone, with intermediate widths interpolating rather than snapping between three fixed layouts."
        >
          <div className="space-y-10">
            <Device kind="desktop">
              <div className="k-light p-6">
                <div className="grid grid-cols-4 gap-5">
                  {SAMPLE_PRODUCTS.map((product) => (
                    <ProductCardSpec key={product.name} product={product} />
                  ))}
                </div>
              </div>
            </Device>

            <div className="grid gap-8 xl:grid-cols-[auto_auto] xl:justify-start">
              <Device kind="tablet">
                <div className="k-light p-5">
                  <div className="grid grid-cols-3 gap-4">
                    {SAMPLE_PRODUCTS.slice(0, 3).map((product) => (
                      <ProductCardSpec key={product.name} product={product} />
                    ))}
                  </div>
                </div>
              </Device>

              <Device kind="phone">
                <div className="k-light">
                  <AnnouncementSpec ground="sand" />
                  <div className="flex h-16 items-center justify-between border-b border-[var(--k-line-light)] px-4">
                    <span className="k-sans text-[18px] leading-none text-[var(--k-on-light)]">
                      ≡
                    </span>
                    <span className="k-serif text-base tracking-[0.4em] text-[var(--k-on-light)]">
                      KHEM
                    </span>
                    <span className="k-sans text-[13px] text-[var(--k-on-light)]">
                      ⌕
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-2 gap-3">
                      {SAMPLE_PRODUCTS.slice(0, 4).map((product) => (
                        <ProductCardSpec
                          key={product.name}
                          product={product}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Device>
            </div>
          </div>
          <Rule>
            The phone card drops its description rather than shrinking it. At
            ~170px a two-line description wraps to three and pushes the price
            below the fold of the card — and the price is the one thing a phone
            browser is scanning a grid for.
          </Rule>
        </Block>

        <Block
          title="The journey"
          note="§38: you enter through darkness, discover the heritage, explore the products in light, and return to darkness."
        >
          <Device kind="desktop">
            <div>
              <div className="k-dark flex h-44 items-center px-10">
                <div>
                  <p className="k-eyebrow">Essence of Heritage</p>
                  <p className="k-serif mt-3 text-3xl tracking-[0.1em] text-[var(--k-on-dark)]">
                    Five millennia, one flacon
                  </p>
                </div>
              </div>
              <div className="k-sand flex h-36 items-center px-10">
                <p className="k-sans max-w-xl text-[13px] leading-[1.9] text-[var(--k-on-light)]">
                  KHEM began where perfumery did — on the Nile, with resins
                  traded up from Punt and irises grown in the delta silt.
                </p>
              </div>
              <div className="k-light px-10 py-8">
                <p className="k-eyebrow">Our collections</p>
                <div className="mt-5 grid grid-cols-4 gap-5">
                  {SAMPLE_PRODUCTS.map((product) => (
                    <ProductCardSpec key={product.name} product={product} />
                  ))}
                </div>
              </div>
              <div className="k-dark flex h-32 items-center justify-between px-10">
                <p className="k-serif text-lg tracking-[0.3em] text-[var(--k-on-dark)]">
                  KHEM
                </p>
                <p className="k-sans text-[11px] text-[var(--k-on-dark-muted)]">
                  Cairo · Alexandria · Dubai
                </p>
              </div>
            </div>
          </Device>
          <Rule>
            Four grounds in one scroll, with the accent appearing only on the
            eyebrows and the flag. That rhythm is the proposal — not any single
            colour in it.
          </Rule>
        </Block>
      </Section>

      {/* ── Close ───────────────────────────────────────────── */}
      <footer className="k-charcoal px-5 py-16 sm:px-8 lg:px-14">
        <p className="k-eyebrow">Awaiting approval</p>
        <p className="k-serif mt-4 max-w-2xl text-xl leading-snug tracking-[0.06em] text-[var(--k-on-dark)]">
          Nothing on this page is live. Approve the direction and it becomes the
          brief for editing the real components.
        </p>
        <p className="k-sans mt-6 max-w-2xl text-[12px] leading-relaxed text-[var(--k-on-dark-muted)]">
          Route: <code>/design-preview</code> · Source:{" "}
          <code>src/app/design-preview/</code> · Spec:{" "}
          <code>src/docs/khem-ui-design-system.md</code>. Removing this route is
          deleting that folder and one bypass line in <code>src/proxy.ts</code>.
        </p>
      </footer>
    </main>
  );
}
