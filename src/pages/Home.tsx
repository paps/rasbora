import {
  Alert,
  Button,
  Container,
  FileButton,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo } from "react";
import { useDatabase } from "@/database/context";
import { readSummary } from "@/database/plecoDatabase";

const Home = () => {
  const { database, fileName, isImporting, error, importFile } = useDatabase();

  const rows = useMemo(() => {
    if (!database) {
      return null;
    }

    const summary = readSummary(database);

    return [
      { label: "Format version", value: summary.formatVersion },
      { label: "Platform", value: summary.platform },
      { label: "Cards", value: summary.cardCount.toLocaleString() },
      { label: "Categories", value: summary.categoryCount.toLocaleString() },
      { label: "Profiles", value: summary.profiles.join(", ") },
      ...summary.scorefiles.map((scorefile) => ({
        label: scorefile.name,
        value: `${scorefile.reviewedCards.toLocaleString()} reviewed cards`,
      })),
    ];
  }, [database]);

  const handleChange = (file: File | null) => {
    if (file) {
      importFile(file);
    }
  };

  return (
    <Container p="xl">
      <Stack gap="lg">
        <Title>Rasbora</Title>

        <Group>
          <FileButton accept=".pqb" onChange={handleChange}>
            {(props) => (
              <Button {...props} loading={isImporting}>
                Import a Pleco export
              </Button>
            )}
          </FileButton>

          {fileName && (
            <Text size="sm" c="dimmed">
              {fileName}
            </Text>
          )}
        </Group>

        {error && (
          <Alert color="red" title="Import failed">
            {error}
          </Alert>
        )}

        {rows && (
          <Table withTableBorder verticalSpacing="xs">
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Th w="50%">{row.label}</Table.Th>
                  <Table.Td>{row.value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Container>
  );
};

export default Home;
