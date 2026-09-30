import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useTimeout } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
import correctSound from "./motivation/duolingo-correct-sound-effect.mp3?url";
import wrongSound from "./motivation/duolingo-wrong.mp3?url";
import completedSound from "./motivation/duolingo-completed-lesson.mp3?url";

const STORAGE_KEY = "rasbora-review-sessions";
const DAILY_GOAL = 10;

// Authored in advance; only the selection is random. Milestone names stay fixed.
const LEVELS = [
  {
    minimum: 0,
    label: "Ready when you are",
    color: "gray",
    messages: [
      "A fresh day of reviews starts with one session.",
      "Start with one session and see where it takes you.",
      "Your next bit of progress can start right here.",
      "One session is a lovely place to begin.",
      "There is room for a little Chinese in today.",
      "Take today one session at a time.",
      "You can begin again with just one session.",
      "A small start still counts.",
      "Your first session will give you something to celebrate.",
      "Whenever you are ready, one session gets today going.",
    ],
  },
  {
    minimum: 1,
    label: "Building momentum",
    color: "blue",
    messages: [
      "You showed up and put a session on the board.",
      "That is real time spent practising your Chinese.",
      "Your progress is taking shape, one session at a time.",
      "You have given yourself something to build on.",
      "A little more practice is now part of your day.",
      "Look at that: today's effort is adding up.",
      "You made space for your reviews. Nicely done.",
      "Another bit of practice worth feeling good about.",
      "You are building today's progress with each session.",
      "Those completed sessions are yours to keep.",
    ],
  },
  {
    minimum: 5,
    label: "Superb",
    color: "teal",
    messages: [
      "Superb work: you have reached at least halfway.",
      "Five or more sessions is already a day to feel good about.",
      "You have earned this superb milestone, session by session.",
      "Look how much practice you have already put in.",
      "Your effort today deserves a little celebration.",
      "That is a substantial helping of Chinese practice.",
      "Halfway or further, with every session counting.",
      "You have built a superb day of reviews already.",
      "Take a moment to enjoy the progress you have made.",
      "Whatever comes next, this is already superb work.",
    ],
  },
  {
    minimum: 8,
    label: "Really, really good",
    color: "violet",
    messages: [
      "Really, really good: your daily goal is close now.",
      "You are within a couple of sessions of ten.",
      "That is a lot of practice, and a small step left to your goal.",
      "You have done most of the work toward today's ten.",
      "The finish is in sight. Enjoy how far you have come.",
      "Eight or more sessions: that is a brilliant effort.",
      "Your goal is close, and your progress is already worth celebrating.",
      "Just a little distance left on today's progress bar.",
      "You have turned one session into a really good day of practice.",
      "So close to ten, with plenty to feel proud of already.",
    ],
  },
  {
    minimum: 10,
    label: "Ecstasy",
    color: "pink",
    messages: [
      "Ecstasy! You have reached your ten-session goal.",
      "Ten sessions achieved. Enjoy that well-earned celebration.",
      "Daily goal complete: look at what you made time for.",
      "You did it! Today's ten sessions are in the bag.",
      "That full progress bar is the result of your effort.",
      "Goal reached. Take a moment to savour it.",
      "Ten or more sessions: a fantastic day of Chinese practice.",
      "Today's goal is yours. Anything extra is a bonus.",
      "You followed through, all the way to ten.",
      "A full bar and a completed goal. Time to enjoy the feeling.",
    ],
  },
] as const;

function levelFor(count: number) {
  let result: (typeof LEVELS)[number] = LEVELS[0];
  for (const level of LEVELS) {
    if (count >= level.minimum) result = level;
  }
  return result;
}

