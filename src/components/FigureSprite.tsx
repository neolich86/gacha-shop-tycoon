"use client";

import { useEffect, useRef } from "react";
import { sprite, figureLook } from "@/game/sprites";

/** 피규어 도트 이미지. silhouette=true면 미획득(검은 실루엣) */
export default function FigureSprite({
  id,
  scale = 3,
  silhouette = false,
  className,
}: {
  id: number;
  scale?: number;
  silhouette?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const img = sprite(figureLook(id), "front", 0);
    cv.width = img.width;
    cv.height = img.height;
    const c = cv.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(img, 0, 0);
    if (silhouette) {
      c.globalCompositeOperation = "source-in";
      c.fillStyle = "#1b1528";
      c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = "source-over";
    }
  }, [id, silhouette]);
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: 22 * scale, height: 35 * scale, imageRendering: "pixelated" }}
      aria-hidden
    />
  );
}
