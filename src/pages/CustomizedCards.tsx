import {
  Anchor,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link, useSearchParams } from "react-router";
import { useMemo, type ReactNode } from "react";
import type { FlashcardData } from "@/components/Flashcard";
import CardList, { type CardColumn } from "@/components/CardList";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import {
  readCustomizedCards,
  type CustomizedCardType,
} from "@/pages/CustomizedCards.db";

const DESCRIPTIONS: Record<CustomizedCardType, string> = {
  content: "have custom content",
  usr: "link to user dictionary (USR) entries without custom content",
  all: "have custom content or link to user dictionary (USR) entries",
};

const COLUMNS: CardColumn<FlashcardData>[] = [
  {
    key: "defn",
    header: "Definition",
    align: "left",
    cell: (card) => (
      // Two lines at most: these run to paragraphs with embedded newlines, and
      // one row of the table is a place to recognise a card rather than to
      // read it. The dialog shows the definition whole.
      <Text size="sm" lineClamp={2} style={{ whiteSpace: "pre-line" }}>
        {card.defn.trim() !== "" ? card.defn : "USR dictionary entry"}
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

/** Why the table has no rows; see `Streaks.tsx` for why this is spelled out. */
const emptyReason = (profile: Profile, type: CustomizedCardType): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.categoryIds.length === 0) {
    return <>The {name} profile draws from no category, so it holds no card.</>;
  }

  return (
    <>
      None of the {name} profile’s cards {DESCRIPTIONS[type]}.
    </>
  );
};

/**
 * The cards with custom content or a USR dictionary link. Unlike the other lists
 * this one is about the card rather than the review state, so a card the
 * profile has never shown still belongs here — it is only the review columns
 * that go missing.
 */
const CustomizedCards = () => {
  const { database, profile } = useDatabase();
  const [params, setParams] = useSearchParams();
  const requestedType = params.get("type");
  const type =
    requestedType === "content" || requestedType === "usr"
      ? requestedType
      : "all";

  const customized = useMemo(
    () =>
      database && profile ? readCustomizedCards(database, profile, type) : null,
    [database, profile, type],
  );

  // The two are null together: the list is scoped to the profile's cards.
  if (!customized || !profile) {
    return (
      <Stack gap="md">
        <Title>Customized cards</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see cards with custom content or user dictionary (USR) links.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Customized cards</Title>

      <Group>
        <SegmentedControl<CustomizedCardType>
          aria-label="Customized card type"
          radius="xl"
          value={type}
          onChange={(value) => {
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                if (value === "all") {
                  next.delete("type");
                } else {
                  next.set("type", value);
                }
                return next;
              },
              { replace: true },
            );
          }}
          data={[
            { value: "all", label: "All" },
            { value: "content", label: "Custom content" },
            { value: "usr", label: "USR entries" },
          ]}
        />
      </Group>

      {customized.cards.length === 0 ? (
        <Text c="dimmed">{emptyReason(profile, type)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            <b>{customized.total.toLocaleString()}</b> of the{" "}
            <b>{profile.name}</b> profile’s cards {DESCRIPTIONS[type]}.{" "}
            {customized.total > customized.cards.length && (
              <>
                The <b>{customized.cards.length.toLocaleString()}</b> longest
                unseen are listed.{" "}
              </>
            )}
            Least recently reviewed first, falling back to when the card was
            last edited. Select a card to see its details.
          </Text>

          <CardList key={type} cards={customized.cards} columns={COLUMNS} />
        </>
      )}
    </Stack>
  );
};

export default CustomizedCards;
