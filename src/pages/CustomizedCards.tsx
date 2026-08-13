import { Stack, Text, Title } from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import CardList, { type CardColumn } from "@/components/CardList";
import type { FlashcardData } from "@/components/Flashcard";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readCustomizedCards } from "@/pages/CustomizedCards.db";

const COLUMNS: CardColumn<FlashcardData>[] = [
  {
    key: "defn",
    header: "Definition",
    align: "left",
    cell: (card) => (
      // Two lines at most: these run to paragraphs with embedded newlines, and
      // one row of the table is a place to recognise a card rather than to
      // read it. The drawer shows the definition whole.
      <Text size="sm" lineClamp={2} style={{ whiteSpace: "pre-line" }}>
        {card.defn}
      </Text>
    ),
  },
  {
    key: "lastReviewed",
    header: "Last reviewed",
    align: "left",
    cell: (card) => <RelativeTime seconds={card.lastReviewed} />,
  },
];

/** Why the table has no rows; see `LearnedCards.tsx` for why this is spelled out. */
const emptyReason = (profile: Profile): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.categoryIds.length === 0) {
    return <>The {name} profile draws from no category, so it holds no card.</>;
  }

  return (
    <>
      No card the {name} profile draws from has a definition of your own. Pleco
      leaves the field empty on a card that points at its own dictionary, which
      is nearly all of them.
    </>
  );
};

/**
 * The cards carrying a definition the user wrote. Unlike the other card lists
 * this one is about the card rather than the review state, so a card the
 * profile has never shown still belongs here — it is only the review columns
 * that go missing.
 */
const CustomizedCards = () => {
  const { database, profile } = useDatabase();

  const customized = useMemo(
    () => (database && profile ? readCustomizedCards(database, profile) : null),
    [database, profile],
  );

  // The two are null together: the list is scoped to the profile's cards.
  if (!customized || !profile) {
    return (
      <Stack gap="lg">
        <Title>Customized cards</Title>
        <Text c="dimmed">
          Import a set of flashcards to see the cards you have written a
          definition on.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title>Customized cards</Title>

      {customized.cards.length === 0 ? (
        <Text c="dimmed">{emptyReason(profile)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{customized.total.toLocaleString()}</b> of the{" "}
            <b>{profile.name}</b> profile’s cards carry a definition you wrote
            yourself — the only meaning the export itself holds, since Pleco
            leaves the field empty on a card that points at its own dictionary.{" "}
            {customized.total > customized.cards.length && (
              <>
                The <b>{customized.cards.length.toLocaleString()}</b> longest
                unseen are listed.{" "}
              </>
            )}
            Least recently reviewed first, falling back to when the card was
            last edited. Select a card to see its details.
          </Text>

          <CardList cards={customized.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default CustomizedCards;
