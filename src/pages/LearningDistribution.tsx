import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { BarChart } from "@mantine/charts";
import { useElementSize } from "@mantine/hooks";
import { useMemo } from "react";
import Explained from "@/components/Explained";
import { useDatabase } from "@/database/context";
import { readLearningDistribution } from "@/pages/LearningDistribution.db";

/**
 * The bars counting cards by the run they are on. One series, so the chart
 * needs no legend — the title says what is being counted.
 *
 * `blue.7` and `orange.8` are two of the six in `Statistics.tsx`'s
 * `CATEGORY_COLORS`, and the pair was re-checked here rather than assumed from
 * being drawn from a validated set: worst-case ΔE 26.0 under the three
 * dichromacy simulations and 34.4 in normal vision, clearing 3:1 against both
 * the light and the dark page. Neither is a neutral, so neither follows the
 * colour scheme — see the "light or dark" rules in `AGENTS.md`.
 */
const STREAK_COLOR = "blue.7";

/**
 * The "New" bar, which is not a point on the run axis and so is not drawn in
 * the run colour. The hue is not what says so — the tick under it reads "New"
 * and the caption spells it out — it is what makes the split visible at the
 * glance this page exists for.
 */
const NEW_COLOR = "orange.8";

/** Key the bars are read from; `bucket` is the axis. */
const CARDS = "cards";

/**
 * How much of the chart's width a bar needs before its count is written above
 * it. A profile with a long tail draws two dozen bars, and on a phone their
 * labels run into each other and read as one smear of digits — worse than no
 * label, since the tooltip gives the exact count either way.
 *
 * Measured rather than guessed from a breakpoint: whether the labels fit is a
 * question about the bars, and the same screen holds a profile with four of
 * them comfortably and one with twenty-four not at all.
 */
const LABEL_ROOM = 40;

/**
 * How a profile's cards are spread across their current run of correct
 * answers: how many it has never asked about, how many it just got wrong, and
 * how far the rest have got without a slip.
 *
 * Read left to right it is the shape of the deck — a tall left end is a pile of
 * cards waiting to be learned, a fat middle is learning in progress, and the
 * right tail is what the profile has not managed to catch out in a long time.
 *
 * The "New" bar is deliberately not part of the numeric axis. A card the
 * profile has never reviewed and a card that failed its last review are both
 * on a run of zero, and merging them would make the left end unreadable: in
 * this export's big profile every one of the 909 cards at zero has been
 * reviewed, while in its small one 263 of 283 never have.
 */
const LearningDistribution = () => {
  const { database, profile } = useDatabase();
  const { ref, width } = useElementSize();

  const distribution = useMemo(
    () =>
      database && profile ? readLearningDistribution(database, profile) : null,
    [database, profile],
  );

  const data = useMemo(
    () =>
      distribution?.buckets.map(({ streak, cards }) => ({
        bucket: streak === null ? "New" : streak.toLocaleString(),
        [CARDS]: cards,
        ...(streak === null ? { color: NEW_COLOR } : {}),
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
        h={420}
        data={data}
        dataKey="bucket"
        series={[{ name: CARDS, label: "Cards", color: STREAK_COLOR }]}
        ref={ref}
        withBarValueLabel={width === 0 || width / data.length >= LABEL_ROOM}
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
        A run is not a score. Pleco spaces a card by its score, which a run of
        correct answers raises but does not decide on its own, so two cards on
        the same bar can be due on quite different days — see{" "}
        <Anchor component={Link} to="/learned">
          Learned cards
        </Anchor>{" "}
        for the cards that have run out of interval to earn.
      </Text>
    </Stack>
  );
};

export default LearningDistribution;
