import { Box, Drawer, Group, Pagination, Table, Tooltip } from "@mantine/core";
import { useState, type ReactNode } from "react";
import Flashcard, { type FlashcardData } from "@/components/Flashcard";
import { splitHeadword } from "@/components/chinese";
import type { ScoreRange } from "@/database/plecoFile";
import { useScript } from "@/script/context";

/** Rows per page. Lists are capped in the hundreds, so paging is in memory. */
const PAGE_SIZE = 25;

/**
 * A card in a list: everything the drawer shows, plus the score the row draws
 * a bar for. `FlashcardData` leaves `score` out because the number means
 * nothing without the bounds it moves between — which is exactly why the bar
 * is drawn here, where the profile's `ScoreRange` is in hand, and not there.
 */
export interface CardListData extends FlashcardData {
  /**
   * The card's score in the profile's scorefile, or null when that scorefile
   * holds no row for it — a card the profile has never put in front of anyone.
   */
  score: number | null;
}

/** A column a page adds after the headword, pinyin and score. */
export interface CardColumn<T extends CardListData> {
  /** Identifies the column to React; nothing shows it. */
  key: string;
  header: ReactNode;
  cell: (card: T) => ReactNode;
  /** Right for a number, which is what most of these are. */
  align?: "left" | "right";
}

interface CardListProps<T extends CardListData> {
  /** The cards, already in the order the page wants them read. */
  cards: T[];
  /** What each page has to say about a card beyond its headword. */
  columns: CardColumn<T>[];
  /**
   * The bounds the bars are drawn against. Null drops the score column
   * entirely: a bar with no scale behind it is a decoration.
   */
  scoreRange: ScoreRange | null;
}

/**
 * The ramp the bar is filled with, lowest score first.
 *
 * It was checked rather than picked by eye, and what the checking found is
 * worth keeping in mind before touching it: **the colour is the redundant
 * channel here, not the primary one.** Simulated against the three dichromacy
 * types, the two _ends_ of any red→green ramp in Mantine's palette come out at
 * ΔE 9 under deuteranopia — a red bar and a green bar look nearly alike — so
 * the length of the bar is what actually carries "how well known", with the
 * exact score a hover away. That is the same arrangement as the flashcard's
 * grade bars, and for the same reason.
 *
 * Within that, these four stops are the best of the ramps measured: yellow is
 * left out because it collapses into lime at ΔE 2.3 under protanopia, and
 * every stop clears 2.4:1 against the white row it sits on. Re-measure if you
 * change one.
 */
const SCORE_COLORS = ["red.8", "orange.6", "lime.7", "green.9"];

/** How wide the bar's track is, and the fill's floor so a low score shows. */
const BAR_WIDTH = 72;
const BAR_HEIGHT = 8;
const BAR_FLOOR = 6;

interface ScoreBarProps {
  score: number;
  range: ScoreRange;
}

/**
 * One card's score, as a bar filling a track between the profile's minimum and
 * its maximum.
 *
 * The scale is **doublings, not the raw number**: Pleco spaces reviews by
 * doubling the score, so 100 → 200 is the same step forward as 25,600 →
 * 51,200, and a linear bar would leave two thirds of a real deck bunched in
 * its top quarter with nothing to tell those cards apart. Nine doublings span
 * the usual 100–51,200, and a card at the ceiling fills the track — which is
 * what the learned list is, a column of full bars.
 */
