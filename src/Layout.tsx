import {
  AppShell,
  Burger,
  Button,
  FileButton,
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
  { path: "/", label: "Profile info" },
  { path: "/statistics", label: "Statistics" },
  { path: "/recommendations", label: "Recommendations" },
  { path: "/difficult", label: "Most difficult cards" },
];

interface LayoutProps {
  children: ReactNode;
}

/**
 * The app frame: the sidebar, and a title bar holding the two controls that
 * are global to the app — the imported file, and the profile being read
 * through. Both live here because every page depends on them.
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

          <Title order={3}>Rasbora</Title>

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
                    // title, Change and the picker on one row.
                    w={{ base: 148, sm: 220 }}
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
