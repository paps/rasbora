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
  selectStreaks,
  type StreakCard,
  type StreakRange,
} from "@/pages/Streaks.db";

/**
 * The querystring keys the range is read from and written back to, and the run
 * shown when the address carries none.
 *
 * The control's value lives in the address rather than in component state, so
 * that a bar on `Learning distribution` can open this page already showing its
 * cards, and so that what the reader is looking at survives a reload and can
 * be sent to someone. `RUN_PARAM` is the same word the chart's axis and the
 * `Lapses` control use, because it is the same idea.
 *
 * `RUN_TO_PARAM` is optional and widens that one run into a range, which is
 * why `run` keeps meaning the same thing alone as it always did: the chart
 * links one run and gets one run, and every address written before this
 * parameter existed still opens what it used to.
 */
export const RUN_PARAM = "run";
export const RUN_TO_PARAM = "runTo";
const DEFAULT_RUN = 4;

/**
 * The most either control accepts. The longest review log in an export seen so
 * far is 83 reviews, so a hundred is past the point where a run can still
 * match a card.
 */
const MAX_RUN = 100;

/**
 * What a value means as a run, or null when it is not one a card could be on.
 *
 * Zero is a real answer here — the cards that failed their last review — so it
 * is only a missing, empty, fractional, negative or absurd value that is
 * refused. The empty string is checked before `Number`, which reads it as a
 * zero and would otherwise send a reader who cleared the field to the lapsed
 * cards mid-edit.
 *
 * Both the address and the controls are read through this, so a typed
 * parameter and a typed keystroke are held to one standard.
 */
const asRun = (value: string | number | null): number | null => {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const run = Number(value);

  return Number.isInteger(run) && run >= 0 && run <= MAX_RUN ? run : null;
};

/**
 * The runs the address names, defaulted and ordered.
 *
 * A missing or unusable `run` falls back to the default, and a `runTo` that is
 * missing, unusable or below `run` collapses the range to that single run
 * rather than listing nothing: an address naming an impossible range is a
 * mistake to recover from, and the empty table it would otherwise produce
 * would be indistinguishable from a profile with no card there.
 */
const rangeFromParams = (params: URLSearchParams): StreakRange => {
  const from = asRun(params.get(RUN_PARAM)) ?? DEFAULT_RUN;
  const to = asRun(params.get(RUN_TO_PARAM));

  return { from, to: to !== null && to >= from ? to : from };
};

/**
 * How the page says which runs it is showing, in the one phrasing every
 * sentence on it uses. A range of one still reads "exactly", because that is
 * what the chart's bar promised when it linked here.
 */
const runPhrase = ({ from, to }: StreakRange): ReactNode =>
  to > from ? (
    <>
      between <b>{from.toLocaleString()}</b> and <b>{to.toLocaleString()}</b>
    </>
  ) : (
    <>
      exactly <b>{from.toLocaleString()}</b>
    </>
  );

