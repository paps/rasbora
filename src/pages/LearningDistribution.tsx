import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link, useNavigate } from "react-router";
import { BarChart } from "@mantine/charts";
import { useMemo } from "react";
import Explained from "@/components/Explained";
import { useDatabase } from "@/database/context";
import {
  LAPSED_SERIES,
  NEVER_SERIES,
  PERFECT_SERIES,
  WEAKER_SERIES,
  readLearningDistribution,
} from "@/pages/LearningDistribution.db";
import { RUN_PARAM } from "@/pages/Streaks";

/**
 * The four kinds of bar, stacked bottom to top in this order.
 *
 * Three of them are hues and the fourth is not, which is the rule the rest of
 * the app follows: a colour that is *data* stays put across colour schemes, and
 * a colour that is a *neutral* inverts. `lapsed` is the neutral here on
 * purpose — a card that just failed is the absence of a run rather than a
 * grade of one, so it should not read as a third quality of run.
 *
 * The three hues were checked as a set rather than picked by eye, and must be
 * re-checked if any is changed: worst all-pairs ΔE 9.5 under protanopia and
 * 19.6 in normal vision, every one clearing 3:1 against both the light and the
 * dark page. `perfect` and `weaker` are the pair that actually sit against each
 * other inside a bar, and they separate at ΔE 18.7 protan / 19.6 normal.
 *
 * Their weak spot is tritanopia, where blue and teal fall to ΔE 3.8. That is
 * covered by the stacking order rather than by hue: `perfect` is always the
 * segment sitting on the baseline and `weaker` always the one above it, so the
 * split survives with no colour vision at all.
 */
const SERIES_COLORS: Record<string, string> = {
  [NEVER_SERIES]: "orange.8",
  [LAPSED_SERIES]:
    "light-dark(var(--mantine-color-gray-6), var(--mantine-color-dark-2))",
  [PERFECT_SERIES]: "blue.7",
  [WEAKER_SERIES]: "teal.8",
};

const SERIES_LABELS: Record<string, string> = {
  [NEVER_SERIES]: "Never reviewed",
  [LAPSED_SERIES]: "Failed the last review",
  [PERFECT_SERIES]: "Remembered perfectly",
  [WEAKER_SERIES]: "Includes a weaker answer",
};

/** The tick under the bar that is not a point on the run axis. */
const NEW_BUCKET = "New";

/**
 * Where a bucket's cards are listed. The `New` bar goes to its own page rather
 * than to a run of zero, because a card never asked and a card just failed are
 * different things — the same split the bar itself exists to draw.
 */
const bucketLink = (bucket: string): string =>
  bucket === NEW_BUCKET ? "/new" : `/streaks?${RUN_PARAM}=${bucket}`;

/** Bottom of the stack first, which is also the order the legend reads in. */
const SERIES_ORDER = [
  NEVER_SERIES,
  LAPSED_SERIES,
  PERFECT_SERIES,
  WEAKER_SERIES,
];

const SERIES = SERIES_ORDER.map((name) => ({
  name,
  label: SERIES_LABELS[name],
  color: SERIES_COLORS[name] ?? "gray.7",
}));

/**
 * How a profile's cards are spread across their current run of correct
 * answers: how many it has never asked about, how many it just got wrong, and
 * how far the rest have got without a slip.
 *
 * Read left to right it is the shape of the deck — a tall left end is a pile of
 * cards waiting to be learned, a fat middle is learning in progress, and the
 * right tail is what the profile has not managed to catch out in a long time.
 *
 * Two splits carry the page, and both exist because a bar that merged them
 * would say something untrue:
 *
 * The **"New" bar is not part of the numeric axis.** A card the profile has
 * never reviewed and a card that failed its last review are both on a run of
 * zero, and merging them would make the left end unreadable: in the sample
 * export's big profile every one of the 909 cards at zero has been reviewed,
 * while in its small one 263 of 283 never have.
 *
 * Each bar is **split by what the run is made of.** A run of correct answers is
 * not a run of perfect ones, and the difference decides whether a long run
 * means what a reader assumes it means — see `isPerfect` in the query for the
 * scoring arithmetic. In the sample export's big profile the longest run of
 * nothing but "remembered perfectly" is 10, while the longest run of any
 * correct answers is 21: the whole of that tail is propped up by answers graded
 * "barely remembered", on cards that are still coming back every few weeks.
 */
