import { useState } from "react";
import Explained from "@/components/Explained";

interface RelativeTimeProps {
  /** Unix seconds, or null when the export never recorded the moment. */
  seconds: number | null;
}

/**
 * The units a duration is rounded to, largest first. Months and years are the
 * usual approximations — a date five months old reads as "5 months ago"
 * whatever the calendar says, which is the point of a relative date.
 */
const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

/**
 * The coarsest unit that fits, in the reader's locale. `numeric: "auto"` is
 * what turns −1 day into "yesterday" and 0 into "today" rather than "1 day
 * ago" and "in 0 days".
 */
const formatRelative = (seconds: number, now: number): string => {
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });
  const difference = seconds - now;
  const unit = UNITS.find(
    (candidate) => Math.abs(difference) >= candidate.seconds,
  );

  return unit === undefined
    ? formatter.format(0, "day")
    : formatter.format(Math.round(difference / unit.seconds), unit.unit);
};

/**
 * A moment in the export, written as how long ago it was, with the exact
 * timestamp a hover — or a keyboard focus, or a tap — away.
 *
 * Every date in the app goes through this, because "3 months ago" is the
 * question a reader actually has about a flashcard and an exact timestamp is
 * the rarer follow-up. Both are always available, so neither reading is lost.
 *
 * Nothing here ticks: a page left open overnight keeps yesterday's wording
 * until it is mounted again, which is not worth a timer on a page whose data
 * is a file the user imported by hand.
 */
const RelativeTime = ({ seconds }: RelativeTimeProps) => {
  // Read once when the component mounts rather than on every render: the clock
  // is the one thing here that is not a pure function of the props, and a
  // render triggered by something else must not silently reword the date.
  const [now] = useState(() => Date.now() / 1000);

  if (seconds === null) {
    return <>—</>;
  }

  const moment = new Date(seconds * 1000);

  return (
    <Explained info={moment.toLocaleString()}>
      <time dateTime={moment.toISOString()}>
        {formatRelative(seconds, now)}
      </time>
    </Explained>
  );
};

export default RelativeTime;
