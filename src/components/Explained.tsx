import { Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

interface ExplainedProps {
  /** What the hover reveals: a sentence, or an exact date. */
  info: string;
  children: ReactNode;
}

/**
 * Text that a hover — or a keyboard focus, or a tap — explains, marked by a
 * dotted underline.
 *
 * This is the app's only "there is more here" affordance, and it is one
 * component so that it cannot come to look or behave differently in two
 * places: a label that would otherwise read as something it is not, and every
 * date, which shows its exact timestamp this way.
 *
 * The three things it fixes are all easy to leave out by hand. `events` opens
 * the tooltip to a keyboard and to a touchscreen, where Mantine's default is
 * hover alone; `tabIndex` is what lets a keyboard reach it at all; and `maw`
 * with `multiline` lets a sentence wrap while a short date still shrinks to
 * its own width.
 */
const Explained = ({ info, children }: ExplainedProps) => (
  <Tooltip
    label={info}
    multiline
    maw={300}
    withArrow
    // Below, so it never covers the row it refers to.
    position="bottom-start"
    events={{ hover: true, focus: true, touch: true }}
  >
    {/*
      A plain span rather than a Mantine <Text>: this sits inside a table
      header, a dimmed cell and ordinary body text, and it has to inherit the
      weight, size and colour of whichever it is in. <Text> resets them, which
      quietly unbolds a <th> label.
    */}
    <span
      tabIndex={0}
      style={{
        cursor: "help",
        textDecoration: "underline dotted",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </span>
  </Tooltip>
);

export default Explained;
