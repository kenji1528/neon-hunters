"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;

// テトロミノ定義(4x4 グリッド内の相対座標)
const PIECES: { shape: number[][]; color: string; glow: string }[] = [
  // I
  { shape: [[0, 1], [1, 1], [2, 1], [3, 1]], color: "#00f0ff", glow: "#00f0ff" },
  // O
  { shape: [[1, 0], [2, 0], [1, 1], [2, 1]], color: "#ffe600", glow: "#ffe600" },
  // T
  { shape: [[1, 0], [0, 1], [1, 1], [2, 1]], color: "#c800ff", glow: "#c800ff" },
  // S
  { shape: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#00ff66", glow: "#00ff66" },
  // Z
  { shape: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#ff2255", glow: "#ff2255" },
  // J
  { shape: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#3366ff", glow: "#3366ff" },
  // L
  { shape: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#ff9900", glow: "#ff9900" },
];

type Cell = number | null; // ピース番号 or 空
type Board = Cell[][];

interface Piece {
  type: number;
  cells: { x: number; y: number }[]; // ボード座標
}

const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));

const spawnPiece = (type: number): Piece => ({
  type,
  cells: PIECES[type].shape.map(([x, y]) => ({ x: x + 3, y: y - 1 })),
});

const collides = (board: Board, cells: { x: number; y: number }[]) =>
  cells.some(
    (c) =>
      c.x < 0 ||
      c.x >= COLS ||
      c.y >= ROWS ||
      (c.y >= 0 && board[c.y][c.x] !== null)
  );

const movePiece = (p: Piece, dx: number, dy: number): Piece => ({
  ...p,
  cells: p.cells.map((c) => ({ x: c.x + dx, y: c.y + dy })),
});

// 各ピースの回転軸となるセルのインデックス(O は回転しない)
const PIVOT_INDEX = [1, 0, 2, 3, 2, 2, 2];

const rotatePiece = (p: Piece): Piece => {
  if (p.type === 1) return p;
  const pivot = p.cells[PIVOT_INDEX[p.type]];
  return {
    ...p,
    cells: p.cells.map((c) => ({
      x: pivot.x - (c.y - pivot.y),
      y: pivot.y + (c.x - pivot.x),
    })),
  };
};

const randomBag = (): number[] => {
  const bag = [0, 1, 2, 3, 4, 5, 6];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const LINE_SCORES = [0, 100, 300, 500, 800];

export default function TetrisPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);

  // ゲーム状態は ref で持ち、描画ループから直接参照する
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<Piece | null>(null);
  const bagRef = useRef<number[]>([]);
  const nextTypeRef = useRef<number>(0);
  const dropTimerRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stateRef = useRef<"ready" | "playing" | "paused" | "over">("ready");
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);

  // UI 表示用
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() =>
    typeof window === "undefined" ? 0 : Number(localStorage.getItem("tetris-high") || 0)
  );
  const [gameState, setGameState] = useState<"ready" | "playing" | "paused" | "over">("ready");

  const syncUi = useCallback(() => {
    setScore(scoreRef.current);
    setLines(linesRef.current);
    setLevel(levelRef.current);
    setGameState(stateRef.current);
  }, []);

  const pullNext = useCallback(() => {
    if (bagRef.current.length === 0) bagRef.current = randomBag();
    return bagRef.current.pop()!;
  }, []);

  const drawNext = useCallback(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 64;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    if (stateRef.current === "ready") return;
    const def = PIECES[nextTypeRef.current];
    const cell = 14;
    const xs = def.shape.map(([x]) => x);
    const ys = def.shape.map(([, y]) => y);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * cell;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * cell;
    const ox = (size - w) / 2 - Math.min(...xs) * cell;
    const oy = (size - h) / 2 - Math.min(...ys) * cell;
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = def.color;
    for (const [x, y] of def.shape) {
      ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const cell = Math.min(w / COLS, h / ROWS);
    const ox = (w - cell * COLS) / 2;

    ctx.clearRect(0, 0, w, h);

    // グリッド
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, 0);
      ctx.lineTo(ox + x * cell, ROWS * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, y * cell);
      ctx.lineTo(ox + COLS * cell, y * cell);
      ctx.stroke();
    }

    const drawCell = (x: number, y: number, type: number, ghost = false) => {
      if (y < 0) return;
      const def = PIECES[type];
      const px = ox + x * cell;
      const py = y * cell;
      if (ghost) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = def.color + "66";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
      } else {
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 10;
        ctx.fillStyle = def.color;
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(px + 1, py + 1, cell - 2, (cell - 2) * 0.3);
      }
    };

    // 固定ブロック
    const board = boardRef.current;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = board[y][x];
        if (v !== null) drawCell(x, y, v);
      }
    }

    // ゴースト+落下中ピース
    const piece = pieceRef.current;
    if (piece && stateRef.current === "playing") {
      let ghost = piece;
      while (!collides(board, movePiece(ghost, 0, 1).cells)) {
        ghost = movePiece(ghost, 0, 1);
      }
      for (const c of ghost.cells) drawCell(c.x, c.y, piece.type, true);
      for (const c of piece.cells) drawCell(c.x, c.y, piece.type);
    }
    ctx.shadowBlur = 0;
  }, []);

  const lockPiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece) return;
    const board = boardRef.current;
    for (const c of piece.cells) {
      if (c.y < 0) {
        // 天井を超えたらゲームオーバー
        stateRef.current = "over";
        const hs = Math.max(scoreRef.current, Number(localStorage.getItem("tetris-high") || 0));
        localStorage.setItem("tetris-high", String(hs));
        setHighScore(hs);
        syncUi();
        return;
      }
      board[c.y][c.x] = piece.type;
    }

    // ライン消去
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((v) => v !== null)) {
        board.splice(y, 1);
        board.unshift(Array<Cell>(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      scoreRef.current += LINE_SCORES[cleared] * levelRef.current;
      linesRef.current += cleared;
      levelRef.current = Math.floor(linesRef.current / 10) + 1;
    }

    // 次のピース
    const next = spawnPiece(nextTypeRef.current);
    nextTypeRef.current = pullNext();
    if (collides(board, next.cells.filter((c) => c.y >= 0))) {
      stateRef.current = "over";
      const hs = Math.max(scoreRef.current, Number(localStorage.getItem("tetris-high") || 0));
      localStorage.setItem("tetris-high", String(hs));
      setHighScore(hs);
    } else {
      pieceRef.current = next;
    }
    drawNext();
    syncUi();
  }, [drawNext, pullNext, syncUi]);

  const tryMove = useCallback(
    (dx: number, dy: number): boolean => {
      const piece = pieceRef.current;
      if (!piece || stateRef.current !== "playing") return false;
      const moved = movePiece(piece, dx, dy);
      if (!collides(boardRef.current, moved.cells)) {
        pieceRef.current = moved;
        return true;
      }
      return false;
    },
    []
  );

  const rotate = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece || stateRef.current !== "playing") return;
    const rotated = rotatePiece(piece);
    // 壁蹴り: そのまま → 左右1マス → 上1マス
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]) {
      const kicked = movePiece(rotated, dx, dy);
      if (!collides(boardRef.current, kicked.cells)) {
        pieceRef.current = kicked;
        return;
      }
    }
  }, []);

  const softDrop = useCallback(() => {
    if (tryMove(0, 1)) {
      scoreRef.current += 1;
      dropTimerRef.current = 0;
    } else {
      lockPiece();
    }
  }, [tryMove, lockPiece]);

  const hardDrop = useCallback(() => {
    if (stateRef.current !== "playing") return;
    let dropped = 0;
    while (tryMove(0, 1)) dropped++;
    scoreRef.current += dropped * 2;
    lockPiece();
  }, [tryMove, lockPiece]);

  const startGame = useCallback(() => {
    boardRef.current = emptyBoard();
    bagRef.current = randomBag();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    dropTimerRef.current = 0;
    pieceRef.current = spawnPiece(pullNext());
    nextTypeRef.current = pullNext();
    stateRef.current = "playing";
    drawNext();
    syncUi();
  }, [pullNext, drawNext, syncUi]);

  const togglePause = useCallback(() => {
    if (stateRef.current === "playing") stateRef.current = "paused";
    else if (stateRef.current === "paused") stateRef.current = "playing";
    syncUi();
  }, [syncUi]);

  // メインループ
  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      const dt = lastTimeRef.current ? time - lastTimeRef.current : 0;
      lastTimeRef.current = time;

      if (stateRef.current === "playing") {
        dropTimerRef.current += dt;
        const interval = Math.max(80, 800 - (levelRef.current - 1) * 70);
        if (dropTimerRef.current >= interval) {
          dropTimerRef.current = 0;
          if (!tryMove(0, 1)) lockPiece();
          syncUi();
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, tryMove, lockPiece, syncUi]);

  // キャンバスサイズ調整
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // キーボード操作(PC でも遊べるように)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current === "ready" || stateRef.current === "over") {
        if (e.key === "Enter" || e.key === " ") startGame();
        return;
      }
      switch (e.key) {
        case "ArrowLeft": tryMove(-1, 0); break;
        case "ArrowRight": tryMove(1, 0); break;
        case "ArrowDown": softDrop(); break;
        case "ArrowUp": case "x": rotate(); break;
        case " ": e.preventDefault(); hardDrop(); break;
        case "p": case "Escape": togglePause(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryMove, softDrop, rotate, hardDrop, togglePause, startGame]);

  // スワイプ操作
  const touchRef = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const threshold = 28;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? 1 : -1, 0);
      touchRef.current = { x: t.clientX, y: start.y, t: start.t, moved: true };
    } else if (dy > threshold * 1.5 && Math.abs(dy) > Math.abs(dx)) {
      softDrop();
      touchRef.current = { x: start.x, y: t.clientY, t: start.t, moved: true };
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.t;
    // 素早い下スワイプ = ハードドロップ
    if (!start.moved && dy > 60 && elapsed < 250) {
      hardDrop();
      return;
    }
    // タップ = 回転
    if (!start.moved && Math.abs(dy) < 12 && elapsed < 300) {
      if (stateRef.current === "playing") rotate();
    }
  };

  const btn: React.CSSProperties = {
    flex: 1,
    padding: "16px 0",
    fontSize: 22,
    fontWeight: 700,
    color: "#00f0ff",
    background: "rgba(0, 240, 255, 0.08)",
    border: "1px solid rgba(0, 240, 255, 0.4)",
    borderRadius: 12,
    touchAction: "manipulation",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const overlay = gameState !== "playing";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(circle at 50% 0%, #101530 0%, #05060f 70%)",
        color: "#e0f7ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
        gap: 10,
        overscrollBehavior: "none",
      }}
    >
      {/* ヘッダー */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 4,
            color: "#00f0ff",
            textShadow: "0 0 12px #00f0ff, 0 0 30px rgba(0,240,255,0.5)",
          }}
        >
          NEON TETRIS
        </h1>
        <button
          onClick={togglePause}
          disabled={gameState === "ready" || gameState === "over"}
          style={{ ...btn, flex: "none", padding: "8px 14px", fontSize: 14, opacity: gameState === "playing" || gameState === "paused" ? 1 : 0.3 }}
        >
          {gameState === "paused" ? "▶" : "❚❚"}
        </button>
      </div>

      {/* スコア表示 */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8, fontSize: 12 }}>
        {[
          ["SCORE", score.toLocaleString()],
          ["LINES", String(lines)],
          ["LEVEL", String(level)],
          ["BEST", highScore.toLocaleString()],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 0",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(0,240,255,0.2)",
              borderRadius: 8,
            }}
          >
            <div style={{ opacity: 0.6, fontSize: 10, letterSpacing: 1 }}>{label}</div>
            {/* BEST は localStorage 由来で SSR と差分が出るため */}
            <div suppressHydrationWarning style={{ fontWeight: 700, fontSize: 14, color: "#00f0ff" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 盤面 + NEXT */}
      <div style={{ width: "100%", maxWidth: 420, flex: 1, display: "flex", gap: 8, minHeight: 0, position: "relative" }}>
        <div
          style={{
            flex: 1,
            position: "relative",
            border: "1px solid rgba(0,240,255,0.35)",
            borderRadius: 8,
            boxShadow: "0 0 20px rgba(0,240,255,0.15), inset 0 0 30px rgba(0,0,0,0.5)",
            background: "rgba(0,0,0,0.35)",
            overflow: "hidden",
            aspectRatio: `${COLS} / ${ROWS}`,
            margin: "0 auto",
            maxHeight: "100%",
            touchAction: "none",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          {overlay && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                background: "rgba(5,6,15,0.82)",
                backdropFilter: "blur(2px)",
              }}
            >
              {gameState === "over" && (
                <>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#ff2255", textShadow: "0 0 14px #ff2255" }}>
                    GAME OVER
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>SCORE: {score.toLocaleString()}</div>
                </>
              )}
              {gameState === "paused" && (
                <div style={{ fontSize: 26, fontWeight: 800, color: "#ffe600", textShadow: "0 0 14px #ffe600" }}>
                  PAUSE
                </div>
              )}
              <button
                onClick={gameState === "paused" ? togglePause : startGame}
                style={{
                  padding: "14px 36px",
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: "#05060f",
                  background: "#00f0ff",
                  border: "none",
                  borderRadius: 999,
                  boxShadow: "0 0 24px rgba(0,240,255,0.6)",
                }}
              >
                {gameState === "ready" ? "START" : gameState === "paused" ? "RESUME" : "RETRY"}
              </button>
              {gameState === "ready" && (
                <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center", lineHeight: 1.8, padding: "0 16px" }}>
                  タップ: 回転 / 左右スワイプ: 移動<br />
                  下スワイプ: 落下 / 素早く下: 一気に落とす
                </div>
              )}
            </div>
          )}
        </div>

        {/* NEXT */}
        <div style={{ width: 72, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6 }}>NEXT</div>
          <div
            style={{
              width: 64,
              height: 64,
              border: "1px solid rgba(0,240,255,0.25)",
              borderRadius: 8,
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <canvas ref={nextCanvasRef} style={{ width: 64, height: 64, display: "block" }} />
          </div>
        </div>
      </div>

      {/* 操作ボタン */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onPointerDown={() => tryMove(-1, 0)}>◀</button>
          <button style={{ ...btn, color: "#c800ff", borderColor: "rgba(200,0,255,0.4)", background: "rgba(200,0,255,0.08)" }} onPointerDown={rotate}>⟳</button>
          <button style={btn} onPointerDown={() => tryMove(1, 0)}>▶</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onPointerDown={softDrop}>▼</button>
          <button
            style={{ ...btn, color: "#ffe600", borderColor: "rgba(255,230,0,0.4)", background: "rgba(255,230,0,0.08)" }}
            onPointerDown={hardDrop}
          >
            ⤓ DROP
          </button>
        </div>
      </div>
    </main>
  );
}
