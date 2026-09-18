import { Accordion, Anchor, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { scoreToDays } from "@/database/reviewSchedule";
import { formatDays } from "@/components/days";
import { readSettingNumbers } from "@/database/plecoFile";
import Explained from "@/components/Explained";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import {
  readProfileDetails,
  type ProfileSetting,
} from "@/pages/ProfileInfo.db";

interface DetailRow {
  label: string;
  /** Text for most rows, a `<RelativeTime>` for the ones holding a date. */
  value: ReactNode;
  /**
   * Shown on an info bubble beside the label, for a row that would otherwise
   * read as something it is not. Most rows say what they are and have none.
   */
  info?: string;
}

/**
 * The settings worth spelling out, in the order they are shown. Only settings
 * whose meaning `pleco-export-format.md` establishes are here — the remaining
 * ~140 are mostly UI chrome and are shown raw further down rather than
 * captioned with a guess.
 */
const KEY_SETTINGS: {
  label: string;
  describe: (
    setting: (key: string) => string,
    pointsPerDay: number | null,
  ) => string;
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
    label: "Card points per day",
    describe: (setting) => setting("pro_cardpointsday"),
  },
  {
    label: "Review interval range",
    describe: (setting, pointsPerDay) => {
      const min = scoreToDays(
        Number(setting("pro_scoreautomin")),
        pointsPerDay,
      );
      const max = scoreToDays(
        Number(setting("pro_scoreautomax")),
        pointsPerDay,
      );
      return min === null || max === null
        ? "—"
        : `${formatDays(min)} to ${formatDays(max)}`;
    },
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
    label: "Review interval buckets (free review)",
    describe: (setting, pointsPerDay) => {
      const scores = readSettingNumbers(setting("pro_scorefilter_free_starts"));
      return scores.length === 0 || pointsPerDay === null
        ? "—"
        : scores
            .map((score) => formatDays(scoreToDays(score, pointsPerDay)))
            .join(", ");
    },
  },
];

interface DetailTableProps {
  rows: DetailRow[];
}

const DetailTable = ({ rows }: DetailTableProps) => (
  <Table withTableBorder verticalSpacing="xs">
    <Table.Tbody>
      {rows.map((row) => (
        <Table.Tr key={row.label}>
          <Table.Th w="45%">
            {row.info === undefined ? (
              row.label
            ) : (
              <Explained info={row.info}>{row.label}</Explained>
            )}
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
  const { database, profile } = useDatabase();

  const details = useMemo(
    () => (database && profile ? readProfileDetails(database, profile) : null),
    [database, profile],
  );

  if (!database) {
    return (
      <Stack gap="md">
        <Title>Profile info</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see profile information.
        </Text>
      </Stack>
    );
  }

  if (!profile || !details) {
    return (
      <Stack gap="xl" maw={760}>
        <Title>Profile info</Title>
        <Text c="dimmed">
          This export holds no profile, so there is nothing for the app to read
          the flashcards through. What the file itself holds is on{" "}
          <Anchor component={Link} to="/load">
            Load Pleco file
          </Anchor>
          .
        </Text>
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
    { label: "Start date", value: <RelativeTime seconds={details.created} /> },
    { label: "Modified", value: <RelativeTime seconds={details.modified} /> },
    {
      label: "Last session started",
      value: <RelativeTime seconds={details.lastSessionStart} />,
    },
    {
      label: "Last session ended",
      value: <RelativeTime seconds={details.lastSessionEnd} />,
    },
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
          through the profile selected at the top of the window. What the file
          itself holds, whatever profile is reading it, is on{" "}
          <Anchor component={Link} to="/load">
            Load Pleco file
          </Anchor>
          .
        </Text>
        <DetailTable rows={profileRows} />
      </Stack>

      <Stack gap="md">
        <Title order={4}>Session settings</Title>
        <Text size="sm" c="dimmed">
          Review intervals are scores divided by this profile’s card points per
          day. A card’s next review is that interval after its last review;
          negative time remaining means it is overdue.
        </Text>
        <DetailTable
          rows={KEY_SETTINGS.map((entry) => ({
            label: entry.label,
            value: entry.describe(setting, details.pointsPerDay),
          }))}
        />
        <AllSettings settings={details.settings} />
      </Stack>
    </Stack>
  );
};

export default ProfileInfo;
