import type { Profile } from "@/database/plecoFile";

export type LinkTarget =
  | { kind: "none" }
  | { kind: "mismatch" }
  | { kind: "match"; profileId: number };

/** Missing is optional; empty, repeated or malformed values are not. */
const integerParameter = (
  params: URLSearchParams,
  name: string,
): number | null | undefined => {
  const values = params.getAll(name);
  if (values.length === 0) return undefined;
  const value = values[0] ?? "";
  if (values.length !== 1 || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
};

/** Both constraints must describe the same profile, with no date rounding. */
export const resolveLinkTarget = (
  search: string,
  profiles: Profile[],
  selectedId: number | null,
): LinkTarget => {
  const params = new URLSearchParams(search);
  const profileId = integerParameter(params, "profileId");
  const lastSessionStart = integerParameter(params, "lastSessionStart");

  if (profileId === undefined && lastSessionStart === undefined) {
    return { kind: "none" };
  }
  if (profileId === null || lastSessionStart === null) {
    return { kind: "mismatch" };
  }

  const matches = profiles.filter(
    (profile) =>
      (profileId === undefined || profile.id === profileId) &&
      (lastSessionStart === undefined ||
        profile.lastSessionStart === lastSessionStart),
  );
  // Ties keep the selected profile if possible, then follow Pleco's order.
  const match =
    matches.find((profile) => profile.id === selectedId) ?? matches[0];
  return match ? { kind: "match", profileId: match.id } : { kind: "mismatch" };
};
