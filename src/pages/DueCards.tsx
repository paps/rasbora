import { Anchor, Group, NumberInput, Stack, Text, Title } from "@mantine/core";
import { Link, useSearchParams } from "react-router";
import { useMemo, useState, type ReactNode } from "react";
import CardList, { type CardColumn } from "@/components/CardList";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import {
  readDueCandidates,
  selectDueCards,
  type DueCard,
  type DueRange,
} from "@/pages/DueCards.db";

/**
 * The querystring keys the range is read from and written back to.
 *
 * The controls' values live in the address rather than in component state, for
 * the reasons they do on `Streaks`: a bar on `Incoming reviews` can open this
 * page already showing its cards, and what the reader is looking at survives a
 * reload and can be sent to someone. `days` is the same word the chart's axis
 * uses, because it is the same number.
 *
 * `daysTo` is optional and widens that one day into a range, so `days` alone
 * always means one exact day — which is what the chart links and what lets a
 * bar of 530 promise a list of 530.
 */
export const DAYS_PARAM = "days";
export const DAYS_TO_PARAM = "daysTo";

/**
 * The furthest either control reaches, in days.
 *
 * A century in both directions, which is past anything an export can hold: the
 * score ceiling caps an interval at about 512 days, and the overdue end is
 * bounded by how long ago a card was last reviewed. It exists to refuse a
 * typo, not to express a limit the data has.
 */
const MAX_DAYS = 36_500;

/**
 * What a value means as a number of days, or null when it is not one.
 *
 * Negatives are the point here — an overdue card sits on a negative day — so
 * only a missing, empty, fractional or absurd value is refused. The empty
 * string is checked before `Number`, which reads it as zero and would
 * otherwise jump a reader who cleared the field to the cards due today, and a
 * lone `-` mid-edit is a `NaN` that leaves the old value standing.
 *
 * Both the address and the controls are read through this, so a typed
 * parameter and a typed keystroke are held to one standard.
 */
const asDay = (value: string | number | null): number | null => {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const day = Number(value);

  return Number.isInteger(day) && Math.abs(day) <= MAX_DAYS ? day : null;
};

/**
 * What the page shows when the address names no range: every card whose
 * estimated review time has already passed, which is exactly the set behind
 * the red bars and the "cards due for review" heading on `Incoming reviews`.
 *
 * It ends at -1 rather than 0 because day zero means "due within the next 24
 * hours" and is not yet due, the same line that heading draws. The start is
 * the profile's own earliest estimate, so the default covers everything
 * overdue without naming a day no card could sit on — and it is pulled below
 * -1 for a profile with nothing overdue at all, so the range stays a range and
 * the empty state can say what is actually going on.
 */
const overdueRange = (earliestDay: number | null): DueRange => ({
  from: Math.min(earliestDay ?? -1, -1),
  to: -1,
});

/**
 * The days the address names, defaulted and ordered.
 *
 * With neither parameter the default range stands. With either one, a missing
 * or unusable `days` falls back to the default's start, and a `daysTo` that is
 * missing, unusable or below `days` collapses the range to that single day
 * rather than listing nothing: an address naming an impossible range is a
 * mistake to recover from, and the empty table it would otherwise produce
 * would be indistinguishable from a profile with no card due then.
 */
const rangeFromParams = (
  params: URLSearchParams,
  fallback: DueRange,
): DueRange => {
  const from = asDay(params.get(DAYS_PARAM));
  const to = asDay(params.get(DAYS_TO_PARAM));

  if (from === null && to === null) {
    return fallback;
  }

  const start = from ?? fallback.from;

  return { from: start, to: to !== null && to >= start ? to : start };
};

/**
 * How the page says which days it is showing, in the one phrasing every
 * sentence on it uses. A range of one still reads "exactly", because that is
 * what the chart's bar promised when it linked here.
 */
const dayPhrase = ({ from, to }: DueRange): ReactNode =>
  to > from ? (
    <>
      between <b>{from.toLocaleString()}</b> and <b>{to.toLocaleString()}</b>{" "}
      days until review
    </>
  ) : (
    <>
      exactly <b>{from.toLocaleString()}</b> days until review
    </>
  );

/**
 * The extra columns. There is deliberately no column for the whole day a card
 * falls on: `CardList` already shows every card's time until review, in the
 * same place on every page and to a tenth of a day near zero, so a bucket
 * column would be the same number twice and rounded worse. What these two add
 * is why a card sits where it does — a card reviewed long ago on a short
 * interval is deeply overdue, and one reviewed yesterday is not.
 */
const COLUMNS: CardColumn<DueCard>[] = [
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
 * card has a date to estimate, and only then does an empty list mean no card
 * is due on these particular days. Every list in the app spells its empty
 * state out this way rather than showing a bare "no results".
 */
const emptyReason = (
  profile: Profile,
  range: DueRange,
  estimated: number,
): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.scorefile === null) {
    return (
      <>
        The {name} profile writes to no scorefile, so no card in it has a review
        date to estimate from.
      </>
    );
  }

  if (profile.categoryIds.length === 0) {
    return (
      <>The {name} profile draws from no category, so it reviews no card.</>
    );
  }

  if (estimated === 0) {
    return (
      <>
        No card in the {name} profile has enough saved state to estimate a
        review date: that takes a score, a last review date, and card points per
        day on the profile.
      </>
    );
  }

  return (
    <>
      No card in the {name} profile has {dayPhrase(range)}.
      {range.to === range.from && " Try widening the range."}
    </>
  );
};

