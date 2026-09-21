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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import Flashcard from "@/components/Flashcard";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { SEARCH_CARD_LIMIT, searchCards } from "@/pages/SearchCard.db";

/**
 * How long the reader has to stop typing before the export is searched.
 *
 * It paces the address as well as the query, which is why both settle at the
 * same moment: a reader who has stopped typing gets the cards and a URL worth
 * copying together, and one who is mid-word costs neither a scan nor a history
 * entry.
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
 * The querystring key the search lives in.
 *
 * The search is in the address, for the reasons the `Streaks` range is: what
 * the reader is looking at survives a reload and can be sent to someone. Here
 * that last part is the whole point — an agent reading an export through the
 * bundled skill can answer "which card?" with a link that opens the card,
 * rather than with a word the reader has to retype into this field.
 *
 * Unlike `run` or `days` there is nothing to validate. Those name a bucket
 * that has to exist for a list to be honest; this one is a search, and a
 * search that matches nothing is an answer rather than a broken address. The
 * query layer already trims what it is given and treats the empty string as no
 * search at all, so every value reaching here is one it can be handed.
 *
 * It also differs in which way the value flows, and that is not a preference.
 * `Streaks` reads its controls straight from the address because a stepper
 * emits one value per click; a keyboard does not wait, and a field whose value
 * comes back through the router drops the letters typed before the re-render —
 * `pingchang` arrives as `phang`. So the field holds its own state and the
 * address follows it, one way, from the same debounce the query uses.
 */
const SEARCH_PARAM = "search";

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
 * Why a search came back with nothing; see `Streaks.tsx` for why this is
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

const SearchCard = () => {
  const { database, profile } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get(SEARCH_PARAM) ?? "";
  // The address is read once, for the search a link arrived with. After that
  // the field is the one writing.
  const [search, setSearch] = useState(linked);
  const [debounced] = useDebouncedValue(search, SEARCH_DELAY);

  /**
   * Mirrors the settled search into the address, so the URL a reader copies is
   * the search they are reading.
   *
   * An empty field writes no parameter rather than an empty one, leaving
   * `/card` — the address the sidebar link would have given them. Replaced
   * rather than pushed, as on `Streaks`: a search is one view being adjusted,
   * not a page visited per word, so Back stays one press from wherever the
   * reader came from rather than walking back through what they just typed.
   */
  useEffect(() => {
    if (debounced === linked) return;

    setSearchParams(debounced === "" ? {} : { [SEARCH_PARAM]: debounced }, {
      replace: true,
    });
  }, [debounced, linked, setSearchParams]);

  const found = useMemo(
    () =>
      database && profile ? searchCards(database, profile, debounced) : null,
    [database, profile, debounced],
  );

  // The two are null together: the search is scoped to the profile's cards.
  if (!found || !profile) {
    return (
      <Stack gap="md">
        <Title>Search for a card</Title>
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
      <Title>Search for a card</Title>

      <Text size="sm" c="dimmed">
        Search the <b>{profile.name}</b> profile’s cards by headword in either
        script (<b>學</b> or <b>学</b>), by reading with or without tones (
        <b>xue</b>, <b>xué</b>, <b>xue2</b>), or by card number. Up to{" "}
        {SEARCH_CARD_LIMIT} cards are shown in full.
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
          ”, and only the closest {SEARCH_CARD_LIMIT} are below. Add the rest of
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

export default SearchCard;
