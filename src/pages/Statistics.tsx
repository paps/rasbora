import { Anchor, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
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
 *
 * The same six serve both colour schemes. They were re-measured against the
 * dark page as well as the white one and the weakest is blue.7 at 3.70:1 there,
 * against yellow.8 at 2.48:1 in light — so a hue that works on white works
 * here. See `FIXED_COLORS` for the two that did not.
 */
const CATEGORY_COLORS = [
  "blue.7",
  "orange.8",
  "teal.8",
  "yellow.8",
  "pink.6",
  "green.8",
];

/**
 * The two series that are not a category always look the same.
 *
 * Unlike `CATEGORY_COLORS`, both of these had to follow the colour scheme. The
 * total is a neutral by design — it is the one line that is not a hue, so it
 * cannot be mistaken for a category — and a neutral is exactly the thing that
 * inverts: `gray.7` reads at 8.18:1 on a white page and 1.90:1 on a dark one,
 * which is the app's most important line all but gone. `dark.1` puts it back at
 * 7.83:1, which is the same line. `violet.7` is the same story less severely
 * (5.55:1 → 2.79:1); `violet.3` reads at 6.43:1 there and also separates
 * further from the six category hues under all three dichromacy simulations
 * (worst-case ΔE 11.3, against 7.4 today).
 *
 * `CATEGORY_COLORS` above needed none of this: every one of the six is a
 * saturated mid-shade that clears 3.4:1 on both surfaces.
 */
const FIXED_COLORS: Record<string, string> = {
  [TOTAL_SERIES]:
    "light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-1))",
  [OTHER_SERIES]:
    "light-dark(var(--mantine-color-violet-7), var(--mantine-color-violet-3))",
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
      <Stack gap="md">
        <Title>Statistics</Title>
        <Text c="dimmed">
          <Anchor component={Link} to="/load">
            Load a Pleco file
          </Anchor>{" "}
          to see statistics for a profile.
        </Text>
      </Stack>
    );
  }

  if (chart.cumulative.length === 0) {
    return (
      <Stack gap="md">
        <Title>Statistics</Title>
        <Text c="dimmed">
          This profile draws from no category that still holds dated cards, so
          there is nothing to chart.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
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
        Only the categories the <b>{profile.name}</b> profile draws from are
        counted. Cards in several categories count towards each of them, so the
        category lines can add up to more than the total.
        {chart.groupedCategories.length > 0 && (
          <>
            {" "}
            “Other categories” groups{" "}
            <b>{chart.groupedCategories.length.toLocaleString()}</b> smaller
            categories: <b>{chart.groupedCategories.join(", ")}</b>.
          </>
        )}
        {chart.undatedCards > 0 && (
          <>
            {" "}
            <b>{chart.undatedCards.toLocaleString()}</b> cards have no creation
            date and are left out.
          </>
        )}
      </Text>
    </Stack>
  );
};

export default Statistics;