/**
 * The cards due within a band of days, the band being the reader's to pick —
 * one exact day, or a range of them, either end of which can be negative.
 *
 * It is the list behind a bar of the `Incoming reviews` chart, so a range of
 * one is exact: clicking a bar of 530 has to open a list of 530, and both
 * sides bucket through `wholeDaysUntil`. Arriving with no range at all, from
 * the sidebar or from that chart's due heading, it shows everything already
 * overdue.
 *
 * Cards the profile cannot schedule are not here at all — a card with no
 * score, no last review date, or a profile with no usable points per day has
 * no day to sit on, and they are counted under the table rather than given an
 * invented one, exactly as the chart counts them under itself.
 */
const DueCards = () => {
  const { database, profile } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  // Unix seconds, read once on mount as on `Incoming reviews`: a day until
  // review is only a day away from some moment, and reading the clock per
  // render would shuffle cards between days under the reader.
  const [now] = useState(() => Date.now() / 1000);

  // Read once per profile; the controls re-filter what is already in memory.
  const source = useMemo(
    () =>
      database && profile ? readDueCandidates(database, profile, now) : null,
    [database, profile, now],
  );

  const { from, to } = rangeFromParams(
    searchParams,
    overdueRange(source?.earliestDay ?? null),
  );

  const due = useMemo(
    () =>
      source === null ? null : selectDueCards(source.candidates, { from, to }),
    [source, from, to],
  );

  /**
   * Writes a range back to the address. A single day writes `days` alone, so
   * the address a reader shares from a one-day view is the one the chart would
   * have linked, and `daysTo` appears only when it is saying something.
   *
   * Replaced rather than pushed: stepping a control is adjusting one view, not
   * visiting a page each time, and the reader should get back to the chart in
   * one press rather than twenty.
   */
  const showRange = (next: DueRange) => {
    setSearchParams(
      next.to > next.from
        ? {
            [DAYS_PARAM]: String(next.from),
            [DAYS_TO_PARAM]: String(next.to),
          }
        : { [DAYS_PARAM]: String(next.from) },
      { replace: true },
    );
  };

  // The two are null together — a due date is estimated through one profile.
  if (!due || !source || !profile) {
    return (
      <Stack gap="md">
        <Title>Due cards</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to list the cards due for review.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Due cards</Title>

      <Text size="sm" c="dimmed">
        Cards the <b>{profile.name}</b> profile estimates are due within a given
        number of days, counted from when this page was opened and{" "}
        <Explained info="A card 2.7 days away is in 2, and one 0.2 days overdue is in -1 — the same whole days the chart's bars count, so a bar and this list always hold the same cards.">
          rounded down to whole days
        </Explained>
        . Negative days are overdue, <b>0</b> means due within the next 24
        hours, and both ends of the range can be negative. Set both to the same
        number for one exact day.{" "}
        <Anchor component={Link} to="/incoming-reviews">
          Incoming reviews
        </Anchor>{" "}
        charts how many cards fall on each day, and selecting one of its bars
        opens that single day here.
      </Text>

      <Group gap="md" align="flex-end">
        <NumberInput
          label="Days until review, from"
          description="Negative is overdue"
          w={240}
          min={-MAX_DAYS}
          max={MAX_DAYS}
          allowDecimal={false}
          value={from}
          onChange={(value) => {
            const next = asDay(value);

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
          description="Same number for a single day"
          w={240}
          // The floor is the other control's value, so the steppers cannot
          // build a range that names no day, and a typed value below it clamps
          // instead of emptying the table.
          min={from}
          max={MAX_DAYS}
          allowDecimal={false}
          value={to}
          onChange={(value) => {
            const next = asDay(value);

            if (next !== null) {
              showRange({ from, to: Math.max(from, next) });
            }
          }}
        />
      </Group>

      {due.cards.length === 0 ? (
        <Text c="dimmed">
          {emptyReason(profile, { from, to }, source.candidates.length)}
        </Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{due.total.toLocaleString()}</b> cards have{" "}
            {dayPhrase({ from, to })}.{" "}
            {due.total > due.cards.length && (
              <>
                The <b>{due.cards.length.toLocaleString()}</b> due soonest are
                listed.{" "}
              </>
            )}
            Soonest due first. Select a card to see its details.
          </Text>

          <CardList cards={due.cards} columns={COLUMNS} />
        </>
      )}

      {source.unknownCards > 0 && (
        <Text size="sm" c="dimmed">
          <b>{source.unknownCards.toLocaleString()}</b> of the profile’s{" "}
          <b>{source.totalCards.toLocaleString()}</b> cards can appear on no day
          at all, here or on the chart, because they lack a score, a valid last
          review date, or valid card points per day in this profile.
        </Text>
      )}
    </Stack>
  );
};

export default DueCards;
