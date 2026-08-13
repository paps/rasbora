import { Group, NumberInput, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState, type ReactNode } from "react";
import CardList, { type CardColumn } from "@/components/CardList";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import {
  readRiskyCandidates,
  selectRiskyCards,
  type RiskyCard,
} from "@/pages/RiskyCards.db";

/**
 * Where the two controls start. Four correct answers in a row is a card the
 * user had; a window of three recent reviews catches a card that failed and
 * has been limping since, without reaching so far back that a long-recovered
 * card counts as risky.
 */
const DEFAULT_RUN_LENGTH = 4;
const DEFAULT_RECENT_WINDOW = 3;
/**
 * The most either control accepts. The longest review log in an export seen so
 * far is 83 reviews, so a hundred is past the point where either number can
 * still match a card.
 */
const MAX_REVIEWS = 100;

/**
 * What a control's new value means, or null when it is not a length yet. A
 * cleared field reads as an empty string, and letting that through as a zero
 * would match every card that has ever failed; the old value stands until the
 * reader has typed a usable one.
 */
const asReviewCount = (value: string | number): number | null => {
  const count = Number(value);

  return Number.isInteger(count) && count >= 1 && count <= MAX_REVIEWS
    ? count
    : null;
};

const COLUMNS: CardColumn<RiskyCard>[] = [
  {
    key: "brokenRun",
    header: "Run broken",
    cell: (card) => card.brokenRun.toLocaleString(),
  },
  {
    key: "reviewsSince",
    header: "Reviews since",
    cell: (card) => card.reviewsSince.toLocaleString(),
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
  runLength: number,
  candidates: number,
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

  if (candidates === 0) {
    return <>No card in the {name} profile has been both passed and failed.</>;
  }

  return (
    <>
      No card in the {name} profile has failed recently after{" "}
      <b>{runLength.toLocaleString()}</b> correct answers in a row. Try a
      shorter run, or a wider recent window.
    </>
  );
};

/**
 * The cards that were known and are slipping: a run of correct answers, then a
 * failure among the most recent reviews. Both lengths are the reader's to set,
 * because how long a run has to be before losing it matters is a judgement
 * about their own deck rather than something the export says.
 */
const RiskyCards = () => {
  const { database, profile } = useDatabase();
  const [runLength, setRunLength] = useState(DEFAULT_RUN_LENGTH);
  const [recentWindow, setRecentWindow] = useState(DEFAULT_RECENT_WINDOW);

  // Read once per profile; the controls re-filter what is already in memory.
  const candidates = useMemo(
    () => (database && profile ? readRiskyCandidates(database, profile) : null),
    [database, profile],
  );
  const risky = useMemo(
    () =>
      candidates === null
        ? null
        : selectRiskyCards(candidates, { runLength, recentWindow }),
    [candidates, runLength, recentWindow],
  );

  // The two are null together — a review log belongs to a profile's scorefile.
  if (!risky || !candidates || !profile) {
    return (
      <Stack gap="lg">
        <Title>Risky cards</Title>
        <Text c="dimmed">
          Import a set of flashcards to see the cards a profile is losing.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title>Risky cards</Title>

      <Text size="sm" c="dimmed">
        Cards the <b>{profile.name}</b> profile had learned and is now getting
        wrong: a run of correct answers in its “<b>{profile.scorefile?.name}</b>
        ” scorefile, broken by a failure among the most recent reviews. Pleco{" "}
        <Explained info="The review log is one digit per review and holds no dates, so a card's reviews can be read in order but not placed in time. “Recent” therefore means a number of reviews back, not a number of weeks.">
          dates no individual review
        </Explained>
        , so “recently” is counted in reviews.
      </Text>

      <Group gap="md" align="flex-end">
        <NumberInput
          label="Correct answers in a row"
          description="How long the run was"
          w={200}
          min={1}
          max={MAX_REVIEWS}
          allowDecimal={false}
          allowNegative={false}
          value={runLength}
          onChange={(value) => {
            const count = asReviewCount(value);

            if (count !== null) {
              setRunLength(count);
            }
          }}
        />
        <NumberInput
          label="Recent reviews to check"
          description="Where the failure has to be"
          w={200}
          min={1}
          max={MAX_REVIEWS}
          allowDecimal={false}
          allowNegative={false}
          value={recentWindow}
          onChange={(value) => {
            const count = asReviewCount(value);

            if (count !== null) {
              setRecentWindow(count);
            }
          }}
        />
      </Group>

      {risky.cards.length === 0 ? (
        <Text c="dimmed">
          {emptyReason(profile, runLength, candidates.length)}
        </Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{risky.total.toLocaleString()}</b> cards had at least{" "}
            <b>{runLength.toLocaleString()}</b> correct answers in a row and
            then failed within their last <b>{recentWindow.toLocaleString()}</b>{" "}
            reviews.{" "}
            {risky.total > risky.cards.length && (
              <>
                The <b>{risky.cards.length.toLocaleString()}</b> that lost the
                longest runs are listed.{" "}
              </>
            )}
            Longest run lost first. Select a card to see its details.
          </Text>

          <CardList cards={risky.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default RiskyCards;
