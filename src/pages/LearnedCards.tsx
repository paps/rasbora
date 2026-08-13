import { Stack, Text, Title } from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import CardList, { type CardColumn } from "@/components/CardList";
import Explained from "@/components/Explained";
import type { FlashcardData } from "@/components/Flashcard";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readLearnedCards } from "@/pages/LearnedCards.db";

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

/**
 * Why the table has no rows. Four different questions can be the reason, and
 * saying the wrong one misleads: without a scorefile the profile has no scores
 * to reach a ceiling, without categories it reviews nothing, without
 * `pro_scoreautomax` there is no ceiling to speak of, and only then does an
 * empty list mean no card has got there yet.
 */
const emptyReason = (profile: Profile, ceiling: number | null): ReactNode => {
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

  if (ceiling === null) {
    return (
      <>
        The {name} profile records no maximum score, so there is no point at
        which a card is finished with.
      </>
    );
  }

  return (
    <>
      No card in the {name} profile has reached its maximum score of{" "}
      <b>{ceiling.toLocaleString()}</b> yet.
    </>
  );
};

/**
 * The cards this profile is done with: score at the profile's ceiling, so
 * Pleco cannot space them out any further. Oldest first, meaning longest since
 * the profile last showed one — the export dates no individual review, so that
 * is the only age a saturated card carries.
 */
const LearnedCards = () => {
  const { database, profile } = useDatabase();

  const learned = useMemo(
    () => (database && profile ? readLearnedCards(database, profile) : null),
    [database, profile],
  );

  // The two are null together — a ceiling is a profile's, never the export's.
  if (!learned || !profile) {
    return (
      <Stack gap="lg">
        <Title>Learned cards</Title>
        <Text c="dimmed">
          Import a set of flashcards to see the cards a profile is finished
          with.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title>Learned cards</Title>

      {learned.cards.length === 0 ? (
        <Text c="dimmed">{emptyReason(profile, learned.ceiling)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{learned.total.toLocaleString()}</b> cards have reached the{" "}
            <b>{profile.name}</b> profile’s{" "}
            <Explained info="The highest score the profile lets a card reach, from its pro_scoreautomax setting. A card there has no interval left to earn, so it comes back as rarely as this profile ever shows a card.">
              maximum score
            </Explained>{" "}
            of <b>{learned.ceiling?.toLocaleString()}</b> in its “
            <b>{profile.scorefile?.name}</b>” scorefile.{" "}
            {learned.total > learned.cards.length && (
              <>
                The <b>{learned.cards.length.toLocaleString()}</b> longest
                unseen are listed.{" "}
              </>
            )}
            Least recently reviewed first — the export dates no individual
            review, so that is the only age a finished card carries. Select a
            card to see its details.
          </Text>

          <CardList cards={learned.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default LearnedCards;
