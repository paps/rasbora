import {
  Badge,
  Box,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { splitHeadword } from "@/components/chinese";
import { otherScript, useScript } from "@/script/context";

/**
 * Everything the card display needs: the vocabulary item plus its review
 * history, read from whichever scorefile the caller's profile points at.
 * `score` and `difficulty` are deliberately absent — a page that wants to show
 * them can widen this contract, but they only mean anything alongside the
 * profile settings that bound them.
 *
 * The timestamps split the same way the display does: `created` and `modified`
 * belong to the card and read the same under every profile, while the four
 * review times and the history are the profile's alone.
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
  /** When the card was added, in Unix seconds, or null if never recorded. */
  created: number | null;
  /** When the card itself was last edited, in Unix seconds. */
  modified: number | null;
  /** Times the card has been reviewed. */
  reviewed: number;
  /** Reviews answered correctly. */
  correct: number;
  /** Reviews answered incorrectly. */
  incorrect: number;
  /**
   * One digit per review, **newest first** — the order Pleco stores it in, and
   * the order the strip reads down the page. Empty when the export logged none.
   */
  history: string;
  firstReviewed: number | null;
  lastReviewed: number | null;
  /** When the score last went up, in Unix seconds. */
  scoreIncreased: number | null;
  /** When the score last went down, in Unix seconds. */
  scoreDecreased: number | null;
}

interface FlashcardProps {
  card: FlashcardData;
}

interface Grade {
  /** How Pleco names this answer to the reader. */
  label: string;
  /** Which of the card's two tallies the answer feeds. */
  outcome: "correct" | "incorrect" | null;
  color: string;
  /** 1–6 on the scale, which is also the bar's length in steps. */
  step: number;
}

/**
 * Pleco's six-point self-grading scale, one entry per digit of `history`. The
 * middle of it is where a tally hides detail: `2` is what a plain wrong answer
 * records and `6` what a plain right one records — hence "(default)" on those
 * two labels — so the four graded values only appear when the user reached for
 * them.
 *
 * The shades were checked rather than picked by eye. Lightness runs outwards
 * from the middle of the scale, so the ordering survives as ordering even
 * without hue, and the boundary that matters — "almost remembered" against
 * "barely remembered", where a card flips from wrong to right — stays apart by
 * ΔE 39 under simulated protanopia, the worst of the three simulations, and
 * further under deuteranopia and tritanopia. Re-check it if you change a shade.
 *
 * Colour is not carrying this alone in any case: the bars are as long as the
 * grade, every bar names its grade on hover, and the legend counts them.
 */
const GRADES = new Map<string, Grade>([
  ["1", { label: "don’t know", outcome: "incorrect", color: "red.9", step: 1 }],
  [
    "2",
    {
      label: "forgotten (default)",
      outcome: "incorrect",
      color: "red.6",
      step: 2,
    },
  ],
  [
    "3",
    {
      label: "almost remembered",
      outcome: "incorrect",
      color: "red.4",
      step: 3,
    },
  ],
  [
    "4",
    {
      label: "barely remembered",
      outcome: "correct",
      color: "green.4",
      step: 4,
    },
  ],
  ["5", { label: "remembered", outcome: "correct", color: "green.6", step: 5 }],
  [
    "6",
    {
      label: "remembered (default)",
      outcome: "correct",
      color: "green.9",
      step: 6,
    },
  ],
]);

/**
 * Anything else in the log. No export seen so far holds a digit outside 1–6,
 * so this exists to keep a corrupt or newer file readable rather than to
 * describe something real.
 */
const UNRECOGNISED: Grade = {
  label: "unrecognised",
  outcome: null,
  color: "gray.5",
  step: 1,
};

const BAR_HEIGHT = 10;
/** Width per point of the scale, on top of a floor that keeps a 1 visible. */
const BAR_STEP = 14;
const BAR_FLOOR = 8;
const BAR_WIDTH = BAR_FLOOR + 6 * BAR_STEP;
const BAR_GAP = 3;
/**
 * Enough room for the arrow to read as an arrow, and for the duration written
 * along it to fit, on a card with only a handful of reviews to stack up.
 */
const TIMELINE_MIN_HEIGHT = 160;

interface GradeBarProps {
  grade: Grade;
  /** The tooltip, which is the only place a single review is named. */
  label: string;
}

/**
 * One review, as a bar as long as the grade it was given. The bar sits in a
 * box of the full width so that every review occupies the same row and the
 * strip keeps one left edge to compare lengths against.
 */
