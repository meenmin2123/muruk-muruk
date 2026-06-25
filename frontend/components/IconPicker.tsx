"use client";

import { useState } from "react";
import { Icon, PICK_ICONS } from "./Icon";

const EMOJIS = [
  "🎯", "🌟", "⭐", "🔥", "💪", "🧠", "📚", "🎓", "✏️", "💡",
  "✈️", "🏖️", "⛰️", "🗺️", "🏠", "🚗", "💼", "💻", "💰", "📈",
  "🎨", "🎵", "🎸", "🎬", "🎮", "📷", "📖", "⚽", "🏀", "🏃",
  "🧘", "🍎", "🥗", "💧", "☕", "🍳", "😴", "🌙", "☀️", "🌈",
  "🌱", "🌳", "🌸", "🌷", "🍀", "🪴", "🐣", "🐱", "🐶", "🐻",
  "🦋", "💖", "✅", "🎁", "🏆", "🥇", "⏰", "📅", "📝", "🦷",
];

export function IconPicker({
  color,
  onPick,
  onClose,
}: {
  color: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"icon" | "emoji">("icon");
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="iconpicker" onClick={(e) => e.stopPropagation()}>
        <div className="ipick-tabs">
          <button className={tab === "icon" ? "on" : ""} onClick={() => setTab("icon")}>아이콘</button>
          <button className={tab === "emoji" ? "on" : ""} onClick={() => setTab("emoji")}>이모지</button>
          <button className="ipick-x" aria-label="닫기" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {tab === "icon" ? (
          <div className="ipick-grid">
            {PICK_ICONS.map((n) => (
              <button key={n} className="ipick-cell" onClick={() => onPick(n)} aria-label={n}>
                <Icon name={n} size={24} color={color} />
              </button>
            ))}
          </div>
        ) : (
          <div className="ipick-grid emoji">
            {EMOJIS.map((e, i) => (
              <button key={i} className="ipick-cell" onClick={() => onPick(e)} aria-label={e}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
