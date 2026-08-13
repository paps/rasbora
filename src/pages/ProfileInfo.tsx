import {
  Accordion,
  Group,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMemo } from "react";
import { useDatabase } from "@/database/context";
import {
  readFileSummary,
  readProfileDetails,
  type ProfileSetting,
} from "@/pages/ProfileInfo.db";

interface DetailRow {
  label: string;
  value: string;
  /**
   * Shown on an info bubble beside the label, for a row that would otherwise
   * read as something it is not. Most rows say what they are and have none.
   */
  info?: string;
}

/** A timestamp in the reader's locale, or a dash when the export has none. */
const formatTime = (seconds: number | null): string =>
  seconds === null ? "—" : new Date(seconds * 1000).toLocaleString();

/** Reads a comma-**terminated** setting for display: `100,200,` is two values. */
const formatList = (value: string): string =>
  value
    .split(",")
    .filter((part) => part !== "")
    .join(", ");

/**
 * The settings worth spelling out, in the order they are shown. Only settings
 * whose meaning `pleco-export-format.md` establishes are here — the remaining
 * ~140 are mostly UI chrome and are shown raw further down rather than
 * captioned with a guess.
 */
const KEY_SETTINGS: {
  label: string;
  describe: (setting: (key: string) => string) => string;
}[] = [
  {
    label: "Cards per session",
    describe: (setting) => setting("pro_cardcount"),
  },
  {
    label: "New cards per session, at most",
    describe: (setting) => setting("pro_limitunlearnedmaxcards"),
  },
  {
    label: "Word length",
    describe: (setting) =>
      `${setting("pro_limitlengthstart")}–${setting("pro_limitlengthend")} characters`,
  },
  {
    label: "Score range",
    describe: (setting) =>
      `${setting("pro_scoreautomin")} to ${setting("pro_scoreautomax")}`,
  },
  {
    label: "Difficulty range",
    describe: (setting) =>
      `${setting("pro_scoremindifficulty")} to ${setting("pro_scoremaxdifficulty")}`,
  },
  {
    label: "Difficulty steps",
    describe: (setting) =>
      `${[1, 2, 3, 4, 5, 6]
        .map((step) => setting(`pro_scorediffchange${String(step)}`))
        .join(", ")}, divided by ${setting("pro_scorediffdivisor")}`,
  },
  {
    label: "Score buckets (free review)",
    describe: (setting) => formatList(setting("pro_scorefilter_free_starts")),
  },
  {
    label: "Language",
    describe: (setting) => setting("pro_language"),
  },
];

interface DetailTableProps {
  rows: DetailRow[];
}

/**
 * The bubble beside a label that a hover — or a keyboard focus, or a tap —
 * expands into a sentence. `aria-label` carries the same sentence, since the
 * bubble itself reads as nothing.
 */
const InfoBubble = ({ info }: { info: string }) => (
  <Tooltip
    label={info}
    multiline
    w={300}
    withArrow
    // Below, so it does not cover the Categories row it refers to.
    position="bottom-start"
    events={{ hover: true, focus: true, touch: true }}
  >
    <ThemeIcon
      size={16}
      radius="xl"
      variant="light"
      color="gray"
      tabIndex={0}
      aria-label={info}
      style={{ cursor: "help" }}
    >
      <Text fz={11} fw={700}>
        i
      </Text>
    </ThemeIcon>
  </Tooltip>
);

