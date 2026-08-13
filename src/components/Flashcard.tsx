import { Badge, Group, List, Stack, Text } from "@mantine/core";
import { splitHeadword } from "@/components/chinese";
import { useDictionary } from "@/dictionary/context";
import { otherScript, useScript } from "@/script/context";

/**
 * Everything the card display needs: the vocabulary item plus its review
 * tallies, read from whichever scorefile the caller's profile points at.
 * `score` and `difficulty` are deliberately absent — a page that wants to show
 * them can widen this contract, but they only mean anything alongside the
 * profile settings that bound them.
 */
export interface FlashcardData {
  id: number;
  /** Simplified headword, `@`-separated by syllable. */
  hw: string;
  /** Traditional headword, `@`-separated; may equal `hw`. */
  althw: string;
  /** Numbered pinyin, `@`-separated. */
  pron: string;
  /** User-written note, or the empty string — most cards have none. */
  defn: string;
  /** Times the card has been reviewed. */
  reviewed: number;
  /** Reviews answered correctly. */
  correct: number;
  /** Reviews answered incorrectly. */
  incorrect: number;
}

interface FlashcardProps {
  card: FlashcardData;
}

/**
 * The app's single card display: the headword shown per syllable in the chosen
 * script with its pinyin, the other script below when it differs, any note, and
 * the review tally. Anything that lists cards opens this to show one, so it
 * takes a plain `FlashcardData` and renders.
 *
 * It reads two things for itself. The app-wide script — threading that in as a
 * prop would let a page forget it and show a card in the script the rest of the
 * app is not using, the inconsistency a global preference exists to prevent.
 * And the bundled dictionary: the export carries the user's own note but almost
 * never a meaning, so the CC-CEDICT gloss is looked up here and shown below the
 * note when there is one. Both are reads; it still holds no state.
 */
const Flashcard = ({ card }: FlashcardProps) => {
  const { script } = useScript();
  const { lookup } = useDictionary();
  const other = otherScript(script);
  const entry = lookup(card.hw, card.althw, card.pron);
  // Position-prefixed so repeated syllables (妈妈, 谢谢) stay distinct keys.
  // Keyed on the simplified form whatever is displayed, so that switching
  // script re-renders the syllables it already has rather than replacing them.
  const syllables = splitHeadword(card.hw, card.althw, card.pron).map(
    (syllable, position) => ({
      ...syllable,
      key: `${String(position)}-${syllable.simplified}`,
    }),
  );
  const hasVariant = syllables.some(
    (syllable) => syllable.simplified !== syllable.traditional,
  );
  const accuracy =
    card.reviewed > 0 ? Math.round((card.correct / card.reviewed) * 100) : null;

  return (
    <Stack gap="lg">
      <Group gap="lg" align="flex-start">
        {syllables.map((syllable) => (
          <Stack key={syllable.key} gap={4} align="center">
            <Text size="sm" c="dimmed">
              {syllable.pinyin}
            </Text>
            <Text fz={44} fw={500} lh={1}>
              {syllable[script]}
            </Text>
            {hasVariant && (
              <Text fz={20} c="dimmed">
                {syllable[script] === syllable[other] ? " " : syllable[other]}
              </Text>
            )}
          </Stack>
        ))}
      </Group>

      {card.defn && (
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Your note
          </Text>
          <Text style={{ whiteSpace: "pre-line" }}>{card.defn}</Text>
        </Stack>
      )}

      {/*
        The gloss comes from CC-CEDICT (CC BY-SA 4.0), which the app is obliged
        to credit where it shows the data. `entry` is null while the dictionary
        is still loading or when it has no headword for this card — both show
        nothing rather than an error, since the note above already stands on its
        own.
      */}
      {entry && (
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Dictionary
          </Text>
          <List size="sm" spacing={2}>
            {entry.senses.map((sense, index) => (
              <List.Item key={`${String(index)}-${sense}`}>{sense}</List.Item>
            ))}
          </List>
          <Text size="xs" c="dimmed">
            CC-CEDICT · CC BY-SA 4.0
          </Text>
        </Stack>
      )}

      <Group gap="xs">
        <Badge color="red" variant="light">
          {card.incorrect.toLocaleString()} failed
        </Badge>
        <Badge color="gray" variant="light">
          {card.reviewed.toLocaleString()} reviewed
        </Badge>
        {accuracy !== null && (
          <Badge color="green" variant="light">
            {accuracy}% correct
          </Badge>
        )}
      </Group>
    </Stack>
  );
};

export default Flashcard;
