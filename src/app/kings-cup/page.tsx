"use client";

import { useCallback, useMemo, useState } from "react";

// 画像のルール表に対応(1〜13 + Joker)
const RULES: Record<number, { title: string; desc: string }> = {
  1: { title: "ルールリセット", desc: "場に出ているルールを全てリセット!" },
  2: { title: "飲み指名", desc: "好きな人を1人指名して飲ませる" },
  3: { title: "自分グイ", desc: "引いたあなたが飲む!" },
  4: { title: "女子がグイ", desc: "女子全員が飲む!" },
  5: { title: "右隣グイ", desc: "右隣の人が飲む!" },
  6: { title: "左隣グイ", desc: "左隣の人が飲む!" },
  7: { title: "手を上げる", desc: "全員手を上げて、一番遅かった人が飲む" },
  8: { title: "道連れ決め", desc: "道連れを1人決める。あなたが飲む時は一緒に飲む" },
  9: { title: "飲みゲーム", desc: "好きな飲みゲームを開始!負けた人が飲む" },
  10: { title: "ルール決め", desc: "新しいルールを1つ作る。破った人は飲む" },
  11: { title: "質問マスター", desc: "質問マスターに就任。その質問に答えた人は飲む" },
  12: { title: "立ち上がる", desc: "全員立ち上がって、一番遅かった人が飲む" },
  13: { title: "男子がグイ", desc: "男子全員が飲む!" },
  0: { title: "自分以外全員グイ", desc: "あなた以外の全員が飲む!!" },
};

const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false },
];

