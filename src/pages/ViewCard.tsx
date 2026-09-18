import {
  Alert,
  Anchor,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import Flashcard from "@/components/Flashcard";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { VIEW_CARD_LIMIT, searchCards } from "@/pages/ViewCard.db";

/**
 * How long the reader has to stop typing before the export is searched.
 *
 * The other page with a control on it, `Lapses`, re-filters rows it
 * already holds and needs no such thing. This one runs two full scans of the
 * cards table — there is no index that survives `lower()` and a dozen
 * `replace()` calls — which is ~60 ms over 18,000 cards natively and more under
 * WebAssembly. Long enough that a keystroke should not start one, short enough
 * that a reader who has finished typing does not notice.
 */
const SEARCH_DELAY = 250;

/**
 * Looking one card up and reading it whole.
 *
 * Every other card page answers "which cards?" and renders `CardList` for it:
 * a table, because the question is about a set and a row is enough to compare
 * one member against another. This page asks the opposite question — "that one,
 * what does it say?" — so there is no table. Each hit is the same `Flashcard`
 * the drawer opens, which is the point: a card looks the same wherever it is
 * shown, and here it is shown without having to find it in a list first.
 *
 * That is also why the results are capped at three rather than paged. The
 * display is tall — a card with a few hundred reviews is a few hundred bars —
 * so a fourth result would push the first one off the screen, and a reader
 * scrolling past three whole cards is reading a list, which is what the other
 * pages are for. A search that matches more says so at the top and asks for a
 * narrower one, because a silently truncated answer reads as a complete one.
 */
/**
 * Why a search came back with nothing; see `LearnedCards.tsx` for why this is
 * spelled out rather than left as one sentence. The two cases are different
 * advice: a profile drawing from no category has nothing to find whatever is
 * typed, while one that does may simply not hold this card — the export can,
 * since the search never leaves the profile's categories.
 */
const emptyReason = (profile: Profile, search: string): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.categoryIds.length === 0) {
    return <>The {name} profile draws from no category, so it holds no card.</>;
  }

  return (
    <>
      No card the {name} profile draws from matches “{search}”. It may be in a
      category this profile does not load.
    </>
  );
};

const ViewCard = () => {
  const { database, profile } = useDatabase();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, SEARCH_DELAY);

  const found = useMemo(
    () =>
      database && profile ? searchCards(database, profile, debounced) : null,
    [database, profile, debounced],
  );

  // The two are null together: the search is scoped to the profile's cards.
  if (!found || !profile) {
    return (
      <Stack gap="md">
        <Title>View a card</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to look a card up.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md" maw={760}>
      <Title>View a card</Title>

      <Text size="sm" c="dimmed">
        Search the <b>{profile.name}</b> profile’s cards by headword in either
        script (<b>學</b> or <b>学</b>), by reading with or without tones (
        <b>xue</b>, <b>xué</b>, <b>xue2</b>), or by card number. Up to{" "}
        {VIEW_CARD_LIMIT} cards are shown in full.
      </Text>

      <TextInput
        label="Headword, pinyin or card number"
        placeholder="學, xue2, 11770"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
        }}
      />

      {/*
        Above the results rather than in place of them, and stating the count:
        a reader who searched `shi` needs to know that the three cards below are
        three of many before reading them as the answer.
      */}
      {found.total > found.cards.length && (
        <Alert color="yellow" title="More cards match than are shown">
          <b>{found.total.toLocaleString()}</b> cards match “{debounced.trim()}
          ”, and only the closest {VIEW_CARD_LIMIT} are below. Add the rest of
          the word, a tone, or the card number to narrow it down.
        </Alert>
      )}

      {debounced.trim() !== "" && found.total === 0 && (
        <Text c="dimmed">{emptyReason(profile, debounced.trim())}</Text>
      )}

      {found.cards.map((card) => (
        <Paper key={card.id} withBorder p="lg">
          <Flashcard card={card} />
        </Paper>
      ))}
    </Stack>
  );
};

export default ViewCard;
