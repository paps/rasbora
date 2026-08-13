import { Badge, Group, Stack, Text } from "@mantine/core";
import { splitHeadword } from "@/components/chinese";

/**
 * Everything the card display needs. It is deliberately the vocabulary item
 * plus its review tallies summed across scorefiles — the three counts add up
 * cleanly, whereas `score` and `difficulty` are on a per-profile scale that
 * cannot be aggregated meaningfully. A page that has one scorefile in view can
 * grow this contract later; today's callers do not.
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
 * The app's single card display: the headword shown per syllable with its
 * pinyin, the traditional form when it differs, any note, and the review
 * tally. Anything that lists cards opens this to show one, so it takes a plain
 * `FlashcardData` and renders — it reads nothing and owns no state.
 */
const Flashcard = ({ card }: FlashcardProps) => {
  // Position-prefixed so repeated syllables (妈妈, 谢谢) stay distinct keys.
  const syllables = splitHeadword(card.hw, card.althw, card.pron).map(
    (syllable, position) => ({
      ...syllable,
      key: `${String(position)}-${syllable.simplified}`,
    }),
  );
  const hasTraditional = syllables.some(
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
              {syllable.simplified}
            </Text>
            {hasTraditional && (
              <Text fz={20} c="dimmed">
                {syllable.simplified === syllable.traditional
                  ? " "
                  : syllable.traditional}
              </Text>
            )}
          </Stack>
        ))}
      </Group>

      {card.defn && <Text style={{ whiteSpace: "pre-line" }}>{card.defn}</Text>}

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