const RANK_LABELS = ["JOKER", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Card {
  rank: number; // 1〜13、0 は Joker
  suit: number; // Joker は -1
}

const buildDeck = (): Card[] => {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }
  deck.push({ rank: 0, suit: -1 }, { rank: 0, suit: -1 });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const NEON_PINK = "#ff2e88";
const NEON_CYAN = "#00f0ff";
const NEON_YELLOW = "#ffe600";

export default function KingsCupPage() {
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [drawn, setDrawn] = useState<Card[]>([]);

  // 初回レンダリングはサーバーと一致させるため、シャッフルはクライアント操作時に行う
  const remaining = deck ? deck.length : 54;
  const current = drawn.length > 0 ? drawn[drawn.length - 1] : null;
  const rule = current ? RULES[current.rank] : null;
  const finished = deck !== null && deck.length === 0;

  const draw = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(30);
    setDeck((prev) => {
      const d = prev ?? buildDeck();
      if (d.length === 0) return d;
      const next = d[d.length - 1];
      setDrawn((h) => [...h, next]);
      return d.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setDeck(buildDeck());
    setDrawn([]);
  }, []);

  const suitColor = current && current.suit >= 0 && SUITS[current.suit].red ? NEON_PINK : "#e8f6ff";

  const historyChips = useMemo(
    () =>
      drawn
        .slice(0, -1)
        .slice(-12)
        .map((c, i) => (
          <span
            key={i}
            style={{
              padding: "2px 7px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: c.suit >= 0 && SUITS[c.suit].red ? NEON_PINK : "#cfe9ff",
              whiteSpace: "nowrap",
            }}
          >
            {c.suit >= 0 ? `${SUITS[c.suit].symbol}${RANK_LABELS[c.rank]}` : "🃏"}
          </span>
        )),
    [drawn]
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "radial-gradient(ellipse at 50% -20%, #2a0a3a 0%, #0a0a14 55%, #05050a 100%)",
        color: "#e8f6ff",
        fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
        padding: "12px 16px calc(16px + env(safe-area-inset-bottom))",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
    >
      <style>{`
        @keyframes flipIn {
          0% { transform: rotateY(180deg); }
          100% { transform: rotateY(0deg); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 18px ${NEON_CYAN}66, 0 0 42px ${NEON_PINK}33; }
          50% { box-shadow: 0 0 28px ${NEON_CYAN}aa, 0 0 60px ${NEON_PINK}55; }
        }
        @keyframes ruleIn {
          0% { opacity: 0; transform: translateY(10px); }
          60% { opacity: 0; }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 4,
          margin: "4px 0 2px",
          color: NEON_YELLOW,
          textShadow: `0 0 8px ${NEON_YELLOW}, 0 0 24px ${NEON_YELLOW}88`,
        }}
      >
        KING&apos;S CUP
      </h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 10px" }}>
        タップしてカードを捲れ! 残り {remaining} 枚
      </p>

      {/* カード本体(タップで次を引く) */}
      <div
        onClick={finished ? undefined : draw}
        style={{
          perspective: 900,
          cursor: finished ? "default" : "pointer",
          margin: "6px 0",
        }}
      >
        <div
          key={drawn.length}
          style={{
            width: "min(58vw, 230px)",
            aspectRatio: "2.5 / 3.5",
            position: "relative",
            transformStyle: "preserve-3d",
            animation: current ? "flipIn 0.55s ease-out both" : undefined,
          }}
        >
          {/* 表面 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              borderRadius: 16,
              background: "linear-gradient(160deg, #f8fbff 0%, #dfe9f5 100%)",
              border: `2px solid ${NEON_CYAN}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 20px ${NEON_CYAN}55`,
            }}
          >
            {current ? (
              current.suit >= 0 ? (
                <>
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 14,
                      fontSize: 22,
                      fontWeight: 900,
                      color: SUITS[current.suit].red ? "#e0245e" : "#1a1a2e",
                    }}
                  >
                    {RANK_LABELS[current.rank]}
                    <br />
                    {SUITS[current.suit].symbol}
                  </span>
                  <span
                    style={{
                      fontSize: 84,
                      color: SUITS[current.suit].red ? "#e0245e" : "#1a1a2e",
                      lineHeight: 1,
                    }}
                  >
                    {SUITS[current.suit].symbol}
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      color: SUITS[current.suit].red ? "#e0245e" : "#1a1a2e",
                    }}
                  >
                    {RANK_LABELS[current.rank]}
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 14,
                      fontSize: 22,
                      fontWeight: 900,
                      transform: "rotate(180deg)",
                      color: SUITS[current.suit].red ? "#e0245e" : "#1a1a2e",
                    }}
                  >
                    {RANK_LABELS[current.rank]}
                    <br />
                    {SUITS[current.suit].symbol}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 84, lineHeight: 1 }}>🃏</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#7a1fa2", letterSpacing: 2 }}>
                    JOKER
                  </span>
                </>
              )
            ) : null}
          </div>

          {/* 裏面 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderRadius: 16,
              background:
                `repeating-linear-gradient(45deg, #12122a 0px, #12122a 10px, #1a1040 10px, #1a1040 20px)`,
              border: `2px solid ${NEON_PINK}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "glowPulse 2s ease-in-out infinite",
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: NEON_PINK,
                textShadow: `0 0 10px ${NEON_PINK}`,
                letterSpacing: 3,
              }}
            >
              {current ? "" : "TAP"}
            </span>
          </div>

          {/* 初回はまだ引いていないので裏面を手前に表示 */}
          {!current && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                background:
                  `repeating-linear-gradient(45deg, #12122a 0px, #12122a 10px, #1a1040 10px, #1a1040 20px)`,
                border: `2px solid ${NEON_PINK}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "glowPulse 2s ease-in-out infinite",
              }}
            >
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: NEON_PINK,
                  textShadow: `0 0 10px ${NEON_PINK}`,
                  letterSpacing: 3,
                }}
              >
                TAP
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ルール表示 */}
      <div
        key={`rule-${drawn.length}`}
        style={{
          minHeight: 92,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          margin: "8px 0 4px",
          animation: rule ? "ruleIn 0.8s ease-out both" : undefined,
        }}
      >
        {finished && (
          <p style={{ fontSize: 18, fontWeight: 900, color: NEON_YELLOW, margin: "0 0 6px" }}>
            🎉 山札終了!おつかれさま!
          </p>
        )}
        {rule ? (
          <>
            <p
              style={{
                fontSize: 28,
                fontWeight: 900,
                margin: 0,
                color: suitColor,
                textShadow: `0 0 12px ${current && current.suit >= 0 && SUITS[current.suit].red ? NEON_PINK : NEON_CYAN}`,
              }}
            >
              {rule.title}
            </p>
            <p style={{ fontSize: 14, opacity: 0.85, margin: "6px 0 0", maxWidth: 300 }}>
              {rule.desc}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, opacity: 0.6, margin: 0 }}>
            カードをタップしてゲームスタート
          </p>
        )}
      </div>

      {/* 履歴 */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 340,
          minHeight: 24,
          margin: "auto 0 10px",
        }}
      >
        {historyChips}
      </div>

      <button
        onClick={reset}
        style={{
          padding: "10px 28px",
          borderRadius: 999,
          border: `2px solid ${NEON_CYAN}`,
          background: "transparent",
          color: NEON_CYAN,
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: 2,
          textShadow: `0 0 8px ${NEON_CYAN}`,
          boxShadow: `0 0 12px ${NEON_CYAN}44, inset 0 0 12px ${NEON_CYAN}22`,
          cursor: "pointer",
        }}
      >
        シャッフルしてやり直す
      </button>
    </main>
  );
}
