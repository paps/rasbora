import {
  Alert,
  AppShell,
  Burger,
  Group,
  Image,
  NavLink,
  Select,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useDatabase } from "@/database/context";

interface Page {
  path: string;
  label: string;
}

/** The sidebar, in order. Every path here also needs a route in `App.tsx`. */
const PAGES: Page[] = [
  { path: "/load", label: "Load Pleco file" },
  { path: "/", label: "Profile info" },
  { path: "/card-count", label: "Card count" },
  { path: "/learning-distribution", label: "Learning distribution" },
  // Between the pages about the profile and the five that ask "which cards?":
  // it is a lookup rather than a question about a set, so it does not belong
  // inside that run, and it is reached often enough not to sit under it.
  { path: "/card", label: "View a card" },
  { path: "/new", label: "New cards" },
  { path: "/leeches", label: "Leeches" },
  { path: "/lapses", label: "Lapses" },
  { path: "/almost-learned", label: "Almost learned cards" },
  { path: "/learned", label: "Learned cards" },
  // Last of the card lists rather than inside their "most work needed first"
  // run: the run it lists is the reader's to pick, so it sits at no one point
  // along that axis.
  { path: "/streaks", label: "Streaks" },
  { path: "/customized", label: "Customized cards" },
];

interface LayoutProps {
  children: ReactNode;
}

/**
 * The app frame: the sidebar, and a title bar holding the app's mark, its name
 * and the profile every page is read through.
 *
 * The profile is the only control up here, and it is here because it changes
 * while reading: the same page answers differently under another profile, so it
 * has to be reachable from all of them. The file and the written form used to
 * sit beside it and no longer do — they are chosen once rather than while
 * reading, and three controls plus a burger and the mark do not fit across a
 * phone. They live on `Load Pleco file` instead, which is also where the app
 * lands with nothing imported.
 *
 * Nothing is pushed to the right edge for the same reason. A right-aligned
 * group is only ever as far right as the layout viewport, which a card table
 * wider than the screen quietly widens on a phone — so the controls went off
 * the edge on exactly the screens with the least room. Left-aligned, they sit
 * next to the mark and wrap into the space they need.
 *
 * Sidebar links are never disabled. A page that has no export to read says so
 * itself, which it has to do anyway: its route still answers when typed in.
 */
const Layout = ({ children }: LayoutProps) => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const {
    database,
    profiles,
    profile,
    selectProfile,
    isImporting,
    isRestoring,
    storageWarning,
  } = useDatabase();
  const { pathname } = useLocation();

  return (
    <AppShell
      // `md` rather than `xl`: on a phone, `xl` spent 64 px of a 412 px screen
      // on margin, which is where a card table's columns were going.
      padding="md"
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

          <Title order={3}>Rasbora</Title>

          {/*
            Only shown once there is an export to pick a profile from: before
            one, there is nothing to choose between, and an empty picker would
            read as a file that loaded and held no profiles.
          */}
          {database && profiles.length > 0 && (
            <Select
              // Takes what the mark and the title leave, up to the width a
              // profile name actually needs. On a phone that is the rest of
              // the row; on a desktop it stops growing well short of it.
              flex={1}
              maw={220}
              aria-label="Profile"
              placeholder="Profile"
              allowDeselect={false}
              disabled={isImporting}
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
          )}
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

      <AppShell.Main>
        {storageWarning && (
          <Alert color="yellow" mb="md">
            {storageWarning}
          </Alert>
        )}
        {/* Wait before mounting routes so Landing cannot redirect a saved file to /load. */}
        {isRestoring ? (
          <Text c="dimmed" role="status">
            Restoring saved flashcards…
          </Text>
        ) : (
          children
        )}
      </AppShell.Main>
    </AppShell>
  );
};

export default Layout;
