import { getScoreLevel } from "../utils/score";
import "./ScoreCircle.css";

// A ring that fills up to the score and is green, yellow or red
export default function ScoreCircle({ score, size = 120 }) {
  const stroke = Math.max(8, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const level = getScoreLevel(score);

  return (
    <div
      className="score-circle"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Safety score ${score} out of 100`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(--${level})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-circle-number" style={{ fontSize: size * 0.28 }}>
        {score}
      </span>
    </div>
  );
}
