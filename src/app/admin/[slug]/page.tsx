"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Game = {
  id: string;
  code: string;
  title: string;
  status: string;
  created_at: string;
};

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 管理画面のスラッグをチェック
    const adminSlug = process.env.NEXT_PUBLIC_ADMIN_SLUG || "";
    if (slug !== adminSlug) {
      router.push("/");
      return;
    }

    loadGames();
  }, [slug, router]);

  const loadGames = async () => {
    const { data } = await supabase
      .from("games")
      .select("id, code, title, status, created_at")
      .order("created_at", { ascending: false });

    setGames(data || []);
    setLoading(false);
  };

  const createNewGame = () => {
    router.push(`/admin/${slug}/new`);
  };

  if (loading) {
    return <main style={{ padding: 20 }}><p>読み込み中...</p></main>;
  }

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>🎮 Neon Hunters 管理画面</h1>

      <button
        onClick={createNewGame}
        style={{
          padding: "12px 24px",
          background: "#28a745",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 16,
          fontWeight: "bold",
          marginBottom: 20
        }}
      >
        ➕ 新規ゲーム作成
      </button>

      <hr style={{ margin: "20px 0" }} />

      <h2>ゲーム一覧</h2>
      
      {games.length === 0 ? (
        <p>ゲームがありません。新規作成してください。</p>
      ) : (
        <div>
          {games.map(game => (
            <div
              key={game.id}
              style={{
                padding: 15,
                margin: "10px 0",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "white"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{game.title}</h3>
                  <p style={{ margin: "5px 0", color: "#666" }}>
                    コード: <b>{game.code}</b> | 
                    ステータス: <b>{game.status}</b>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => router.push(`/admin/${slug}/game/${game.id}`)}
                    style={{
                      padding: "8px 16px",
                      background: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: 5,
                      cursor: "pointer"
                    }}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => window.open(`/g/${game.code}`, '_blank')}
                    style={{
                      padding: "8px 16px",
                      background: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: 5,
                      cursor: "pointer"
                    }}
                  >
                    プレビュー
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
