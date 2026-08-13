import {
  AppShell,
  Burger,
  Button,
  FileButton,
  Group,
  Image,
  NavLink,
  SegmentedControl,
  Select,
  Text,
  Title,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useDatabase } from "@/database/context";
import { useScript, type Script } from "@/script/context";

interface Page {
  path: string;
  label: string;
}

/** The sidebar, in order. Every path here also needs a route in `App.tsx`. */
const PAGES: Page[] = [
  { path: "/", label: "Profile info" },
  { path: "/statistics", label: "Statistics" },
  { path: "/recommendations", label: "Recommendations" },
  { path: "/difficult", label: "Most difficult cards" },
];

/**
 * The written forms, traditional first because it is the default. The visible
 * label is the character itself, which keeps the control narrow enough to sit
 * beside the profile picker on a phone and is what the reader is choosing
 * anyway; the word behind it is there for screen readers, which would otherwise
 * announce a bare 繁.
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

interface LayoutProps {
  children: ReactNode;
}

/**
 * The app frame: the sidebar, and a title bar holding the three controls that
 * are global to the app — the imported file, the profile being read through,
 * and the written form cards are shown in. All three live here because every
 * page depends on them.
 *
 * Sidebar links are never disabled. A page that has no export to read says so
 * itself, which it has to do anyway: its route still answers when typed in.
 */
const Layout = ({ children }: LayoutProps) => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const {
    database,
    fileName,
    isImporting,
    error,
    importFile,
    profiles,
    profile,
    selectProfile,
  } = useDatabase();
  const { script, setScript } = useScript();
  const { pathname } = useLocation();

  const importChosenFile = (file: File | null) => {
    if (file) {
      importFile(file);
    }
  };

  return (
    <AppShell
      padding="xl"
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />

          {/*
            The favicon doubles as the app's mark. It is referenced by its
            fixed public URL rather than imported, so the tab icon and the one
            beside the title can never drift apart. Decorative, hence the empty
            alt: the title right next to it already names the app.
          */}
          <Image src="/favicon.svg" alt="" w={30} h={30} />

          {/*
            The name gives way to the mark on a narrow phone: the title bar has
            three controls to fit on the right, and the favicon beside them
            already says which app this is.
          */}
          <Title order={3} visibleFrom="xs">
            Rasbora
          </Title>

          <Group gap="xs" wrap="nowrap" ml="auto">
            {error && (
              <Text size="sm" c="red" lineClamp={1}>
                {error}
              </Text>
            )}

            {database ? (
              <>
                <Text size="sm" c="dimmed" lineClamp={1} visibleFrom="sm">
                  {fileName}
                </Text>

                <FileButton accept=".pqb" onChange={importChosenFile}>
                  {(props) => (
                    <Button
                      {...props}
                      variant="subtle"
                      size="compact-sm"
                      loading={isImporting}
                    >
                      Change
                    </Button>
                  )}
                </FileButton>

                {profiles.length > 0 ? (
                  <Select
                    // Narrow enough that a phone still fits the burger, the
                    // title, Change, the picker and the script control on one
                    // row.
                    w={{ base: 104, sm: 220 }}
                    aria-label="Profile"
                    placeholder="Profile"
                    allowDeselect={false}
                    value={profile ? String(profile.id) : null}
                    onChange={(value) => {
                      if (value !== null) {
                        selectProfile(Number(value));
                      }
                    }}
                    data={profiles.map((candidate) => ({
                      value: String(candidate.id),
                      label: candidate.name,
                    }))}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    No profiles
                  </Text>
                )}

                {/*
                  Sits with the profile picker rather than above the card lists
                  it changes: it is one choice for the whole app, and every page
                  that draws a character obeys it.
                */}
                <Tooltip
                  label={SCRIPT_TOOLTIPS[script]}
                  withArrow
                  // Below: the control sits in the header, where a tooltip
                  // above it would open off the top of the window.
                  position="bottom"
                  // Hover and keyboard focus, but not touch: a tap already
                  // flips the control and shows the answer, so a bubble on
                  // top of it would only be in the way.
                  events={{ hover: true, focus: true, touch: false }}
                >
                  <SegmentedControl<Script>
                    size="xs"
                    aria-label="Character script"
                    value={script}
                    onChange={setScript}
                    data={SCRIPTS}
                  />
                </Tooltip>
              </>
            ) : (
              <FileButton accept=".pqb" onChange={importChosenFile}>
                {(props) => (
                  <Button {...props} loading={isImporting}>
                    Import flashcards
                  </Button>
                )}
              </FileButton>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {PAGES.map((page) => (
          <NavLink
            key={page.path}
            component={Link}
            to={page.path}
            label={page.label}
            active={page.path === pathname}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};

export default Layout;
