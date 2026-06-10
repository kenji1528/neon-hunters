import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "NEON TETRIS",
  description: "スマホでできるネオン風テトリス",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TetrisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
