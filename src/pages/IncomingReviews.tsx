import { BarChart } from "@mantine/charts";
import { Anchor, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useDatabase } from "@/database/context";
import { readIncomingReviews } from "@/pages/IncomingReviews.db";

const IncomingReviews = () => {
  const { database, profile } = useDatabase();
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

      {distribution.buckets.length > 0 ? (
        <BarChart
          h={440}
          data={distribution.buckets}
          dataKey="day"
          series={[{ name: "cards", label: "Cards", color: "blue.7" }]}
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
        days mean overdue; <b>0</b> means due within the next 24 hours. Every
        day between the earliest and latest estimates is included, even when no
        cards are due.
      </Text>

      <Text size="sm" c="dimmed">
        <b>{distribution.unknownCards.toLocaleString()}</b> cards are excluded
        from the chart because they lack a score, a valid last review date, or
        valid card points per day in this profile.
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
