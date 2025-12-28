cat > src/app/g/[code]/page.tsx << 'EOF'
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Game = { id: string; code: string; title: string; status: string; };

export default function GamePage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string);

  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, code, title, status")
        .eq("code", code)
        .single();
      if (error) setError(error.message);
      else setGame(data);
    })();
  }, [code]);

  return (
    <main style={{ padding: 20 }}>
      <h1>Neon Hunters</h1>
      <p>code: <b>{code}</b></p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!error && !game && <p>Loading...</p>}
      {game && (
        <>
          <p><b>Title:</b> {game.title}</p>
          <p><b>Status:</b> {game.status}</p>
        </>
      )}
    </main>
  );
}
EOF
