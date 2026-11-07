import { getScoreLevel, LEVEL_LABEL } from "../utils/score";

// <Badge level="safe">Low</Badge>
export default function Badge({ level, children }) {
  return <span className={`badge ${level}`}>{children}</span>;
}

// <ScoreBadge score={74} />  ->  "74 · Safe" in the right colour
export function ScoreBadge({ score }) {
  const level = getScoreLevel(score);
  return (
    <Badge level={level}>
      {score} · {LEVEL_LABEL[level]}
    </Badge>
  );
}