const ScoreBar = ({ score, range }: ScoreBarProps) => {
  const doublings = Math.log2(range.max / range.min);
  const fraction = Math.min(
    1,
    Math.max(0, Math.log2(Math.max(score, range.min) / range.min) / doublings),
  );
  const color =
    SCORE_COLORS[
      Math.min(
        SCORE_COLORS.length - 1,
        Math.floor(fraction * SCORE_COLORS.length),
      )
    ];

  return (
    <Tooltip
      label={
        score >= range.max
          ? `Score ${score.toLocaleString()} — the profile’s maximum`
          : `Score ${score.toLocaleString()}, between the profile’s ${range.min.toLocaleString()} and ${range.max.toLocaleString()}`
      }
      withArrow
      openDelay={200}
      // Above rather than beside: the row's own numbers are to the right of
      // the bar, and a bubble there would cover the thing being compared.
      position="top-start"
    >
      <Box w={BAR_WIDTH} h={BAR_HEIGHT} bg="gray.2" style={{ borderRadius: 2 }}>
        <Box
          w={BAR_FLOOR + fraction * (BAR_WIDTH - BAR_FLOOR)}
          h="100%"
          bg={color}
          style={{ borderRadius: 2 }}
        />
      </Box>
    </Tooltip>
  );
};

/**
 * A list of cards that opens one in a drawer: the position, the headword in
 * the chosen script, its pinyin, then whatever columns the page adds.
 *
 * Every page that answers "which cards?" renders this, so that a card list
 * looks and behaves the same wherever the question came from — the same
 * ordering of the first columns, the same page size, and the same `Flashcard`
 * behind a click. The pages differ in the question, which is the SQL and the
 * sentence above the table, not in the table.
 *
 * The rows are the caller's, so the number the page shows is the number here;
 * capping a long list is the page's job, and the page says so in its caption.
 *
 * The score sits in the same place on every page — right after the pinyin,
 * before the page's own columns — because it is the one thing every list can
 * say about a card, and a reader moving between pages should not have to find
 * it again.
 */
const CardList = <T extends CardListData>({
  cards,
  columns,
  scoreRange,
}: CardListProps<T>) => {
  const { script } = useScript();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // The open card is looked up in the current list rather than kept in state,
  // so switching profile can never leave the drawer showing tallies read from
  // the scorefile of the profile before it.
  const selected = cards.find((card) => card.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  // The list shrinks whenever the profile, the export or a page control
  // changes; clamp rather than reset so a stale page number never shows an
  // empty table.
  const activePage = Math.min(page, pageCount);
  const start = (activePage - 1) * PAGE_SIZE;
  const visible = cards.slice(start, start + PAGE_SIZE);

  return (
    <>
      <Table highlightOnHover withTableBorder verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={60}>#</Table.Th>
            <Table.Th>Headword</Table.Th>
            <Table.Th>Pinyin</Table.Th>
            {scoreRange !== null && <Table.Th w={90}>Score</Table.Th>}
            {columns.map((column) => (
              <Table.Th key={column.key} ta={column.align ?? "right"}>
                {column.header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visible.map((card, index) => {
            const syllables = splitHeadword(card.hw, card.althw, card.pron);

            return (
              <Table.Tr
                key={card.id}
                onClick={() => {
                  setSelectedId(card.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <Table.Td>{start + index + 1}</Table.Td>
                <Table.Td>
                  {syllables.map((syllable) => syllable[script]).join("")}
                </Table.Td>
                <Table.Td>
                  {syllables.map((syllable) => syllable.pinyin).join(" ")}
                </Table.Td>
                {scoreRange !== null && (
                  <Table.Td>
                    {card.score === null ? (
                      // Never reviewed under this profile, so there is no score
                      // to draw — an empty track would read as a score of zero.
                      "—"
                    ) : (
                      <ScoreBar score={card.score} range={scoreRange} />
                    )}
                  </Table.Td>
                )}
                {columns.map((column) => (
                  <Table.Td key={column.key} ta={column.align ?? "right"}>
                    {column.cell(card)}
                  </Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {pageCount > 1 && (
        <Group justify="center">
          <Pagination total={pageCount} value={activePage} onChange={setPage} />
        </Group>
      )}

      <Drawer
        opened={selected !== null}
        onClose={() => {
          setSelectedId(null);
        }}
        position="right"
        title="Card details"
        padding="lg"
      >
        {selected && <Flashcard card={selected} />}
      </Drawer>
    </>
  );
};

export default CardList;
