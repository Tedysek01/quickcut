"use client";

import { useRef, useCallback } from "react";
import type { AnnotationConfig } from "@/types/editConfig";
import { useEditorStore } from "@/stores/editorStore";

interface AnnotationOverlayProps {
  annotations: AnnotationConfig[];
  containerWidth: number;
  containerHeight: number;
}

/**
 * Renders draggable/resizable text annotations on the video preview.
 * Coordinates are stored as percentages (0-100) of the video frame.
 * Uses native drag for simplicity (avoids react-rnd dependency).
 */
export default function AnnotationOverlay({
  annotations,
  containerWidth,
  containerHeight,
}: AnnotationOverlayProps) {
  const { selectedElement, selectElement, updateAnnotation } = useEditorStore();

  if (!annotations.length) return null;

  return (
    <>
      {annotations.map((ann) => {
        const isSelected = selectedElement?.type === "annotation" && selectedElement.id === ann.id;
        const left = (ann.x / 100) * containerWidth;
        const top = (ann.y / 100) * containerHeight;

        return (
          <div
            key={ann.id}
            className="absolute select-none"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              cursor: isSelected ? "move" : "pointer",
              pointerEvents: isSelected ? "auto" : "auto",
              zIndex: isSelected ? 12 : 8,
              // Selection ring
              outline: isSelected ? "2px solid var(--accent)" : "none",
              outlineOffset: "2px",
              borderRadius: `${ann.style.borderRadius}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectElement({ type: "annotation" as any, id: ann.id });
            }}
            onMouseDown={(e) => {
              if (!isSelected) return;
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const origX = ann.x;
              const origY = ann.y;

              const onMove = (ev: MouseEvent) => {
                const dx = ((ev.clientX - startX) / containerWidth) * 100;
                const dy = ((ev.clientY - startY) / containerHeight) * 100;
                const newX = Math.max(0, Math.min(100, origX + dx));
                const newY = Math.max(0, Math.min(100, origY + dy));
                updateAnnotation(ann.id, { x: newX, y: newY });
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          >
            <div
              style={{
                fontFamily: ann.style.fontFamily,
                fontSize: `${ann.style.fontSize}px`,
                color: ann.style.color,
                backgroundColor: ann.style.backgroundColor || "transparent",
                fontWeight: ann.style.bold ? "bold" : "normal",
                fontStyle: ann.style.italic ? "italic" : "normal",
                borderRadius: `${ann.style.borderRadius}px`,
                padding: "4px 8px",
                whiteSpace: "nowrap",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {ann.content || "Text"}
            </div>
          </div>
        );
      })}
    </>
  );
}
