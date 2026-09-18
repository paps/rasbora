import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { useMemo, type ReactNode } from "react";
import type { FlashcardData } from "@/components/Flashcard";
import CardList, { type CardColumn } from "@/components/CardList";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readNewCards } from "@/pages/NewCards.db";

const COLUMNS: CardColumn<FlashcardData>[] = [
  {
    key: "created",
    header: "Added",
    align: "left",
    cell: (card) => <RelativeTime seconds={card.created} />,
  },
];

/** Why the table has no rows; see `LearnedCards.tsx` for why this is spelled out. */
const emptyReason = (profile: Profile): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.categoryIds.length === 0) {
    return <>The {name} profile draws from no category, so it holds no card.</>;
  }

  return (
    <>Every card the {name} profile holds has been reviewed at least once.</>
  );
};

/**
 * The cards waiting to be started: held by the profile, never once put in
 * front of the reader.
 *
 * This is the `Learning distribution` chart's first bar, and it is a page of
 * its own rather than part of `Streaks` because it is a different question. A
 * card here and a card on a run of zero both have no run, but one has never
 * been asked and the other was asked and failed, which is nearly the opposite
 * thing to know about it.
 *
 * Oldest first: with no review state, when the card was added is the only age
 * it carries, and the ones that have been waiting longest are the point of the
 * page.
 */
const NewCards = () => {
  const { database, profile } = useDatabase();

  const newCards = useMemo(
    () => (database && profile ? readNewCards(database, profile) : null),
    [database, profile],
  );

  // The two are null together — "never reviewed" is asked of one scorefile.
  if (!newCards || !profile) {
    return (
      <Stack gap="md">
        <Title>New cards</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see the cards a profile has never reviewed.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>New cards</Title>

      {newCards.cards.length === 0 ? (
        <Text c="dimmed">{emptyReason(profile)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{newCards.total.toLocaleString()}</b> cards the{" "}
            <b>{profile.name}</b> profile holds but has never reviewed, in its “
            <b>{profile.scorefile?.name}</b>” scorefile.{" "}
            {newCards.total > newCards.cards.length && (
              <>
                The <b>{newCards.cards.length.toLocaleString()}</b> added
                longest ago are listed.{" "}
              </>
            )}
            Longest waiting first. Select a card to see its details. They have
            no review history, so there is no due date to estimate and the time
            until review reads “—”.
          </Text>

          <CardList cards={newCards.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default NewCards;
