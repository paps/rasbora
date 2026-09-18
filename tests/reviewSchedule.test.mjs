import assert from "node:assert/strict";
import { after, test } from "node:test";
import initSqlJs from "sql.js";
import { createServer } from "vite";
import { scoreToDays, nextReviewTime } from "../src/database/reviewSchedule.ts";
import { formatDays } from "../src/components/days.ts";

test("intervals use the profile rate; due times use the last review and can be overdue", () => {
  const last = 1_700_000_000;
  assert.equal(scoreToDays(250, 100), 2.5);
  assert.equal(scoreToDays(250, 200), 1.25);
  assert.equal(nextReviewTime(250, last, 100), last + 216_000);
  assert.equal(nextReviewTime(0, last, 100), last);
  assert.equal(
    (nextReviewTime(250, last, 100) - (last + 3 * 86_400)) / 86_400,
    -0.5,
  );
});

test("invalid and missing inputs never invent a review date", () => {
  for (const rate of [null, 0, -100, NaN, Infinity]) {
    assert.equal(scoreToDays(100, rate), null);
    assert.equal(nextReviewTime(100, 1_700_000_000, rate), null);
  }
  for (const score of [null, -1, NaN, Infinity]) {
    assert.equal(nextReviewTime(score, 1_700_000_000, 100), null);
  }
  for (const date of [null, 0, -1, NaN, Infinity]) {
    assert.equal(nextReviewTime(100, date, 100), null);
  }
});

test("fractional days retain the sign near zero", () => {
  assert.equal(formatDays(2.34), `${(2.3).toLocaleString()} days`);
  assert.equal(formatDays(-0.24), `-${(0.2).toLocaleString()} days`);
  assert.equal(formatDays(0.01), `<${(0.1).toLocaleString()} days`);
  assert.equal(formatDays(-0.01), `-<${(0.1).toLocaleString()} days`);
  assert.equal(formatDays(0), "0 days");
  assert.equal(formatDays(-0), "0 days");
  assert.equal(formatDays(1), "1 day");
  assert.equal(formatDays(-1), "-1 day");
  assert.equal(formatDays(null), "—");
});

const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
});
after(() => server.close());
const SQL = await initSqlJs();
const { listProfiles, readCardPointsPerDay } = await server.ssrLoadModule(
  "/src/database/plecoFile.ts",
);
const readers = await Promise.all(
  [
    "MostDifficultCards",
    "RiskyCards",
    "AlmostLearnedCards",
    "LearnedCards",
    "CustomizedCards",
    "ViewCard",
    "ProfileInfo",
  ].map((page) => server.ssrLoadModule(`/src/pages/${page}.db.ts`)),
);

