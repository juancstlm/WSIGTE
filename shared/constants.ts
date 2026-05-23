export const LOADING_LINES = [
  "Triangulating your hunger…",
  "Asking the city where to eat…",
  "Consulting questionable sources…",
  "Locating you. Don't move.",
  "Arguing with the algorithm…",
  "Ignoring your dietary preferences…",
  "Scanning every kitchen in range…",
  "Pretending to think hard…",
  "Cross-referencing vibes with data…",
  "Eliminating places you can't afford…",
  "Asking a stranger for directions…",
  "Running out of patience faster than you…",
];

export const DOWN_LINES = [
  "Eat whatever you want. We won't know.",
  "Indecision is currently outsourced to you.",
  "The dice are in the shop.",
  "Even we don't know where to eat right now.",
  "Out chasing a rumor about a taco truck.",
  "The decision engine is having one of its days.",
  "Pick a place. We're flattered you waited.",
];

export const REJECTIONS = [
  "Noted. That place is dead to us.",
  "Coward. Trying again.",
  "Fine. Picking something else.",
  "Your pickiness is being logged.",
  "Okay, calm down. Spinning again.",
  "Wow. Rejected instantly. Cold.",
  "You didn't even think about it.",
  "That place has feelings, you know.",
  "We'll pretend this never happened.",
  "Bold opinion from someone who can't choose.",
  "Interesting. Wrong, but interesting.",
  "The algorithm is judging you.",
  "Sure. You're definitely not the problem.",
  "Another one bites the dust.",
  "We're running out of restaurants and patience.",
];

// Neutral, low-judgment one-liners shown briefly when the user soft-skips
// (NEXT). Quieter than REJECTIONS — the app shouldn't shout at the user for
// skipping. See TOP_PICK_REJECTIONS / REJECTIONS for hard-reject copy.
export const SOFT_SKIP_LINES = [
  "Another one coming up.",
  "Sure. Spinning again.",
  "Noted. Trying something else.",
  "Got it. Looking again.",
  "Okay. Next.",
  "Fine. Moving on.",
];

// Short, all-caps deadpan labels for the soft-reject button. One is chosen at
// random per pick so the button itself rotates copy.
export const SOFT_REJECT_LABELS = [
  "NEXT",
  "PASS",
  "ANOTHER",
  "NOT IT",
  "MEH",
  "TRY AGAIN",
  "SKIP",
  "NAH",
  "AGAIN",
  "WHAT ELSE",
  "NEW ONE",
  "NOPE",
];

// Reserved for when the user rejects a curated top pick. The tone is louder —
// they squandered a rare recommendation, and the app would like them to know.
export const TOP_PICK_REJECTIONS = [
  "That was a top pick. You blew it.",
  "We curate these. You rejected it. In two seconds.",
  "Top pick. Gone. Hope the next one humbles you.",
  "Bold of you to say no to a recommendation.",
  "Most people would have eaten there. You're not most people, evidently.",
  "We almost never say go. You almost never listen.",
  "That was the good one. Spinning for the regular ones now.",
  "Cool. Reject the trifecta. Makes sense.",
  "You unlocked a top pick and immediately discarded it. Iconic.",
  "Restaurants would line up for that recommendation. You did not.",
  "The chef just felt that.",
  "We're sending the next one with lower expectations.",
  "Hard to overstate how wrong this decision is.",
  "Sure. Let's see what else we've got. Spoiler: it's worse.",
];
