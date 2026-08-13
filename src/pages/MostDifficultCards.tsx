import {
  Drawer,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import Flashcard, { type FlashcardData } from "@/components/Flashcard";
import { splitHeadword } from "@/components/chinese";
import { useDatabase } from "@/database/context";
import { readMostDifficultCards } from "@/pages/MostDifficultCards.db";

/** Rows per page. The full list is at most 1000, so paging is done in memory. */
const PAGE_SIZE = 25;

const MostDifficultCards = () => {
  const { database } = useDatabase();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FlashcardData | null>(null);

  const cards = useMemo(
    () => (database ? readMostDifficultCards(database) : null),
    [database],
  );

  if (!cards) {
    return (
      <Stack gap="lg">
        <Title>Most difficult cards</Title>
        <Text c="dimmed">
          Import a Pleco export to see the most difficult cards.
        </Text>
      </Stack>
    );
  }

  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  // The list only shrinks if a smaller export is loaded; clamp rather than
  // reset so a stale page number never shows an empty table.
  const activePage = Math.min(page, pageCount);
  const start = (activePage - 1) * PAGE_SIZE;
  const visible = cards.slice(start, start + PAGE_SIZE);

  return (
    <Stack gap="lg">
      <Title>Most difficult cards</Title>

      {cards.length === 0 ? (
        <Text c="dimmed">No card has ever failed a review in this export.</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            The {cards.length.toLocaleString()} cards failed most often,
            counting every incorrect review across all scorefiles. Select a card
            to see its details.
          </Text>

          <Table highlightOnHover withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>#</Table.Th>
                <Table.Th>Headword</Table.Th>
                <Table.Th>Pinyin</Table.Th>
                <Table.Th ta="right">Failed</Table.Th>
                <Table.Th ta="right">Reviewed</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((card, index) => {
                const syllables = splitHeadword(card.hw, card.althw, card.pron);

                return (
                  <Table.Tr
                    key={card.id}
                    onClick={() => {
                      setSelected(card);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{start + index + 1}</Table.Td>
                    <Table.Td>
                      {syllables
                        .map((syllable) => syllable.simplified)
                        .join("")}
                    </Table.Td>
                    <Table.Td>
                      {syllables.map((syllable) => syllable.pinyin).join(" ")}
                    </Table.Td>
                    <Table.Td ta="right">
                      {card.incorrect.toLocaleString()}
                    </Table.Td>
                    <Table.Td ta="right">
                      {card.reviewed.toLocaleString()}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          {pageCount > 1 && (
            <Group justify="center">
              <Pagination
                total={pageCount}
                value={activePage}
                onChange={setPage}
              />
            </Group>
          )}
        </>
      )}

      <Drawer
        opened={selected !== null}
        onClose={() => {
          setSelected(null);
        }}
        position="right"
        title="Card details"
        padding="lg"
      >
        {selected && <Flashcard card={selected} />}
      </Drawer>
    </Stack>
  );
};

export default MostDifficultCards;
