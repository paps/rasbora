import { Stack, Text, Title } from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import CardList, {
  type CardColumn,
  type CardListData,
} from "@/components/CardList";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readMostDifficultCards } from "@/pages/MostDifficultCards.db";

const COLUMNS: CardColumn<CardListData>[] = [
  {
    key: "incorrect",
    header: "Failed",
    cell: (card) => card.incorrect.toLocaleString(),
  },
  {
    key: "reviewed",
    header: "Reviewed",
    cell: (card) => card.reviewed.toLocaleString(),
  },
];

/**
 * Why the table has no rows. The three reasons are different questions
 * answered, and saying the wrong one misleads: a profile with no scorefile has
 * no review history at all, a profile that draws from no category reviews
 * nothing however much its scorefile holds, and only then does an empty list
 * mean the profile's cards have genuinely never been failed.
 */
const emptyReason = (profile: Profile): ReactNode => {
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
      <>
        The {name} profile draws from no category, so it puts no card in front
        of you to fail.
      </>
    );
  }

  return <>No card has ever failed a review in the {name} profile.</>;
};

const MostDifficultCards = () => {
  const { database, profile } = useDatabase();

  const difficult = useMemo(
    () =>
      database && profile ? readMostDifficultCards(database, profile) : null,
    [database, profile],
  );

  // The two are null together — difficulty is asked of one profile.
  if (!difficult || !profile) {
    return (
      <Stack gap="lg">
        <Title>Most difficult cards</Title>
        <Text c="dimmed">
          Import a set of flashcards to see the cards a profile fails most.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title>Most difficult cards</Title>

      {difficult.cards.length === 0 ? (
        <Text c="dimmed">{emptyReason(profile)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            The <b>{difficult.cards.length.toLocaleString()}</b> cards the{" "}
            <b>{profile.name}</b> profile failed most often, counting incorrect
            reviews in its “<b>{profile.scorefile?.name}</b>” scorefile only.
            Select a card to see its details.
          </Text>

          <CardList
            cards={difficult.cards}
            columns={COLUMNS}
            scoreRange={difficult.scoreRange}
          />
        </>
      )}
    </Stack>
  );
};

export default MostDifficultCards;
