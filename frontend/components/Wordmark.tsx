"use client";

/**
 * '여기붙여' 워드마크. 첫 '여'의 ㅇ 자리에 스티커(흰 테두리+색채움+광택)를 얹어
 * 일러스트 느낌을 준다. 텍스트는 Jua 폰트. color/height/sticker 색은 화면별로 조절.
 */
export function Wordmark({
  color = "#283330",
  height = 28,
  sticker = "#FFC93F",
}: {
  color?: string;
  height?: number;
  sticker?: string;
}) {
  const w = (230 / 72) * height;
  return (
    <svg
      viewBox="0 0 230 72"
      width={w}
      height={height}
      style={{ display: "block" }}
      role="img"
      aria-label="여기붙여"
    >
      <text x="8" y="55" fontFamily="'Jua', sans-serif" fontSize="46" fill={color}>
        여기붙여
      </text>
      {/* 첫 '여'의 ㅇ 위에 스티커 */}
      <g>
        <ellipse cx="30" cy="42.6" rx="13.6" ry="13.6" fill="rgba(0,0,0,0.12)" />
        <circle cx="30" cy="41" r="14.5" fill="#fff" />
        <circle cx="30" cy="41" r="12.5" fill={sticker} />
        <path
          d="M23.75 35.4 A9 9 0 0 1 32.5 32"
          fill="none"
          stroke="#fff"
          strokeWidth="3.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </svg>
  );
}
