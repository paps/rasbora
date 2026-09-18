import { Anchor, Group, NumberInput, Stack, Text, Title } from "@mantine/core";
import { Link, useSearchParams } from "react-router";
import { useMemo, type ReactNode } from "react";
import CardList, { type CardColumn } from "@/components/CardList";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import {
  readStreakCandidates,
  selectStreak,
  type StreakCard,
} from "@/pages/Streaks.db";

/**
 * The querystring key the run is read from and written back to, and the run
 * shown when it carries none.
 *
 * The control's value lives in the address rather than in component state, so
 * that a bar on `Learning distribution` can open this page already showing its
 * cards, and so that what the reader is looking at survives a reload and can
 * be sent to someone. `RUN_PARAM` is the same word the chart's axis and the
 * `Lapses` control use, because it is the same idea.
 */
export const RUN_PARAM = "run";
const DEFAULT_RUN = 1;

/**
 * The most the control accepts. The longest review log in an export seen so
 * far is 83 reviews, so a hundred is past the point where a run can still
 * match a card.
 */
const MAX_RUN = 100;

/**
 * The run named by the address, or the default when it names none that a card
 * could be on. Zero is a real answer here — the cards that failed their last
 * review — so it is only a missing, fractional, negative or absurd value that
 * falls back.
 */
const runFromParam = (value: string | null): number => {
  const run = Number(value);

  return value !== null &&
    value.trim() !== "" &&
    Number.isInteger(run) &&
    run >= 0 &&
    run <= MAX_RUN
    ? run
    : DEFAULT_RUN;
};

const COLUMNS: CardColumn<StreakCard>[] = [
  {
    key: "perfect",
    header: (
      <Explained info="Whether the run is made of nothing but “remembered perfectly”, which is what a plain correct answer records, or holds an answer the user graded lower. Both count as correct, but a lower grade grows the review interval far less, so a long run of them is not the same as a card that is known cold.">
        Run
      </Explained>
    ),
    align: "left",
    cell: (card) => (card.perfect ? "All perfect" : "Some weaker"),
  },
  {
    key: "reviewed",
    header: "Reviewed",
    cell: (card) => card.reviewed.toLocaleString(),
  },
  {
    key: "lastReviewed",
    header: "Last reviewed",
    align: "left",
    cell: (card) => <RelativeTime seconds={card.lastReviewed} />,
  },
];

/** Why the table has no rows; see `LearnedCards.tsx` for why this is spelled out. */
const emptyReason = (
  profile: Profile,
  run: number,
  reviewed: number,
): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.scorefile === null) {
    return (
      <>
        The {name} profile writes to no scorefile, so it has no review history.
      </>
    );
  }

  if (profile.categoryIds.length === 0) {
    return (
      <>The {name} profile draws from no category, so it reviews no card.</>
    );
  }

  if (reviewed === 0) {
    return (
      <>
        The {name} profile has never reviewed a card, so no card is on a run.
        See{" "}
        <Anchor component={Link} to="/new">
          New cards
        </Anchor>{" "}
        for the ones waiting.
      </>
    );
  }

  return (
    <>
      No card in the {name} profile is on exactly <b>{run.toLocaleString()}</b>{" "}
      correct answers in a row.
    </>
  );
};

/**
 * The cards on one exact run of correct answers — the list behind a bar of the
 * `Learning distribution` chart, and the page that chart's axis is about.
 *
 * Exactly, not "at least": clicking a bar of 530 has to open a list of 530, so
 * both sides count through the same `runOf`. Cards the profile has never
 * reviewed are not here at all — they are on `New cards`, which is the chart's
 * first bar and a different question.
 */
const Streaks = () => {
  const { database, profile } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const run = runFromParam(searchParams.get(RUN_PARAM));

  // Read once per profile; the control re-filters what is already in memory.
  const source = useMemo(
    () =>
      database && profile ? readStreakCandidates(database, profile) : null,
    [database, profile],
  );
  const streak = useMemo(
    () => (source === null ? null : selectStreak(source.candidates, run)),
    [source, run],
  );

  // The two are null together — a run is counted in one profile's scorefile.
  if (!streak || !source || !profile) {
    return (
      <Stack gap="md">
        <Title>Streaks</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to list the cards on a given run of correct answers.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Streaks</Title>

      <Text size="sm" c="dimmed">
        Cards the <b>{profile.name}</b> profile has answered correctly a given
        number of times in a row, counted back from the last review to the
        failure before it. The longest run in this profile is{" "}
        <b>{source.longestRun.toLocaleString()}</b>.{" "}
        <Anchor component={Link} to="/learning-distribution">
          Learning distribution
        </Anchor>{" "}
        charts how many cards are on each, and selecting one of its bars opens
        it here.
      </Text>

      <Group gap="md" align="flex-end">
        <NumberInput
          label="Correct answers in a row"
          description="Zero means the last review was a failure"
          w={240}
          min={0}
          max={MAX_RUN}
          allowDecimal={false}
          allowNegative={false}
          value={run}
          onChange={(value) => {
            const next = Number(value);

            if (Number.isInteger(next) && next >= 0 && next <= MAX_RUN) {
              // Replaced rather than pushed: stepping the control is adjusting
              // one view, not visiting a page each time, and the reader should
              // get back to the chart in one press rather than twenty.
              setSearchParams({ [RUN_PARAM]: String(next) }, { replace: true });
            }
          }}
        />
      </Group>

      {streak.cards.length === 0 ? (
        <Text c="dimmed">
          {emptyReason(profile, run, source.candidates.length)}
        </Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{streak.total.toLocaleString()}</b> cards are on exactly{" "}
            <b>{run.toLocaleString()}</b> correct answers in a row.{" "}
            {streak.total > streak.cards.length && (
              <>
                The <b>{streak.cards.length.toLocaleString()}</b> due soonest
                are listed.{" "}
              </>
            )}
            Soonest due first. Select a card to see its details.
          </Text>

          <CardList cards={streak.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default Streaks;