const LearningDistribution = () => {
  const { database, profile } = useDatabase();
  const navigate = useNavigate();

  const distribution = useMemo(
    () =>
      database && profile ? readLearningDistribution(database, profile) : null,
    [database, profile],
  );

  const data = useMemo(
    () =>
      distribution?.buckets.map(({ streak, counts }) => ({
        bucket: streak === null ? NEW_BUCKET : String(streak),
        ...counts,
      })) ?? [],
    [distribution],
  );

  // The two are null together — a run is counted in one profile's scorefile.
  if (!distribution || !profile) {
    return (
      <Stack gap="md">
        <Title>Learning distribution</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see how a profile’s cards are spread across their runs of correct
          answers.
        </Text>
      </Stack>
    );
  }

  if (distribution.totalCards === 0) {
    return (
      <Stack gap="md">
        <Title>Learning distribution</Title>
        <Text c="dimmed">
          The <b>{profile.name}</b> profile draws from no category that holds
          cards, so there is nothing to chart.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Learning distribution</Title>

      <BarChart
        h={440}
        data={data}
        dataKey="bucket"
        series={SERIES}
        type="stacked"
        style={{ cursor: "pointer" }}
        // Selecting a bucket opens its cards. It is wired twice on purpose,
        // because neither handler covers the other's case:
        //
        // `barProps` catches a hit on the bar itself and is the only one that
        // works under a finger — recharts fills the chart-level active state
        // from mouse movement, so a tap, which has none, arrives with nothing
        // to say. It stops propagation so the two never both fire.
        //
        // `barChartProps` catches the rest of the column, which is what makes
        // the tail usable with a mouse: those bars are a couple of pixels tall
        // and hitting one exactly is not something to ask of anyone.
        //
        // Which segment was hit is ignored either way. A bar opens every card
        // it counts, and `Streaks` carries the perfect/weaker split as a
        // column so it is not lost on the way.
        barProps={{
          onClick: (_bar, barIndex, event) => {
            const bucket = data[barIndex]?.bucket;

            if (bucket !== undefined) {
              event.stopPropagation();
              void navigate(bucketLink(bucket));
            }
          },
        }}
        barChartProps={{
          onClick: (state) => {
            // recharts types this loosely; it is the `bucket` string this
            // chart was given, but only a check can say so here.
            const bucket: unknown = state.activeLabel;

            if (typeof bucket === "string") {
              void navigate(bucketLink(bucket));
            }
          },
        }}
        withLegend
        legendProps={{ verticalAlign: "top" }}
        // A profile whose longest run is short leaves only a handful of
        // buckets, and a bar stretched over a fifth of the chart reads as a
        // block of colour rather than a measurement.
        maxBarWidth={72}
        xAxisLabel="Correct answers in a row"
        yAxisLabel="Cards"
        valueFormatter={(value) => value.toLocaleString()}
        yAxisProps={{ width: 70 }}
        xAxisProps={{ interval: "preserveStartEnd" }}
      />

      <Text size="sm" c="dimmed">
        Each bar counts the cards the <b>{profile.name}</b> profile is currently
        on that many{" "}
        <Explained info="Pleco grades each review on a six-point scale, and 4, 5 and 6 are its correct half — a plain right answer records a 6. The run is counted back from the most recent review to the last answer that was not one of those three.">
          correct answers
        </Explained>{" "}
        in a row for, counted back from their last review to the failure before
        it. <b>{distribution.totalCards.toLocaleString()}</b> cards in all, the
        longest run being <b>{distribution.longestStreak.toLocaleString()}</b>.
      </Text>

      <Text size="sm" c="dimmed">
        <b>New</b> stands apart from <b>0</b> because the two say opposite
        things about a card: <b>{distribution.newCards.toLocaleString()}</b>{" "}
        cards have never been reviewed in this profile, while{" "}
        <b>{distribution.lapsedCards.toLocaleString()}</b> were asked and got
        the last one wrong.
      </Text>

      <Text size="sm" c="dimmed">
        A long run is not always the same as a very well known card, which is
        why the bars can have different colors. When using granular Pleco review
        grades (“remembered perfectly”, “remembered”, “barely remembered”),
        cards are still considered as correctly reviewed but shown in a
        different color. A card can be answered correctly twenty times running
        and still come back every few weeks.
      </Text>

      <Text size="sm" c="dimmed">
        Selecting a bar lists the cards it counts: the numbered ones open{" "}
        <Anchor component={Link} to="/streaks">
          Streaks
        </Anchor>{" "}
        at that run, and <b>New</b> opens{" "}
        <Anchor component={Link} to="/new">
          New cards
        </Anchor>
        . Both are in the sidebar too — a chart is not something a keyboard can
        select from.
      </Text>

      <Text size="sm" c="dimmed">
        For the cards that really have run out of review interval to earn, see{" "}
        <Anchor component={Link} to="/learned">
          Learned cards
        </Anchor>
        .
      </Text>
    </Stack>
  );
};

export default LearningDistribution;
