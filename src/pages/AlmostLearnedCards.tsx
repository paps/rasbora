import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { useMemo, type ReactNode } from "react";
import type { FlashcardData } from "@/components/Flashcard";
import CardList, { type CardColumn } from "@/components/CardList";
import { formatDays } from "@/components/days";
import { scoreToDays } from "@/database/reviewSchedule";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readAlmostLearnedCards } from "@/pages/AlmostLearnedCards.db";

const COLUMNS: CardColumn<FlashcardData>[] = [
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
  threshold: number | null,
  ceiling: number | null,
): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.scorefile === null) {
    return (
      <>The {name} profile writes to no scorefile, so it scores no card.</>
    );
  }

  if (profile.categoryIds.length === 0) {
    return (
      <>The {name} profile draws from no category, so it reviews no card.</>
    );
  }

  if (threshold === null || ceiling === null) {
    return (
      <>
        The {name} profile records no score bands, so there is no top one to
        read this from.
      </>
    );
  }

  return (
    <>
      No card in the {name} profile is in its top score band below the ceiling.
    </>
  );
};

/**
 * The cards in the profile's top score band that have not reached its ceiling:
 * they come back at the longest interval the profile has, but they still come
 * back. Ordered like the learned list — longest since last reviewed first.
 */
const AlmostLearnedCards = () => {
  const { database, profile } = useDatabase();

  const almost = useMemo(
    () =>
      database && profile ? readAlmostLearnedCards(database, profile) : null,
    [database, profile],
  );

  // The two are null together — a score band is a profile's, never the file's.
  if (!almost || !profile) {
    return (
      <Stack gap="md">
        <Title>Almost learned cards</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see the cards near a profile’s longest review interval.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Almost learned cards</Title>

      {almost.cards.length === 0 ? (
        <Text c="dimmed">
          {emptyReason(
            profile,
            almost.threshold,
            almost.scoreRange?.max ?? null,
          )}
        </Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{almost.total.toLocaleString()}</b> cards sit in the{" "}
            <b>{profile.name}</b> profile’s{" "}
            <Explained info="The last of the score bands the profile spaces reviews by, from its pro_scorefilter_*_starts settings. Cards in this band have long review intervals. Even a card at the maximum score can become due again.">
              top score band
            </Explained>
            , with review intervals from{" "}
            <b>
              {formatDays(scoreToDays(almost.threshold, almost.pointsPerDay))}
            </b>{" "}
            up to, but below, the maximum of{" "}
            <b>
              {formatDays(
                scoreToDays(
                  almost.scoreRange?.max ?? null,
                  almost.pointsPerDay,
                ),
              )}
            </b>
            .{" "}
            {almost.total > almost.cards.length && (
              <>
                The <b>{almost.cards.length.toLocaleString()}</b> longest unseen
                are listed.{" "}
              </>
            )}
            Least recently reviewed first. Select a card to see its details.
          </Text>

          <CardList cards={almost.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default AlmostLearnedCards;