// Use local calendar dates, not UTC or fixed 24-hour offsets (DST days differ).
function dateKey(date: Date) {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function studyDay(now: Date) {
  const date = new Date(now);
  if (date.getHours() < 7) date.setDate(date.getDate() - 1);
  return dateKey(date);
}

type Counts = Record<string, number>;

function parseCounts(raw: string | null): Counts {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid saved session counts");
  }
  const counts: Counts = {};
  for (const [day, count] of Object.entries(value)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw new Error("Invalid saved session count");
    }
    counts[day] = count;
  }
  return counts;
}

function readProgress() {
  try {
    return {
      counts: parseCounts(localStorage.getItem(STORAGE_KEY)),
      error: false,
    };
  } catch {
    return { counts: {} as Counts, error: true };
  }
}

const Motivation = () => {
  const [progress, setProgress] = useState(readProgress);
  const [day, setDay] = useState(() => studyDay(new Date()));
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * 10),
  );
  const [completionState, setCompletionState] = useState<
    "ready" | "loading" | "cooldown"
  >("ready");
  // useTimeout keeps the callback current (including corrections during the wait)
  // and cancels pending work when this page unmounts.
  const { start: startCompletion } = useTimeout(() => {
    changeCount(1);
    setCompletionState("cooldown");
  }, 500);
  const { start: startCooldown } = useTimeout(() => {
    setCompletionState("ready");
  }, 2000);
  const celebrationRef = useRef<HTMLParagraphElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { counts, error } = progress;
  const count = counts[day] ?? 0;
  const level = levelFor(count);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() - 6 + index);
    const key = dateKey(date);
    return { key, date, count: counts[key] ?? 0 };
  });
  const total = week.reduce((sum, entry) => sum + entry.count, 0);
  const returning =
    count === 0 &&
    week[5]?.count === 0 &&
    Object.entries(counts).some(([key, value]) => key < day && value > 0);

  useEffect(() => {
    const audio = new Audio(correctSound);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function schedule() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(7, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      timeout = setTimeout(refresh, next.getTime() - now.getTime());
    }
    function refresh() {
      setDay(studyDay(new Date()));
      clearTimeout(timeout);
      schedule();
    }
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null) {
        setProgress(readProgress());
      }
    }
    const element = celebrationRef.current;
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      element?.getAnimations().forEach((animation) => {
        animation.cancel();
      });
    };
  }, []);

  function changeCount(change: number) {
    // Read the clock and storage at the click, including after sleep or tab switches.
    const currentDay = studyDay(new Date());
    const saved = readProgress();
    const current = saved.error || error ? counts : saved.counts;
    const next = {
      ...current,
      [currentDay]: Math.max(0, (current[currentDay] ?? 0) + change),
    };
    let saveError = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      saveError = true;
    }
    setProgress({ counts: next, error: saveError });
    setDay(currentDay);
    // Pick a different sentence without changing it on unrelated renders.
    const offset = 1 + Math.floor(Math.random() * 9);
    setMessageIndex((previous) => (previous + offset) % 10);

    celebrationRef.current?.getAnimations().forEach((animation) => {
      animation.cancel();
    });
    // This page's celebration intentionally plays even with reduced motion enabled.
    if (change > 0) {
      celebrationRef.current?.animate(
        [
          { opacity: 0, transform: "translateY(8px) scale(0.7)" },
          {
            opacity: 1,
            transform: "translateY(-8px) scale(1.2)",
            offset: 0.25,
          },
          { opacity: 1, transform: "translateY(-8px) scale(1)", offset: 0.7 },
          { opacity: 0, transform: "translateY(-20px) scale(1)" },
        ],
        { duration: 1000, easing: "ease-out" },
      );
    }

    const sound =
      change < 0
        ? wrongSound
        : next[currentDay] === DAILY_GOAL
          ? completedSound
          : correctSound;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      // getAttribute preserves the imported URL's relative form for comparison.
      if (audio.getAttribute("src") !== sound) audio.src = sound;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Keep counting usable if the browser blocks playback or audio fails to load.
      });
    }
  }

  return (
    <Stack gap="lg" maw={680}>
      <Title>Motivation</Title>
      <Text c="dimmed">
        Finish a review session in Pleco, then count it here. No export needed.
      </Text>

      {error && (
        <Alert color="yellow" title="Progress could not be saved or restored">
          You can keep counting here, but your progress may not survive closing
          this page. Check that your browser allows site storage.
        </Alert>
      )}

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Today’s sessions</Text>
            <Badge color={level.color} variant="light">
              {level.label}
            </Badge>
          </Group>
          <Group align="center">
            <Text size="2.5rem" fw={700}>
              {count} / {DAILY_GOAL}
            </Text>
            <Text
              ref={celebrationRef}
              size="xl"
              aria-hidden="true"
              style={{ opacity: 0 }}
            >
              🎉 +1
            </Text>
          </Group>
          <Progress
            value={Math.min(count / DAILY_GOAL, 1) * 100}
            color={level.color}
            size="xl"
            radius="xl"
            transitionDuration={250}
            aria-label="Daily session goal"
            aria-valuetext={`${String(count)} of ${String(DAILY_GOAL)} sessions completed`}
          />
          <Group gap="xs">
            {LEVELS.filter((milestone) => milestone.minimum >= 5).map(
              (milestone) => (
                <Badge
                  key={milestone.minimum}
                  color={count >= milestone.minimum ? milestone.color : "gray"}
                  variant={count >= milestone.minimum ? "filled" : "outline"}
                >
                  {count >= milestone.minimum ? "✓ " : ""}
                  {milestone.minimum} · {milestone.label}
                </Badge>
              ),
            )}
          </Group>
          <Stack
            gap="xs"
            mih={100}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <Text fw={600}>
              {count >= DAILY_GOAL
                ? "Daily goal reached! Any extra sessions are a bonus."
                : count >= 5
                  ? `Just ${String(DAILY_GOAL - count)} ${count === 9 ? "session" : "sessions"} to your goal.`
                  : `${String(count)} ${count === 1 ? "session" : "sessions"} completed today.`}
            </Text>
            <Text>{level.messages[messageIndex]}</Text>
            {returning && <Text>Welcome back. Start with one session.</Text>}
          </Stack>
          <Button
            size="lg"
            color={count === 0 ? "blue" : level.color}
            loading={completionState === "loading"}
            loaderProps={{ type: "oval" }}
            disabled={completionState === "cooldown"}
            aria-busy={completionState === "loading"}
            onClick={() => {
              if (completionState !== "ready") return;
              setCompletionState("loading");
              startCompletion();
              startCooldown();
            }}
          >
            Session completed +1
          </Button>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Your day resets at 7am, local time.
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              disabled={count === 0}
              onClick={() => {
                changeCount(-1);
              }}
              aria-label="Decrease session count by one"
            >
              −1
            </Button>
          </Group>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Title order={2}>Last 7 days</Title>
        <SimpleGrid cols={7} spacing="xs">
          {week.map((entry) => (
            <Stack key={entry.key} align="center" gap="xs">
              <Text size="xs" fw={entry.key === day ? 700 : 400}>
                {entry.key === day
                  ? "Today"
                  : entry.date.toLocaleDateString(undefined, {
                      weekday: "short",
                    })}
              </Text>
              <Badge
                size="lg"
                w="100%"
                px={0}
                color={levelFor(entry.count).color}
                variant={entry.count >= 5 ? "filled" : "light"}
                aria-label={`${entry.date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}: ${String(entry.count)} sessions`}
              >
                {entry.count}
              </Badge>
              <Text size="xs" c="dimmed">
                {entry.date.toLocaleDateString(undefined, {
                  month: "numeric",
                  day: "numeric",
                })}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
        <Text size="sm">
          {total} {total === 1 ? "session" : "sessions"} in the last 7 days.
          Every session counts.
        </Text>
      </Stack>
      <Text size="xs" c="dimmed">
        Saved in this browser, with no automatic expiry. Clearing site data
        removes your history.
      </Text>
    </Stack>
  );
};

export default Motivation;