const DetailTable = ({ rows }: DetailTableProps) => (
  <Table withTableBorder verticalSpacing="xs">
    <Table.Tbody>
      {rows.map((row) => (
        <Table.Tr key={row.label}>
          <Table.Th w="45%">
            <Group gap={6} wrap="nowrap">
              {row.label}
              {row.info !== undefined && <InfoBubble info={row.info} />}
            </Group>
          </Table.Th>
          <Table.Td>{row.value}</Table.Td>
        </Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
);

interface AllSettingsProps {
  settings: ProfileSetting[];
}

const AllSettings = ({ settings }: AllSettingsProps) => (
  <Accordion variant="contained">
    <Accordion.Item value="settings">
      <Accordion.Control>
        All {settings.length.toLocaleString()} settings, as Pleco stores them
      </Accordion.Control>
      <Accordion.Panel>
        <Table verticalSpacing={4} fz="sm">
          <Table.Tbody>
            {settings.map((setting) => (
              <Table.Tr key={setting.key}>
                <Table.Td w="50%" c="dimmed">
                  {setting.key}
                </Table.Td>
                <Table.Td>{setting.value || "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);

const ProfileInfo = () => {
  const { database, fileName, profile } = useDatabase();

  const details = useMemo(
    () => (database && profile ? readProfileDetails(database, profile) : null),
    [database, profile],
  );
  const file = useMemo(
    () => (database ? readFileSummary(database) : null),
    [database],
  );

  if (!file) {
    return (
      <Stack gap="lg">
        <Title>Profile info</Title>
        <Text c="dimmed">
          Import a set of flashcards to see profile information.
        </Text>
      </Stack>
    );
  }

  const fileRows: DetailRow[] = [
    { label: "File", value: fileName ?? "—" },
    { label: "Format version", value: file.formatVersion },
    { label: "Written by", value: `${file.generator} on ${file.platform}` },
    { label: "Created", value: formatTime(file.created) },
    { label: "Cards", value: file.cardCount.toLocaleString() },
    { label: "Categories", value: file.categoryCount.toLocaleString() },
    { label: "Profiles", value: file.profileCount.toLocaleString() },
    ...file.scorefiles.map((scorefile) => ({
      label: `Scorefile “${scorefile.name}”`,
      value: `${scorefile.reviewedCards.toLocaleString()} cards with review state`,
    })),
  ];

  if (!profile || !details) {
    return (
      <Stack gap="xl" maw={760}>
        <Title>Profile info</Title>
        <Text c="dimmed">
          This export holds no profile, so there is nothing for the app to read
          the flashcards through.
        </Text>
        <Stack gap="md">
          <Title order={4}>File</Title>
          <DetailTable rows={fileRows} />
        </Stack>
      </Stack>
    );
  }

  // A setting Pleco never wrote, and one it wrote as NULL, both read as "—".
  const setting = (key: string): string => {
    const value = details.settings.find(
      (candidate) => candidate.key === key,
    )?.value;

    return value === undefined || value === "" ? "—" : value;
  };

  const profileRows: DetailRow[] = [
    {
      label: "Scorefile",
      value:
        details.scorefileName === null
          ? "None — this profile records no reviews"
          : `${details.scorefileName} — ${details.scoredCards.toLocaleString()} cards with review state`,
    },
    {
      label: "Categories",
      value:
        details.categories.length === 0
          ? "None — this profile draws from no category"
          : details.categories
              .map(
                (category) =>
                  `${category.name} (${category.cardCount.toLocaleString()} cards)`,
              )
              .join(", "),
    },
    {
      label: "Cards in the profile",
      value: details.cardCount.toLocaleString(),
      info: "Each card is counted once, however many of the profile's categories it is filed in, so this can be lower than the category counts added together. It is how many cards the profile can put in front of you.",
    },
    { label: "Created", value: formatTime(details.created) },
    { label: "Modified", value: formatTime(details.modified) },
    {
      label: "Last session started",
      value: formatTime(details.lastSessionStart),
    },
    { label: "Last session ended", value: formatTime(details.lastSessionEnd) },
  ];

  return (
    <Stack gap="xl" maw={760}>
      <Title>Profile info</Title>

      <Stack gap="md">
        <Title order={3}>{profile.name}</Title>
        <Text size="sm" c="dimmed">
          A profile is where everything starts in Pleco: it decides which
          scorefile a review writes to, which categories the cards come from,
          and how the session behaves. Every page of Rasbora reads the export
          through the profile selected at the top of the window.
        </Text>
        <DetailTable rows={profileRows} />
      </Stack>

      <Stack gap="md">
        <Title order={4}>Session settings</Title>
        <DetailTable
          rows={KEY_SETTINGS.map((entry) => ({
            label: entry.label,
            value: entry.describe(setting),
          }))}
        />
        <AllSettings settings={details.settings} />
      </Stack>

      <Stack gap="md">
        <Title order={4}>File</Title>
        <DetailTable rows={fileRows} />
      </Stack>
    </Stack>
  );
};

export default ProfileInfo;
