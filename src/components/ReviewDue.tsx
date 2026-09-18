import { Text } from "@mantine/core";
import { useState } from "react";
import Explained from "@/components/Explained";
import { formatDays } from "@/components/days";

interface ReviewDueProps {
  /** Estimated next review in Unix seconds, computed through the profile. */
  seconds: number | null;
}

/** The same signed countdown in every list and card; the clock is read on mount. */
const ReviewDue = ({ seconds }: ReviewDueProps) => {
  const [now] = useState(() => Date.now() / 1000);

  if (seconds === null) {
    return (
      <Explained info="The export needs a score, a last review date and valid card points per day to estimate the next review.">
        —
      </Explained>
    );
  }

  const days = (seconds - now) / 86_400;
  const color = days < 0 ? "red" : days > 0 ? "green" : undefined;

  return (
    <Explained
      info={`Estimated next review: ${new Date(seconds * 1000).toLocaleString()}. Negative days mean overdue; positive days are time remaining. Calculated when this display opens.`}
    >
      <Text span inherit c={color} style={{ whiteSpace: "nowrap" }}>
        {formatDays(days)}
      </Text>
    </Explained>
  );
};

export default ReviewDue;
