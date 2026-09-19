import { BarChart } from "@mantine/charts";
import { Anchor, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useDatabase } from "@/database/context";
import { DAYS_PARAM } from "@/pages/DueCards";
import {
  DUE_SERIES,
  UPCOMING_SERIES,
  readIncomingReviews,
} from "@/pages/IncomingReviews.db";

const SERIES = [
  { name: DUE_SERIES, label: "Due", color: "red.8" },
  { name: UPCOMING_SERIES, label: "Upcoming", color: "blue.7" },
];

/** Where a day's cards are listed. One day, exactly, as the bar counted it. */
const dayLink = (day: number): string => `/due?${DAYS_PARAM}=${String(day)}`;

/**
 * The day a chart-level click landed on. recharts types `activeLabel` loosely
 * and hands back whichever of the two the axis made of the `day` key, so both
 * are read and anything else is ignored rather than guessed at.
 */
const activeDay = (label: unknown): number | null => {
  if (typeof label !== "number" && typeof label !== "string") {
    return null;
  }

  const day = Number(label);

  return Number.isInteger(day) ? day : null;
};

const IncomingReviews = () => {
  const { database, profile } = useDatabase();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now() / 1000);
  const distribution = useMemo(
    () =>
      database && profile ? readIncomingReviews(database, profile, now) : null,
    [database, profile, now],
  );

  if (!distribution || !profile) {
    return (
      <Stack gap="md">
        <Title>Incoming reviews</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see when a profile’s cards are due for review.
        </Text>
      </Stack>
    );
  }

  if (distribution.totalCards === 0) {
    return (
      <Stack gap="md">
        <Title>Incoming reviews</Title>
        <Text c="dimmed">
          The <b>{profile.name}</b> profile draws from no category that holds
          cards, so there is nothing to chart.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title>Incoming reviews</Title>

      {/*
        The heading is a link when it counts something, and plain text when it
        counts nothing: `Due cards` with no range shows exactly this set — every
        card already overdue — so the number opens the cards behind it, the same
        promise the bars make. A link to an empty list would be a dead end.

        It keeps the heading's own red rather than taking the link colour, for
        the reason that red is there at all: it is the same overdue red as the
        bars it counts, which is data and not decoration. `c="inherit"` is what
        holds it, and a permanent underline is then what says this is a link —
        an Anchor that is neither blue nor underlined is just text.
      */}
      <Title order={3} c={distribution.dueCards > 0 ? "red.8" : undefined}>
        {distribution.dueCards > 0 ? (
          <Anchor
            component={Link}
            to="/due"
            inherit
            c="inherit"
            underline="always"
          >
            {distribution.dueCards.toLocaleString()}{" "}
            {distribution.dueCards === 1 ? "card" : "cards"} due for review
          </Anchor>
        ) : (
          <>{distribution.dueCards.toLocaleString()} cards due for review</>
        )}
      </Title>

      {distribution.buckets.length > 0 ? (
        <BarChart
          h={440}
          data={distribution.buckets}
          dataKey="day"
          series={SERIES}
          type="stacked"
          style={{ cursor: "pointer" }}
          // Selecting a day opens its cards, wired twice for the reasons it is
          // on `Learning distribution`: `barProps` is the only half that works
          // under a finger, since recharts fills the chart-level active state
          // from mouse movement and a tap has none; `barChartProps` catches the
          // rest of the column, which is what makes a one-card day reachable
          // with a mouse. Which series was hit is ignored — a day opens every
          // card it counts, due and upcoming alike, and only the far end of a
          // range holds both anyway.
          barProps={{
            onClick: (_bar, barIndex, event) => {
              const day = distribution.buckets[barIndex]?.day;

              if (day !== undefined) {
                event.stopPropagation();
                void navigate(dayLink(day));
              }
            },
          }}
          barChartProps={{
            onClick: (state) => {
              const day = activeDay(state.activeLabel);

              if (day !== null) {
                void navigate(dayLink(day));
              }
            },
          }}
          withLegend
          legendProps={{ verticalAlign: "top" }}
          maxBarWidth={72}
          xAxisLabel="Days until review"
          yAxisLabel="Cards"
          valueFormatter={(value) => value.toLocaleString()}
          yAxisProps={{ width: 70, allowDecimals: false }}
          xAxisProps={{ interval: "preserveStartEnd" }}
          tooltipProps={{
            labelFormatter: (label) =>
              typeof label === "number"
                ? `Days until review: ${label.toLocaleString()}`
                : label,
          }}
        />
      ) : (
        <Text c="dimmed">
          No review dates can be estimated for this profile’s cards.
        </Text>
      )}

      <Text size="sm" c="dimmed">
        <b>{profile.name}</b> has{" "}
        <b>{distribution.totalCards.toLocaleString()}</b> cards;{" "}
        <b>
          {(
            distribution.totalCards - distribution.unknownCards
          ).toLocaleString()}
        </b>{" "}
        have an estimated review date. Each bar counts cards due that many days
        from when this page was opened, rounded down to a whole day. Negative
        days are red and included in the total above because their estimated
        review time has passed; <b>0</b> means due within the next 24 hours.
        Every day between the earliest and latest estimates is included, even
        when no cards are due.
      </Text>

      <Text size="sm" c="dimmed">
        <b>{distribution.unknownCards.toLocaleString()}</b> cards are excluded
        from the chart because they lack a score, a valid last review date, or
        valid card points per day in this profile.
      </Text>

      <Text size="sm" c="dimmed">
        Selecting a bar lists the cards it counts on{" "}
        <Anchor component={Link} to="/due">
          Due cards
        </Anchor>
        , at that single day, and the count above opens every card already
        overdue. That page is in the sidebar too — a chart is not something a
        keyboard can select from — and both ends of its range can be set there.
      </Text>

      <Text size="sm" c="dimmed">
        Estimates use each card’s last review date and score, converted to days
        using this profile’s card points per day. They reflect the saved export;
        reviews since export are unknown. Reopen this page to recalculate
        against the current time.
      </Text>
    </Stack>
  );
};

export default IncomingReviews;