const COLUMNS: CardColumn<StreakCard>[] = [
  {
    key: "run",
    header: (
      <Explained info="How many times in a row this card has been answered correctly, counted back from its last review to the failure before it. Every card in a one-run list shares this number; over a range it is what says where in the range each card sits.">
        Run
      </Explained>
    ),
    cell: (card) => card.run.toLocaleString(),
  },
  {
    key: "perfect",
    header: (
      <Explained info="Whether the run is made of nothing but “remembered perfectly”, which is what a plain correct answer records, or holds an answer the user graded lower. Both count as correct, but a lower grade grows the review interval far less, so a long run of them is not the same as a card that is known cold.">
        Quality
      </Explained>
    ),
    align: "left",
    // A card on no run has nothing here to be perfect or not. Every row reads
    // the same way when the run is zero, but the column stays rather than
    // appearing and disappearing under a reader stepping through runs.
    cell: (card) =>
      card.run === 0 ? (
        <Explained info="This card was asked and got the last one wrong, so it is on no run at all — there are no answers here to have been perfect or otherwise.">
          —
        </Explained>
      ) : card.perfect ? (
        "All perfect"
      ) : (
        "Some weaker"
      ),
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

/**
 * Why the table has no rows. Four different questions can be the reason, and
 * saying the wrong one misleads: without a scorefile the profile scores
 * nothing, without categories it reviews nothing, with nothing reviewed yet no
 * card is on a run at all, and only then does an empty list mean no card is on
 * these particular runs. Every list in the app spells its empty state out this
 * way rather than showing a bare "no results".
 */
const emptyReason = (
  profile: Profile,
  range: StreakRange,
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
      No card in the {name} profile is on {runPhrase(range)} correct answers in
      a row.
      {range.to === range.from && " Try widening the range."}
    </>
  );
};

/**
 * The cards on a run of correct answers, the runs being the reader's to pick —
 * one exact run, or a range of them.
 *
 * It is the list behind a bar of the `Learning distribution` chart, so a range
 * of one is exact: clicking a bar of 530 has to open a list of 530, and both
 * sides count through the same `runOf`. The chart links one run and nothing
 * else; the range is for the question a bar cannot ask, which is what a band
 * of the deck looks like all at once.
 *
 * Cards the profile has never reviewed are not here at all — they are on
 * `New cards`, which is the chart's first bar and a different question.
 */
const Streaks = () => {
  const { database, profile } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const { from, to } = rangeFromParams(searchParams);

  /**
   * Writes a range back to the address. A single run writes `run` alone, so
   * the address a reader shares from a one-run view is the one the chart
   * would have linked, and `runTo` appears only when it is saying something.
   *
   * Replaced rather than pushed: stepping a control is adjusting one view, not
   * visiting a page each time, and the reader should get back to the chart in
   * one press rather than twenty.
   */
  const showRange = (next: StreakRange) => {
    setSearchParams(
      next.to > next.from
        ? {
            [RUN_PARAM]: String(next.from),
            [RUN_TO_PARAM]: String(next.to),
          }
        : { [RUN_PARAM]: String(next.from) },
      { replace: true },
    );
  };

  // Read once per profile; the controls re-filter what is already in memory.
  const source = useMemo(
    () =>
      database && profile ? readStreakCandidates(database, profile) : null,
    [database, profile],
  );
  const streak = useMemo(
    () =>
      source === null ? null : selectStreaks(source.candidates, { from, to }),
    [source, from, to],
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
        failure before it. Set both ends to the same number for one exact run,
        or widen them to look at a band of the deck at once. The longest run in
        this profile is <b>{source.longestRun.toLocaleString()}</b>.{" "}
        <Anchor component={Link} to="/learning-distribution">
          Learning distribution
        </Anchor>{" "}
        charts how many cards are on each, and selecting one of its bars opens
        that single run here.
      </Text>

      <Group gap="md" align="flex-end">
        <NumberInput
          label="Correct answers in a row, from"
          description="Zero means the last review was a failure"
          w={240}
          min={0}
          max={MAX_RUN}
          allowDecimal={false}
          allowNegative={false}
          value={from}
          onChange={(value) => {
            const next = asRun(value);

            if (next !== null) {
              // The top of the range comes up with the bottom rather than
              // blocking it, so raising "from" past "to" is one edit instead
              // of two in the right order.
              showRange({ from: next, to: Math.max(next, to) });
            }
          }}
        />
        <NumberInput
          label="to"
          description="Same number for a single run"
          w={240}
          // The floor is the other control's value, so the steppers cannot
          // build a range that names no card, and a typed value below it
          // clamps instead of emptying the table.
          min={from}
          max={MAX_RUN}
          allowDecimal={false}
          allowNegative={false}
          value={to}
          onChange={(value) => {
            const next = asRun(value);

            if (next !== null) {
              showRange({ from, to: Math.max(from, next) });
            }
          }}
        />
      </Group>

      {streak.cards.length === 0 ? (
        <Text c="dimmed">
          {emptyReason(profile, { from, to }, source.candidates.length)}
        </Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{streak.total.toLocaleString()}</b> cards are on{" "}
            {runPhrase({ from, to })} correct answers in a row.{" "}
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
