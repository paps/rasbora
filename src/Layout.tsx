import { AppShell, Burger, Group, NavLink, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useDatabase } from "@/database/context";

interface Page {
  path: string;
  label: string;
  /** Whether the page is only useful once an export has been imported. */
  needsDatabase: boolean;
}

/** The sidebar, in order. Every path here also needs a route in `App.tsx`. */
const PAGES: Page[] = [
  { path: "/", label: "Load flashcards", needsDatabase: false },
  { path: "/statistics", label: "Statistics", needsDatabase: true },
  { path: "/recommendations", label: "Recommendations", needsDatabase: true },
  { path: "/difficult", label: "Most difficult cards", needsDatabase: true },
];

interface LayoutProps {
  children: ReactNode;
}

/** The app frame: a title bar and the sidebar, around whatever page is open. */
const Layout = ({ children }: LayoutProps) => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { database } = useDatabase();
  const { pathname } = useLocation();

  return (
    <AppShell
      padding="xl"
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={3}>Rasbora</Title>
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
            disabled={page.needsDatabase && !database}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};

export default Layout;
