import { Drawer, Group, Pagination, Table } from "@mantine/core";
import { useState, type ReactNode } from "react";
import Flashcard, { type FlashcardData } from "@/components/Flashcard";
import { splitHeadword } from "@/components/chinese";
import { useScript } from "@/script/context";

/** Rows per page. Lists are capped in the hundreds, so paging is in memory. */
const PAGE_SIZE = 25;

/** A column a page adds after the headword and pinyin. */
export interface CardColumn<T extends FlashcardData> {
  /** Identifies the column to React; nothing shows it. */
  key: string;
  header: ReactNode;
  cell: (card: T) => ReactNode;
  /** Right for a number, which is what most of these are. */
  align?: "left" | "right";
}

interface CardListProps<T extends FlashcardData> {
  /** The cards, already in the order the page wants them read. */
  cards: T[];
  /** What each page has to say about a card beyond its headword. */
  columns: CardColumn<T>[];
}

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
 */
const CardList = <T extends FlashcardData>({
  cards,
  columns,
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
