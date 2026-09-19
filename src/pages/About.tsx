import { Anchor, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";

// Replace these home-page placeholders with the post URLs once they exist.
const PLECO_FORUM_POST_URL = "https://www.plecoforums.com/";
const REDDIT_POST_URL = "https://www.reddit.com/r/ChineseLanguage/";

const About = () => (
  <Stack gap="md" maw={760}>
    <Title>About 🙂</Title>

    <Text>
      Hi, I’m{" "}
      <Anchor
        href="https://martintapia.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        Martin
      </Anchor>
      . I made Rasbora for people like me who have a lot of flashcards to review
      in{" "}
      <Anchor
        href="https://www.pleco.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Pleco
      </Anchor>{" "}
      and want to make their Chinese learning more effective without losing
      motivation.
    </Text>

    <Text>
      Numbers make the work a little more game-like. Understanding how your
      cards are distributed, seeing what is due next, and setting realistic
      review schedules and goals over time can make a large collection feel
      manageable and help you keep moving forward.
    </Text>

    <Text>
      Rasbora only exists because Pleco is such an extraordinary app. Thank you
      to Michael Love, who founded Pleco Software in 2000, and to everyone who
      has helped build it. Pleco makes learning Chinese far more effective and
      enjoyable.
    </Text>

    <Text>
      To get started,{" "}
      <Anchor component={Link} to="/load">
        load a Pleco export
      </Anchor>
      .
    </Text>

    <Text>
      I would be very happy to hear your feedback. You can reach me at{" "}
      <Anchor href="mailto:contact@martintapia.com">
        contact@martintapia.com
      </Anchor>
      .
    </Text>

    <Text>These links are placeholders until the posts are ready:</Text>
    <Group gap="lg">
      <Anchor
        href={PLECO_FORUM_POST_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Pleco Forums post
      </Anchor>
      <Anchor href={REDDIT_POST_URL} target="_blank" rel="noopener noreferrer">
        Reddit post
      </Anchor>
    </Group>
  </Stack>
);

export default About;
