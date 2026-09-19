import {
  Alert,
  Anchor,
  Button,
  FileButton,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  VisuallyHidden,
  useMantineColorScheme,
  type MantineColorScheme,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import RelativeTime from "@/components/RelativeTime";
import { useDatabase } from "@/database/context";
import { readFileSummary } from "@/pages/LoadFile.db";
import { downloadFile } from "@/pages/LoadFile.remote";
import { useScript, type Script } from "@/script/context";

/**
 * The written forms, traditional first because it is the default. The visible
 * label is the character itself, which is what the reader is choosing; the word
 * behind it is there for screen readers, which would otherwise announce a bare
 * 繁.
 */
const SCRIPTS: { value: Script; label: ReactNode }[] = [
  {
    value: "traditional",
    label: (
      <>
        繁<VisuallyHidden>Traditional</VisuallyHidden>
      </>
    ),
  },
  {
    value: "simplified",
    label: (
      <>
        简<VisuallyHidden>Simplified</VisuallyHidden>
      </>
    ),
  },
];

/**
 * What the control's tooltip says, keyed by the form currently showing: the
 * script in English, then the one a click switches to. 繁/简 only tells you
 * which is which if you can already read them, which is not true of everyone
 * learning to.
 *
 * Spelled out per script rather than built from `otherScript()` and a name
 * table, because two literal sentences are easier to read and to reword than
 * the code that would assemble them.
 */
const SCRIPT_TOOLTIPS: Record<Script, string> = {
  traditional: "Traditional — click for simplified",
  simplified: "Simplified — click for traditional",
};

/**
 * Light, dark, or whatever the browser asks for. `auto` leads because it is the
 * default and because it is the only one of the three that is not a decision —
 * a reader who has never touched this control is on it.
 *
 * Mantine names and stores these itself, so there is no `Script`-shaped
 * provider beside it: `useMantineColorScheme` is the state and
 * `mantine-color-scheme-value` in `localStorage` is the persistence.
 */
const COLOR_SCHEMES: { value: MantineColorScheme; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Where the export comes in, and the two reading preferences that decide how
 * every card in it is drawn.
 *
 * Both used to sit in the title bar, which ran out of room on a phone: three
 * controls, a burger and the app's mark do not fit across 412 px, and the
 * overflow pushed the script switch off the right edge. They are also both
 * things you do once — you import a file when you arrive, and you pick
 * traditional or simplified because of where you are learning, not per page —
 * so a page of their own costs nothing and leaves the title bar with only the
 * profile, which really does change while reading.
 *
 * File removal belongs here alongside import, since both apply to the export
 * rather than to the selected profile.
 */
const LoadFile = () => {
  const {
    database,
    fileName,
    sourceUrl,
    isImporting,
    error,
    importFile,
    forgetFile,
  } = useDatabase();
  const { script, setScript } = useScript();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [searchParams] = useSearchParams();
  const navigationState: unknown = useLocation().state;
  const wrongExport =
    typeof navigationState === "object" &&
    navigationState !== null &&
    "wrongExport" in navigationState &&
    navigationState.wrongExport === true;
  const [fromUrl] = useState(() => searchParams.get("fromUrl")?.trim() ?? "");
  const [url, setUrl] = useState(fromUrl);
  const automaticImportStartedRef = useRef(false);

  useEffect(() => {
    // Layout mounts this page after saved-file restoration. Treat the opening
    // link as one import request, including when Strict Mode replays effects.
    if (!fromUrl || isImporting || automaticImportStartedRef.current) return;
    automaticImportStartedRef.current = true;
    importFile(() => downloadFile(fromUrl), fromUrl);
  }, [fromUrl, isImporting, importFile]);

  const file = useMemo(
    () => (database ? readFileSummary(database) : null),
    [database],
  );
  const importChosenFile = (chosen: File | null) => {
    if (chosen) {
      importFile(chosen);
    }
  };

  return (
    <Stack gap="lg" maw={760}>
      <Title>Load Pleco file</Title>

      {wrongExport && !database && (
        <Alert
          color="red"
          variant="filled"
          title="This link targets another Pleco export"
          p="lg"
        >
          <Text>
            Load the Pleco export this link was meant for here, then click the
            original link again to open the right page.
          </Text>
        </Alert>
      )}

      {sourceUrl && (
        <Alert title="Loaded from a URL" color="blue" role="note">
          <Anchor
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            style={{ overflowWrap: "anywhere" }}
          >
            {sourceUrl}
          </Anchor>
        </Alert>
      )}

      <Stack gap="xs" align="flex-start">
        <Text size="sm" c="dimmed">
          Rasbora reads a Pleco flashcard export — the <b>.pqb</b> file Pleco
          writes from <b>Flashcards → Import/Export → Export cards</b>. It is
          read in your browser and never uploaded. Your file and selected
          profile are saved in this browser and restored when you reload or open
          another tab. Loading another file replaces the saved copy.
        </Text>

        <FileButton accept=".pqb" onChange={importChosenFile}>
          {(props) => (
            <Button {...props} disabled={isImporting}>
              {database ? "Load another file" : "Load a Pleco file"}
            </Button>
          )}
        </FileButton>

        <Stack
          component="form"
          gap="xs"
          w="100%"
          onSubmit={(event) => {
            event.preventDefault();
            importFile(() => downloadFile(url), url);
          }}
        >
          <TextInput
            label="File URL"
            description="Paste a direct download URL or a Google Drive file link shared with Anyone with the link."
            type="url"
            required
            value={url}
            onChange={(event) => {
              setUrl(event.currentTarget.value);
            }}
            disabled={isImporting}
          />
          <Group>
            <Button
              type="submit"
              variant="light"
              disabled={isImporting || !url.trim()}
            >
              Load from URL
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            Downloads go directly to your browser. Other hosts must allow
            browser access; links requiring sign-in are not supported. The
            downloaded file is saved here just like a local file. To get an
            updated export, load its URL again.
          </Text>
        </Stack>

        {isImporting && (
          <Text size="sm" role="status">
            Loading flashcards…
          </Text>
        )}

        {database && (
          <Button
            variant="subtle"
            color="red"
            onClick={() => {
              forgetFile();
            }}
            disabled={isImporting}
          >
            Forget file
          </Button>
        )}

        {error && (
          <Text size="sm" c="red" role="alert">
            {error}
          </Text>
        )}
      </Stack>

      {/*
        What the export holds, whatever profile is reading it. This used to sit
        at the bottom of `Profile info`, under two sections about a profile,
        which is the one page it does not belong on: everything else there
        changes when the profile picker does and these numbers never do. Here
        they describe the thing the page is about.
      */}
      {file !== null && (
        <Stack gap="xs">
          <Title order={4}>What is in it</Title>

          <Text size="sm" c="dimmed">
            The export as a whole, read without a profile —{" "}
            <Anchor component={Link} to="/profile">
              Profile info
            </Anchor>{" "}
            describes the one you are reading it through.
          </Text>

          <Table withTableBorder verticalSpacing="xs">
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w="45%">File</Table.Th>
                <Table.Td>{fileName ?? "—"}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Format version</Table.Th>
                <Table.Td>{file.formatVersion}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Written by</Table.Th>
                <Table.Td>
                  {file.generator} on {file.platform}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Start date</Table.Th>
                <Table.Td>
                  <RelativeTime seconds={file.created} />
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Cards</Table.Th>
                <Table.Td>{file.cardCount.toLocaleString()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Categories</Table.Th>
                <Table.Td>{file.categoryCount.toLocaleString()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Profiles</Table.Th>
                <Table.Td>{file.profileCount.toLocaleString()}</Table.Td>
              </Table.Tr>
              {file.scorefiles.map((scorefile) => (
                <Table.Tr key={scorefile.id}>
                  <Table.Th>Scorefile “{scorefile.name}”</Table.Th>
                  <Table.Td>
                    {scorefile.reviewedCards.toLocaleString()} cards with review
                    state
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      <Stack gap="xs" align="flex-start">
        <Title order={4}>Traditional or simplified</Title>

        <Text size="sm" c="dimmed">
          Pleco stores both written forms of every card, so this picks which one
          you read. It applies everywhere a character is drawn, and is
          remembered between visits. Cards with no traditional variant look the
          same either way.
        </Text>

        <Tooltip
          label={SCRIPT_TOOLTIPS[script]}
          withArrow
          // Hover and keyboard focus, but not touch: a tap already flips the
          // control and shows the answer, so a bubble on top of it would only
          // be in the way.
          events={{ hover: true, focus: true, touch: false }}
        >
          <SegmentedControl<Script>
            aria-label="Character script"
            value={script}
            onChange={setScript}
            data={SCRIPTS}
          />
        </Tooltip>
      </Stack>

      {/*
        The second reading preference, and here for the same reason as the
        first: you pick it once, because of the room you are sitting in, not
        while moving between pages. Its labels are words rather than a glyph,
        so it needs neither the hidden name nor the tooltip the 繁/简 control
        does.
      */}
      <Stack gap="xs" align="flex-start">
        <Title order={4}>Light or dark</Title>

        <Text size="sm" c="dimmed">
          On <b>Auto</b>, Rasbora reads whatever your browser or system is set
          to and follows it when that changes. Choosing light or dark overrides
          it here only, and is remembered between visits.
        </Text>

        <SegmentedControl<MantineColorScheme>
          aria-label="Color scheme"
          value={colorScheme}
          onChange={setColorScheme}
          data={COLOR_SCHEMES}
        />
      </Stack>
    </Stack>
  );
};

export default LoadFile;
