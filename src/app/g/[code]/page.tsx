"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Game = { id: string; code: string; title: string; status: string };
type Team = { id: string; name: string };
type Keyword = { id: string; text: string; points: number; order_index: number };
type Claim = { 
  id: string; 
  team_id: string; 
  keyword_id: string;
  photo_path: string;
  created_at: string;
};

export default function GamePage() {
  const params = useParams();
  const code = params.code as string;

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string>("");
  const [deleting, setDeleting] = useState<string>("");

  useEffect(() => {
    if (!code) return;
    
    (async () => {
      setLoading(true);
      
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, code, title, status")
        .eq("code", code)
        .maybeSingle();

      if (gameError || !gameData) {
        setError(gameError?.message || "ゲームが見つかりません");
        setLoading(false);
        return;
      }
      
      setGame(gameData);

      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("game_id", gameData.id)
        .order("name");
      
      setTeams(teamsData || []);

      const { data: keywordsData } = await supabase
        .from("keywords")
        .select("id, text, points, order_index")
        .eq("game_id", gameData.id)
        .order("order_index");
      
      setKeywords(keywordsData || []);

      await loadClaims(gameData.id);
      subscribeToChanges(gameData.id);
      
      setLoading(false);
    })();
  }, [code]);

  const loadClaims = async (gameId: string) => {
    const { data: claimsData } = await supabase
      .from("claims")
      .select("id, team_id, keyword_id, photo_path, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false });
    
    setClaims(claimsData || []);
  };

  const subscribeToChanges = (gameId: string) => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claims",
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          console.log("リアルタイム更新:", payload);
          loadClaims(gameId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handlePhotoUpload = async (keywordId: string, file: File) => {
    if (!game || !selectedTeamId) return;
    
    setUploading(keywordId);
    
    try {
      const { data: claimData, error: claimError } = await supabase
        .from("claims")
        .insert({
          game_id: game.id,
          team_id: selectedTeamId,
          keyword_id: keywordId,
          photo_path: "pending"
        })
        .select("id")
        .single();

      if (claimError) {
        alert(`エラー: ${claimError.message}`);
        setUploading("");
        return;
      }

      const claimId = claimData.id;
      const teamName = teams.find(t => t.id === selectedTeamId)?.name || "team";
      
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${game.code}/${teamName}/${keywordId}/${claimId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("neon-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        alert(`アップロードエラー: ${uploadError.message}`);
        await supabase.from("claims").delete().eq("id", claimId);
        setUploading("");
        return;
      }

      const { error: updateError } = await supabase
        .from("claims")
        .update({ photo_path: path })
        .eq("id", claimId);

      if (updateError) {
        alert(`更新エラー: ${updateError.message}`);
        setUploading("");
        return;
      }

      const keyword = keywords.find(k => k.id === keywordId);
      const points = keyword?.points || 0;
      alert(`✅ 成功！+${points}点獲得しました！`);
      
    } catch (err) {
      console.error(err);
      alert("予期しないエラーが発生しました");
    } finally {
      setUploading("");
    }
  };

  const handleDeletePhoto = async (claimId: string, photoPath: string) => {
    if (!confirm("この写真を削除しますか？ポイントも減点されます。")) return;
    
    setDeleting(claimId);
    
    try {
      if (photoPath && photoPath !== "pending") {
        await supabase.storage.from("neon-photos").remove([photoPath]);
      }

      const { error: deleteError } = await supabase
        .from("claims")
        .delete()
        .eq("id", claimId);

      if (deleteError) {
        alert(`削除エラー: ${deleteError.message}`);
        setDeleting("");
        return;
      }

      alert("削除しました");
      
    } catch (err) {
      console.error(err);
      alert("削除中にエラーが発生しました");
    } finally {
      setDeleting("");
    }
  };

  const calculateScore = (teamId: string) => {
    return claims
      .filter(c => c.team_id === teamId)
      .reduce((total, claim) => {
        const keyword = keywords.find(k => k.id === claim.keyword_id);
        return total + (keyword?.points || 0);
      }, 0);
  };

  const isClaimedByTeam = (keywordId: string, teamId: string) => {
    return claims.some(c => c.keyword_id === keywordId && c.team_id === teamId);
  };

  const getPhotoUrl = (photoPath: string) => {
    if (!photoPath || photoPath === "pending") return null;
    const { data } = supabase.storage.from("neon-photos").getPublicUrl(photoPath);
    return data.publicUrl;
  };

  const myPhotos = claims.filter(c => c.team_id === selectedTeamId && c.photo_path !== "pending");

  if (loading) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        background: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20
      }}>
        <div>読み込み中...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        background: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}>
        <div style={{ 
          background: "white",
          padding: 30,
          borderRadius: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          color: "#ef4444"
        }}>
          エラー: {error}
        </div>
      </main>
    );
  }

  const isRunning = game?.status === "running";

  return (
    <main style={{ 
      minHeight: "100vh",
      background: "#f9fafb",
      padding: "20px 20px 60px 20px"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ 
          background: "white",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: "clamp(24px, 5vw, 32px)",
            fontWeight: 900,
            color: "#111827",
            marginBottom: 10
          }}>
            {game?.title}
          </h1>
          <div style={{ display: "flex", gap: 15, flexWrap: "wrap", fontSize: 14, color: "#6b7280" }}>
            <span>コード: <b style={{ color: "#111827" }}>{code}</b></span>
            <span>•</span>
            <span>ステータス: <b style={{ 
              color: isRunning ? "#10b981" : "#6b7280" 
            }}>{game?.status}</b></span>
          </div>
        </div>

        {/* スコアボード */}
        <div style={{ 
          background: "white",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700 }}>スコアボード</h2>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              background: "#ef4444",
              color: "white",
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700
            }}>
              <span style={{ 
                width: 8, 
                height: 8, 
                borderRadius: "50%", 
                background: "white",
                animation: "pulse 2s infinite"
              }}></span>
              LIVE
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 15 }}>
            {teams.map(team => (
              <div
                key={team.id}
                style={{
                  background: selectedTeamId === team.id ? "#3b82f6" : "#f3f4f6",
                  padding: 20,
                  borderRadius: 16,
                  textAlign: "center",
                  transition: "all 0.3s ease",
                  boxShadow: selectedTeamId === team.id 
                    ? "0 10px 30px rgba(59, 130, 246, 0.3)"
                    : "0 2px 8px rgba(0,0,0,0.05)"
                }}
              >
                <div style={{ 
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: selectedTeamId === team.id ? "rgba(255,255,255,0.9)" : "#6b7280"
                }}>
                  チーム {team.name}
                </div>
                <div style={{ 
                  fontSize: "clamp(28px, 6vw, 36px)",
                  fontWeight: 900,
                  color: selectedTeamId === team.id ? "white" : "#111827"
                }}>
                  {calculateScore(team.id)}
                </div>
                <div style={{ 
                  fontSize: 12,
                  color: selectedTeamId === team.id ? "rgba(255,255,255,0.8)" : "#9ca3af"
                }}>
                  POINTS
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* チーム選択 */}
        <div style={{ 
          background: "white",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 700 }}>チームを選択</h2>
          <div style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                style={{
                  flex: "1 1 140px",
                  padding: "16px 24px",
                  fontSize: "clamp(16px, 3vw, 18px)",
                  fontWeight: 700,
                  border: selectedTeamId === team.id ? "3px solid #3b82f6" : "2px solid #e5e7eb",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background: selectedTeamId === team.id ? "#3b82f6" : "white",
                  color: selectedTeamId === team.id ? "white" : "#111827",
                  boxShadow: selectedTeamId === team.id 
                    ? "0 8px 24px rgba(59, 130, 246, 0.3)"
                    : "0 2px 8px rgba(0,0,0,0.05)"
                }}
              >
                チーム {team.name}
              </button>
            ))}
          </div>
        </div>

        {/* メインコンテンツ（レスポンシブ） */}
        <div className="main-content">
          {/* キーワード一覧 */}
          <div style={{ 
            background: "white",
            borderRadius: 20,
            padding: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
          }}>
            <h2 style={{ margin: "0 0 15px 0", fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 700 }}>キーワード一覧</h2>
            {!isRunning && (
              <div style={{ 
                background: "#fef3c7",
                border: "1px solid #fbbf24",
                padding: 15,
                borderRadius: 12,
                marginBottom: 20,
                color: "#92400e",
                fontSize: 14
              }}>
                ⚠️ ゲームが開始されていません
              </div>
            )}
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {keywords.map(keyword => {
                const claimed = selectedTeamId && isClaimedByTeam(keyword.id, selectedTeamId);
                const isUploading = uploading === keyword.id;
                
                return (
                  <div
                    key={keyword.id}
                    style={{
                      background: claimed ? "#d1fae5" : "white",
                      border: `2px solid ${claimed ? "#10b981" : "#e5e7eb"}`,
                      borderRadius: 12,
                      padding: 15,
                      transition: "all 0.3s ease",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ 
                          fontSize: "clamp(18px, 4vw, 20px)",
                          fontWeight: 700,
                          marginBottom: 5,
                          color: claimed ? "#065f46" : "#111827",
                          wordBreak: "break-word"
                        }}>
                          {keyword.text}
                        </div>
                        <div style={{ 
                          fontSize: 14,
                          color: claimed ? "#059669" : "#6b7280",
                          fontWeight: 600
                        }}>
                          {keyword.points} ポイント
                        </div>
                      </div>
                      
                      {claimed ? (
                        <div style={{ 
                          background: "#10b981",
                          color: "white",
                          padding: "10px 20px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 14,
                          whiteSpace: "nowrap"
                        }}>
                          ✓ 取得済み
                        </div>
                      ) : (
                        <label>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={!selectedTeamId || !isRunning || isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handlePhotoUpload(keyword.id, file);
                              }
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                          />
                          <div
                            style={{
                              padding: "12px 20px",
                              background: !selectedTeamId || !isRunning || isUploading 
                                ? "#d1d5db"
                                : "#3b82f6",
                              color: "white",
                              borderRadius: 8,
                              cursor: !selectedTeamId || !isRunning || isUploading ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 14,
                              textAlign: "center",
                              transition: "all 0.3s ease",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {isUploading ? "📤 送信中..." : "📷 写真を撮る"}
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 写真ギャラリー */}
          <div className="photo-gallery" style={{ 
            background: "white",
            borderRadius: 20,
            padding: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
          }}>
            <h2 style={{ margin: "0 0 15px 0", fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 700 }}>📸 撮影した写真</h2>
            {!selectedTeamId ? (
              <div style={{ 
                textAlign: "center",
                color: "#9ca3af",
                padding: "40px 20px"
              }}>
                チームを選択してください
              </div>
            ) : myPhotos.length === 0 ? (
              <div style={{ 
                textAlign: "center",
                color: "#9ca3af",
                padding: "40px 20px"
              }}>
                まだ写真がありません
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                {myPhotos.map(claim => {
                  const keyword = keywords.find(k => k.id === claim.keyword_id);
                  const photoUrl = getPhotoUrl(claim.photo_path);
                  const isDeleting = deleting === claim.id;
                  
                  return (
                    <div
                      key={claim.id}
                      style={{
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        transition: "all 0.3s ease"
                      }}
                    >
                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt={keyword?.text}
                          style={{
                            width: "100%",
                            height: 200,
                            objectFit: "cover"
                          }}
                        />
                      )}
                      <div style={{ 
                        padding: 15,
                        background: "white"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, wordBreak: "break-word" }}>
                              {keyword?.text}
                            </div>
                            <div style={{ 
                              color: "#10b981",
                              fontWeight: 600,
                              fontSize: 14
                            }}>
                              +{keyword?.points} ポイント
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePhoto(claim.id, claim.photo_path)}
                            disabled={isDeleting}
                            style={{
                              padding: "8px 16px",
                              background: isDeleting ? "#d1d5db" : "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: 6,
                              cursor: isDeleting ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              transition: "all 0.3s ease",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {isDeleting ? "削除中..." : "🗑️ 削除"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
