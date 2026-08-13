import {
  Drawer,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState, type ReactNode } from "react";
import Flashcard from "@/components/Flashcard";
import { splitHeadword } from "@/components/chinese";
import { useDatabase } from "@/database/context";
import type { Profile } from "@/database/plecoFile";
import { readMostDifficultCards } from "@/pages/MostDifficultCards.db";
import { useScript } from "@/script/context";

/** Rows per page. The full list is at most 1000, so paging is done in memory. */
const PAGE_SIZE = 25;

/**
 * Why the table has no rows. The three reasons are different questions
 * answered, and saying the wrong one misleads: a profile with no scorefile has
 * no review history at all, a profile that draws from no category reviews
 * nothing however much its scorefile holds, and only then does an empty list
 * mean the profile's cards have genuinely never been failed.
 */
const emptyReason = (profile: Profile): ReactNode => {
  const name = <b>{profile.name}</b>;

  if (profile.scorefile === null) {
    return (
      <>
        The {name} profile writes to no scorefile, so it has no review history.
      </>
    );
  }

  if (profile.categoryIds.length === 0) {
    return (
      <>
        The {name} profile draws from no category, so it puts no card in front
        of you to fail.
      </>
    );
  }

  return <>No card has ever failed a review in the {name} profile.</>;
};

const MostDifficultCards = () => {
  const { database, profile } = useDatabase();
  const { script } = useScript();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const cards = useMemo(
    () =>
      database && profile ? readMostDifficultCards(database, profile) : null,
    [database, profile],
  );

  // The open card is looked up in the current list rather than kept in state,
  // so switching profile can never leave the drawer showing tallies read from
  // the scorefile of the profile before it.
  const selected = cards?.find((card) => card.id === selectedId) ?? null;

  // The two are null together — difficulty is asked of one profile.
  if (!cards || !profile) {
    return (
      <Stack gap="lg">
        <Title>Most difficult cards</Title>
        <Text c="dimmed">
          Import a set of flashcards to see the cards a profile fails most.
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
        <Text c="dimmed">{emptyReason(profile)}</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            The <b>{cards.length.toLocaleString()}</b> cards the{" "}
            <b>{profile.name}</b> profile failed most often, counting incorrect
            reviews in its “<b>{profile.scorefile?.name}</b>” scorefile only.
            Select a card to see its details.
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
          setSelectedId(null);
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
