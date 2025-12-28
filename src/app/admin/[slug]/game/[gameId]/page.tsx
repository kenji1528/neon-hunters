"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Game = {
  id: string;
  code: string;
  title: string;
  status: string;
};

type Keyword = {
  id: string;
  text: string;
  points: number;
  order_index: number;
};

export default function GameEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規キーワード追加用
  const [newKeyword, setNewKeyword] = useState({ text: "", points: 1 });

  useEffect(() => {
    const adminSlug = process.env.NEXT_PUBLIC_ADMIN_SLUG || "";
    if (slug !== adminSlug) {
      router.push("/");
      return;
    }

    loadData();
  }, [slug, gameId, router]);

  const loadData = async () => {
    // ゲーム情報取得
    const { data: gameData } = await supabase
      .from("games")
      .select("id, code, title, status")
      .eq("id", gameId)
      .single();

    setGame(gameData);

    // キーワード取得
    const { data: keywordsData } = await supabase
      .from("keywords")
      .select("id, text, points, order_index")
      .eq("game_id", gameId)
      .order("order_index");

    setKeywords(keywordsData || []);
    setLoading(false);
  };

  // キーワード追加
  const addKeyword = async () => {
    if (!newKeyword.text.trim()) {
      alert("キーワードを入力してください");
      return;
    }

    const maxOrder = keywords.length > 0 
      ? Math.max(...keywords.map(k => k.order_index)) 
      : -1;

    const { error } = await supabase
      .from("keywords")
      .insert({
        game_id: gameId,
        text: newKeyword.text,
        points: newKeyword.points,
        order_index: maxOrder + 1
      });

    if (error) {
      alert(`エラー: ${error.message}`);
      return;
    }

    setNewKeyword({ text: "", points: 1 });
    await loadData();
  };

  // キーワード更新
  const updateKeyword = async (id: string, updates: Partial<Keyword>) => {
    const { error } = await supabase
      .from("keywords")
      .update(updates)
      .eq("id", id);

    if (error) {
      alert(`エラー: ${error.message}`);
      return;
    }

    await loadData();
  };

  // キーワード削除
  const deleteKeyword = async (id: string) => {
    if (!confirm("このキーワードを削除しますか？")) return;

    const { error } = await supabase
      .from("keywords")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`エラー: ${error.message}`);
      return;
    }

    await loadData();
  };

  // ゲームステータス変更
  const updateGameStatus = async (status: string) => {
    const updates: any = { status };
    
    if (status === "running" && !game?.status.includes("running")) {
      updates.start_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("games")
      .update(updates)
      .eq("id", gameId);

    if (error) {
      alert(`エラー: ${error.message}`);
      return;
    }

    await loadData();
  };

  if (loading) {
    return <main style={{ padding: 20 }}><p>読み込み中...</p></main>;
  }

  if (!game) {
    return <main style={{ padding: 20 }}><p>ゲームが見つかりません</p></main>;
  }

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <button
        onClick={() => router.push(`/admin/${slug}`)}
        style={{
          padding: "8px 16px",
          background: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
          marginBottom: 20
        }}
      >
        ← 戻る
      </button>

      <h1>🎮 {game.title}</h1>
      <p>コード: <b>{game.code}</b> | ステータス: <b>{game.status}</b></p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => updateGameStatus("running")}
          disabled={game.status === "running"}
          style={{
            padding: "10px 20px",
            background: game.status === "running" ? "#ccc" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: game.status === "running" ? "not-allowed" : "pointer"
          }}
        >
          ▶️ 開始
        </button>
        <button
          onClick={() => updateGameStatus("ended")}
          disabled={game.status === "ended"}
          style={{
            padding: "10px 20px",
            background: game.status === "ended" ? "#ccc" : "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: game.status === "ended" ? "not-allowed" : "pointer"
          }}
        >
          ⏹️ 終了
        </button>
        <button
          onClick={() => window.open(`/g/${game.code}`, '_blank')}
          style={{
            padding: "10px 20px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: "pointer"
          }}
        >
          👁️ プレビュー
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h2>キーワード管理</h2>

      {/* 新規キーワード追加 */}
      <div style={{ 
        padding: 15, 
        border: "2px dashed #007bff", 
        borderRadius: 8, 
        marginBottom: 20,
        background: "#f8f9fa"
      }}>
        <h3>新規キーワード追加</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            placeholder="キーワード名"
            value={newKeyword.text}
            onChange={(e) => setNewKeyword({ ...newKeyword, text: e.target.value })}
            style={{ 
              flex: 1, 
              padding: 10, 
              fontSize: 16, 
              border: "1px solid #ccc", 
              borderRadius: 5 
            }}
          />
          <input
            type="number"
            placeholder="ポイント"
            value={newKeyword.points}
            onChange={(e) => setNewKeyword({ ...newKeyword, points: parseInt(e.target.value) || 1 })}
            style={{ 
              width: 100, 
              padding: 10, 
              fontSize: 16, 
              border: "1px solid #ccc", 
              borderRadius: 5 
            }}
          />
          <button
            onClick={addKeyword}
            style={{
              padding: "10px 20px",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            追加
          </button>
        </div>
      </div>

      {/* キーワード一覧 */}
      <div>
        {keywords.length === 0 ? (
          <p>キーワードがありません。上のフォームから追加してください。</p>
        ) : (
          keywords.map((keyword, index) => (
            <div
              key={keyword.id}
              style={{
                padding: 15,
                margin: "10px 0",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "white"
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 30, fontWeight: "bold" }}>{index + 1}.</span>
                <input
                  type="text"
                  value={keyword.text}
                  onChange={(e) => updateKeyword(keyword.id, { text: e.target.value })}
                  style={{
                    flex: 1,
                    padding: 8,
                    fontSize: 16,
                    border: "1px solid #ccc",
                    borderRadius: 5
                  }}
                />
                <input
                  type="number"
                  value={keyword.points}
                  onChange={(e) => updateKeyword(keyword.id, { points: parseInt(e.target.value) || 1 })}
                  style={{
                    width: 80,
                    padding: 8,
                    fontSize: 16,
                    border: "1px solid #ccc",
                    borderRadius: 5
                  }}
                />
                <span>点</span>
                <button
                  onClick={() => deleteKeyword(keyword.id)}
                  style={{
                    padding: "8px 16px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer"
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