const GradeBar = ({ grade, label }: GradeBarProps) => (
  <Tooltip label={label} withArrow openDelay={200} position="right">
    <Box w={BAR_WIDTH} h={BAR_HEIGHT}>
      <Box
        w={BAR_FLOOR + grade.step * BAR_STEP}
        h="100%"
        bg={grade.color}
        style={{ borderRadius: "var(--mantine-radius-xs)" }}
      />
    </Box>
  </Tooltip>
);

/**
 * The units the span between the first and last review is rounded to, largest
 * first. These are `RelativeTime`'s thresholds, deliberately duplicated: that
 * file exports a component, and exporting a helper beside it would fail
 * `react-refresh/only-export-components`.
 */
const DURATION_UNITS: { unit: string; seconds: number }[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

/**
 * How long the card has been in review, in the coarsest unit that fits, or
 * null when the two reviews are less than a minute apart — which is what a
 * card reviewed once reads as, and there is no span to write there.
 */
const formatDuration = (seconds: number): string | null => {
  const unit = DURATION_UNITS.find((candidate) => seconds >= candidate.seconds);

  if (unit === undefined) {
    return null;
  }

  const count = Math.round(seconds / unit.seconds);

  return `${count.toLocaleString()} ${unit.unit}${count === 1 ? "" : "s"}`;
};

interface TimelineArrowProps {
  /** Written along the arrow, or null when there is no span to write. */
  duration: string | null;
}

/**
 * The line the strip is read against: an arrow running up towards the newest
 * review, with the span it covers written along it. The label sits between two
 * flexing segments rather than on top of one, so the line is broken by the
 * text the way an axis label breaks an axis and never shows through it.
 */
const TimelineArrow = ({ duration }: TimelineArrowProps) => (
  <Stack gap={4} align="center" w={20} style={{ flexShrink: 0 }}>
    <Text size="xs" c="dimmed" lh={1}>
      ▲
    </Text>
    <Box w={2} bg="gray.4" style={{ flexGrow: 1 }} />
    {duration !== null && (
      // Rotated so it reads bottom to top, the direction the arrow runs in.
      <Text
        size="xs"
        c="dimmed"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {duration} in review
      </Text>
    )}
    <Box w={2} bg="gray.4" style={{ flexGrow: 1 }} />
  </Stack>
);

interface ReviewHistoryProps {
  history: string;
  firstReviewed: number | null;
  lastReviewed: number | null;
}

/**
 * The review log as one bar per review, newest at the top, each as long as the
 * grade the user gave themselves. It runs down the page rather than across so
 * that a card with hundreds of reviews grows downwards, where there is room,
 * instead of wrapping into a block whose rows have no meaning.
 *
 * The two dates cap the strip and the arrow between them carries the span, so
 * the reader gets when the card was last seen, when it was first seen and how
 * long it has been in review without leaving the timeline. They cap the arrow
 * rather than the bars: a short log leaves the arrow taller than its stack of
 * bars, and it is the arrow that the dates are the ends of.
 *
 * The legend counts each grade, which makes it a summary of the card as well
 * as a key: a card answered "barely remembered" thirty times is a different
 * card from one answered "perfectly" thirty times, and the correct/incorrect
 * tally above cannot tell them apart.
 *
 * There is no date on any single review: the export keeps four timestamps for
 * the whole card and nothing per review, so the bars show the sequence only.
 */
const ReviewHistory = ({
  history,
  firstReviewed,
  lastReviewed,
}: ReviewHistoryProps) => {
  const total = history.length;
  // Pleco stores the log newest first, which is the order it is read in here,
  // so review 1 — the oldest — is the last one out. Indexing the string is
  // safe where splitting it would not be: every character Pleco writes is a
  // digit.
  const reviews = Array.from({ length: total }, (_, index) => {
    const digit = history[index] ?? "";

    return {
      // The position in the strip *is* the identity of a review here: the list
      // is fixed for a card and nothing is ever inserted into it.
      key: String(index),
      number: total - index,
      digit,
      grade: GRADES.get(digit) ?? UNRECOGNISED,
    };
  });
  const duration =
    firstReviewed === null || lastReviewed === null
      ? null
      : formatDuration(lastReviewed - firstReviewed);
  const countOf = (digit: string) =>
    reviews.filter((review) => review.digit === digit).length;
  const unrecognised = reviews.filter(
    (review) => review.grade === UNRECOGNISED,
  ).length;
  const legend = [...GRADES.entries()].map(([digit, grade]) => ({
    key: digit,
    grade,
    count: countOf(digit),
  }));

  if (unrecognised > 0) {
    legend.push({
      key: "unrecognised",
      grade: UNRECOGNISED,
      count: unrecognised,
    });
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {total.toLocaleString()} reviews
      </Text>

      {lastReviewed !== null && (
        <Text size="xs" c="dimmed">
          Last reviewed <RelativeTime seconds={lastReviewed} />
        </Text>
      )}

      <Group
        gap="xs"
        align="stretch"
        wrap="nowrap"
        // Only claimed when there is a duration to write down the arrow: a
        // card whose reviews the export never dated has nothing to hold open.
        mih={duration === null ? undefined : TIMELINE_MIN_HEIGHT}
      >
        <TimelineArrow duration={duration} />
        <Stack gap={BAR_GAP}>
          {reviews.map((review) => (
            <GradeBar
              key={review.key}
              grade={review.grade}
              label={`Review ${review.number.toLocaleString()} of ${total.toLocaleString()} — ${review.grade.label}${
                review.grade.outcome === null
                  ? ""
                  : ` (${review.grade.outcome})`
              }`}
            />
          ))}
        </Stack>
      </Group>

      {firstReviewed !== null && (
        <Text size="xs" c="dimmed">
          First reviewed <RelativeTime seconds={firstReviewed} />
        </Text>
      )}

      <Text size="xs" c="dimmed">
        Newest first — the top bar is the most recent review, and the longer the
        bar the better it went. Pleco records no date for an individual review,
        only the sequence.
      </Text>

      <SimpleGrid cols={2} spacing="xs" verticalSpacing={6}>
        {legend.map((entry) => (
          <Group key={entry.key} gap={6} wrap="nowrap">
            <Box
              w={10}
              h={10}
              bg={entry.grade.color}
              style={{
                borderRadius: "var(--mantine-radius-xs)",
                flexShrink: 0,
              }}
            />
            <Text size="xs" c="dimmed">
              {entry.grade.label}
            </Text>
            <Text size="xs" fw={600} ml="auto">
              {entry.count.toLocaleString()}
            </Text>
          </Group>
        ))}
      </SimpleGrid>
    </Stack>
  );
};

interface DateRow {
  label: string;
  value: number | null;
  /** Shown on hover, for a label that would otherwise mislead. */
  info?: string;
}

interface DateTableProps {
  rows: DateRow[];
}

const DateTable = ({ rows }: DateTableProps) => (
  <Table verticalSpacing={4} fz="sm" withRowBorders={false}>
    <Table.Tbody>
      {rows.map((row) => (
        <Table.Tr key={row.label}>
          <Table.Td w="45%" c="dimmed">
            {row.info === undefined ? (
              row.label
            ) : (
              <Explained info={row.info}>{row.label}</Explained>
            )}
          </Table.Td>
          <Table.Td>
            <RelativeTime seconds={row.value} />
          </Table.Td>
        </Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
);

/**
 * The app's single card display: the headword shown per syllable in the chosen
 * script with its pinyin, the other script below when it differs, any note, the
 * review tally and log, and the dates the export holds. Anything that lists
 * cards opens this to show one, so it takes a plain `FlashcardData` and
 * renders.
 *
 * The dates are grouped the way the data is scoped, because mixing them would
 * be a lie: the score times come from one profile's scorefile and the same
 * card shows different ones under another profile, while the card's own
 * created and modified times are the whole export's. The first and last review
 * are profile-scoped too, and are shown on the history timeline instead, where
 * they are the ends of something rather than two more rows.
 *
 * The one thing it reads for itself is the app-wide script. Threading that in
 * as a prop would let a page forget it and show a card in the script the rest
 * of the app is not using, which is exactly the inconsistency a global
 * preference exists to prevent. It still holds no state.
 */
const Flashcard = ({ card }: FlashcardProps) => {
  const { script } = useScript();
  const other = otherScript(script);
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
                {syllable[script] === syllable[other] ? " " : syllable[other]}
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

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          In this profile
        </Text>
        <DateTable
          rows={[
            { label: "Score last rose", value: card.scoreIncreased },
            {
              label: "Score last fell",
              value: card.scoreDecreased,
              info: "Not always a failure: once a card is at the top of the profile’s score range, Pleco logs even a correct answer here, because the score had nowhere left to rise.",
            },
          ]}
        />
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          This card
        </Text>
        <DateTable
          rows={[
            { label: "Added", value: card.created },
            { label: "Last edited", value: card.modified },
          ]}
        />
      </Stack>

      {/*
        Last, because it is the one section with no fixed height: a card with
        hundreds of reviews stacks them downwards from here rather than pushing
        the dates it belongs beside off the screen.
      */}
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Review history in this profile
        </Text>
        {card.history === "" ? (
          <Text size="sm" c="dimmed">
            This profile’s scorefile holds no review log for this card.
          </Text>
        ) : (
          <ReviewHistory
            history={card.history}
            firstReviewed={card.firstReviewed}
            lastReviewed={card.lastReviewed}
          />
        )}
      </Stack>
    </Stack>
  );
};

export default Flashcard;