test("all six card queries agree across profiles sharing a scorefile with different rates", () => {
  const db = new SQL.Database();
  try {
    db.run(`
      create table pleco_flash_profiles (id integer, name text, sort integer, created integer, modified integer, laststart integer, lastend integer);
      insert into pleco_flash_profiles values (2, 'First', 0, 100, 200, 300, 400), (6, 'Second', 1, 100, 200, 300, 400);
      create table pleco_flash_profilesettings (propset integer, propid text, propvalue text);
      create table pleco_flash_scorefiles (id integer, name text, sort integer);
      insert into pleco_flash_scorefiles values (4, 'Shared', 0);
      create table pleco_flash_categories (id integer, parent integer, name text, sort integer);
      insert into pleco_flash_categories values (93, -2, 'Included', 0), (94, -2, 'Excluded', 1);
      create table pleco_flash_categoryassigns (card integer, cat integer);
      insert into pleco_flash_categoryassigns values (1, 93), (2, 93), (3, 93), (4, 94);
      create table pleco_flash_cards (id integer, hw text, althw text, pron text, defn text, created integer, modified integer);
      insert into pleco_flash_cards values (1, '字', '字', 'zi4', 'note', 100, 200), (2, '字', '字', 'zi4', 'note', 100, 200), (3, '字', '字', 'zi4', 'note', 100, 200), (4, '字', '字', 'zi4', 'note', 100, 200);
      create table pleco_flash_scores_4 (card integer, score integer, correct integer, incorrect integer, reviewed integer, history text, firstreviewedtime integer, lastreviewedtime integer, scoreinctime integer, scoredectime integer);
      insert into pleco_flash_scores_4 values (1, 250, 3, 1, 4, '2666', 100, 1700000000, 200, 300), (2, 500, 3, 1, 4, '2666', 100, 1700000000, 200, 300), (4, 250, 3, 1, 4, '2666', 100, 1700000000, 200, 300);
    `);
    for (const [id, rate] of [
      [2, 100],
      [6, 200],
    ]) {
      for (const [key, value] of Object.entries({
        pro_scorefile: "4",
        pro_categories: "93,",
        pro_cardpointsday: String(rate),
        pro_scoreautomin: "100",
        pro_scoreautomax: "500",
        pro_scorefilter_free_starts: "100,200,",
      })) {
        db.run("insert into pleco_flash_profilesettings values (?, ?, ?)", [
          id,
          key,
          value,
        ]);
      }
    }
    const [difficult, risky, almost, learned, customized, search, info] =
      readers;
    for (const profile of listProfiles(db)) {
      const rate = profile.id === 2 ? 100 : 200;
      assert.equal(readCardPointsPerDay(db, profile), rate);
      assert.equal(info.readProfileDetails(db, profile).pointsPerDay, rate);
      const sets = [
        difficult.readMostDifficultCards(db, profile).cards,
        risky.readRiskyCandidates(db, profile).candidates,
        almost.readAlmostLearnedCards(db, profile).cards,
        learned.readLearnedCards(db, profile).cards,
        customized.readCustomizedCards(db, profile).cards,
        search.searchCards(db, profile, "字").cards,
      ];
      for (const cards of sets) {
        assert.ok(cards.length > 0);
        for (const card of cards) {
          assert.notEqual(card.id, 4, "excluded category must not leak");
          const score = card.id === 1 ? 250 : 500;
          assert.equal(
            card.nextReview,
            card.id === 3 ? null : 1_700_000_000 + (score / rate) * 86_400,
          );
        }
      }
      assert.equal(
        customized
          .readCustomizedCards(db, profile)
          .cards.find((c) => c.id === 3).nextReview,
        null,
      );
      assert.equal(
        search.searchCards(db, profile, "3").cards[0].nextReview,
        null,
      );
    }
    const profile = listProfiles(db)[0];
    db.run(
      "update pleco_flash_profilesettings set propvalue = '0' where propid = 'pro_cardpointsday'",
    );
    assert.equal(readCardPointsPerDay(db, profile), null);
    assert.equal(
      search.searchCards(db, profile, "1").cards[0].nextReview,
      null,
    );
    db.run(
      "update pleco_flash_profilesettings set propvalue = '100' where propid = 'pro_cardpointsday'",
    );
    db.run("update pleco_flash_scores_4 set lastreviewedtime = 0");
    assert.equal(
      search.searchCards(db, profile, "1").cards[0].nextReview,
      null,
    );
    db.run("drop table pleco_flash_scores_4");
    const noScores = listProfiles(db)[0];
    assert.equal(
      customized.readCustomizedCards(db, noScores).cards[0].nextReview,
      null,
    );
    assert.equal(
      search.searchCards(db, noScores, "1").cards[0].nextReview,
      null,
    );
  } finally {
    db.close();
  }
});

test("the shared display renders signed red/green values and a neutral due value", async (t) => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { MantineProvider } = await import("@mantine/core");
  const { default: ReviewDue } = await server.ssrLoadModule(
    "/src/components/ReviewDue.tsx",
  );
  const now = 1_700_000_000;
  t.mock.method(Date, "now", () => now * 1000);
  const render = (seconds) =>
    renderToStaticMarkup(
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(ReviewDue, { seconds }),
      ),
    );
  assert.match(render(now - 2.5 * 86_400), /-2[.,]5 days/);
  assert.match(render(now - 2.5 * 86_400), /var\(--mantine-color-red/);
  assert.match(render(now + 2.5 * 86_400), /var\(--mantine-color-green/);
  assert.match(render(now - 1), /-&lt;0[.,]1 days/);
  assert.match(render(now + 1), /&lt;0[.,]1 days/);
  assert.match(render(now), /0 days/);
  assert.doesNotMatch(render(now), /var\(--mantine-color-(?:red|green)/);
  assert.match(render(null), /—/);
});
