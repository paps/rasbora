import { Text } from "@mantine/core";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useDatabase } from "@/database/context";
import { resolveLinkTarget } from "@/linkTarget";

/** Validate an incoming link before any destination page (or its effects) mounts. */
const LinkedExport = ({ children }: { children: ReactNode }) => {
  const {
    database,
    profiles,
    profile,
    isRestoring,
    isImporting,
    selectProfile,
    forgetFile,
  } = useDatabase();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedId = profile?.id ?? null;
  const target = useMemo(
    () => resolveLinkTarget(location.search, profiles, selectedId),
    [location.search, profiles, selectedId],
  );

  useEffect(() => {
    if (isRestoring || isImporting || target.kind === "none") return;

    if (target.kind === "mismatch") {
      if (database) forgetFile({ unloadImmediately: true });
      // Discard the destination and every parameter, including fromUrl.
      // The user loads the intended export here and follows the original link again.
      void navigate("/load", {
        replace: true,
        state: { wrongExport: true },
      });
      return;
    }

    if (selectedId !== target.profileId) selectProfile(target.profileId);
    const params = new URLSearchParams(location.search);
    params.delete("profileId");
    params.delete("lastSessionStart");
    const navigationState: unknown = location.state;
    // Consume successful constraints so normal profile switching remains possible.
    void navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
        hash: location.hash,
      },
      { replace: true, state: navigationState },
    );
  }, [
    database,
    forgetFile,
    isImporting,
    isRestoring,
    location,
    navigate,
    selectProfile,
    selectedId,
    target,
  ]);

  if (isRestoring || target.kind !== "none") {
    return (
      <Text c="dimmed" role="status">
        Checking the linked Pleco export…
      </Text>
    );
  }

  return children;
};

export default LinkedExport;
