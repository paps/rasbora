import { SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { useMemo, useState } from "react";
import { useDatabase } from "@/database/context";
import {
  OTHER_SERIES,
  TOTAL_SERIES,
  readCardsOverTime,
} from "@/pages/Statistics.db";

/**
 * Colours for the category lines, assigned in this order and never cycled —
 * the data layer caps the number of category series so that it cannot run out.
 * The order is a colourblind-safe one, checked as a palette rather than picked
 * by eye, so please re-check it before reordering or extending it.
 */
const CATEGORY_COLORS = [
  "blue.7",
  "orange.8",
  "teal.8",
  "yellow.8",
  "pink.6",
  "green.8",
];

/** The two series that are not a category always look the same. */
const FIXED_COLORS: Record<string, string> = {
  [TOTAL_SERIES]: "gray.7",
  [OTHER_SERIES]: "violet.7",
};

type Measure = "cumulative" | "monthly";

const Statistics = () => {
  const { database, profile } = useDatabase();
  const [measure, setMeasure] = useState<Measure>("cumulative");

  const chart = useMemo(() => {
    if (!database || !profile) {
      return null;
    }

    const cardsOverTime = readCardsOverTime(database, profile);
    const categoryKeys = cardsOverTime.series
      .map((series) => series.key)
      .filter((key) => !(key in FIXED_COLORS));

    return {
      ...cardsOverTime,
      series: cardsOverTime.series.map((series) => ({
        name: series.key,
        label: series.label,
        color:
          FIXED_COLORS[series.key] ??
          CATEGORY_COLORS[categoryKeys.indexOf(series.key)] ??
          "gray.7",
        // The total runs along the biggest category, so it is dashed to stay
        // readable where the two lines sit on top of each other.
        strokeDasharray: series.key === TOTAL_SERIES ? "6 4" : undefined,
      })),
    };
  }, [database, profile]);

  const data = useMemo(
    () =>
      (measure === "cumulative" ? chart?.cumulative : chart?.monthly)?.map(
        (point) => ({ month: point.month, ...point.counts }),
      ) ?? [],
    [chart, measure],
  );

  // The two are null together — the chart is read through the profile.
  if (!chart || !profile) {
    return (
      <Stack gap="lg">
        <Title>Statistics</Title>
        <Text c="dimmed">
          Import a set of flashcards to see statistics for a profile.
        </Text>
      </Stack>
    );
  }

  if (chart.cumulative.length === 0) {
    return (
      <Stack gap="lg">
        <Title>Statistics</Title>
        <Text c="dimmed">
          This profile draws from no category that still holds dated cards, so
          there is nothing to chart.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title>Statistics</Title>

      <SegmentedControl
        w="fit-content"
        value={measure}
        onChange={(value) => {
          setMeasure(value);
        }}
        data={[
          { value: "cumulative", label: "Cards held" },
          { value: "monthly", label: "Cards added" },
        ]}
      />

      <LineChart
        h={420}
        data={data}
        dataKey="month"
        series={chart.series}
        curveType="linear"
        withDots={false}
        withLegend
        legendProps={{ verticalAlign: "bottom" }}
        valueFormatter={(value) => value.toLocaleString()}
        yAxisProps={{ width: 60 }}
      />

      <Text size="sm" c="dimmed">
        {measure === "cumulative"
          ? "Cards created up to the end of each month, counted against the categories they are in today."
          : "Cards created during each month, counted against the categories they are in today."}{" "}
        Only the categories the {profile.name} profile draws from are counted.
        Cards in several categories count towards each of them, so the category
        lines can add up to more than the total.
        {chart.groupedCategories.length > 0 &&
          ` "Other categories" groups ${chart.groupedCategories.length.toLocaleString()} smaller categories: ${chart.groupedCategories.join(", ")}.`}
        {chart.undatedCards > 0 &&
          ` ${chart.undatedCards.toLocaleString()} cards have no creation date and are left out.`}
      </Text>
    </Stack>
  );
};

export default Statistics;
