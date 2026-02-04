import { useMemo } from "react";
import SceneRenderer from "../live/SceneRenderer";
import type { CoverDocument } from "../../types/cover-design";
import type { Scene } from "../../types/live";

type CoverThumbnailProps = {
  doc: CoverDocument;
  className?: string;
};

export default function CoverThumbnail({ doc, className }: CoverThumbnailProps) {
  const scene = useMemo(
    () =>
      ({
        type: "cover",
        payload: { doc },
        meta: { title: "Cover preview", sourceModule: "covers" },
        id: "cover-preview",
        version: 0,
        updatedAt: 0,
      }) as Scene,
    [doc]
  );

  return (
    <div className={`relative overflow-hidden bg-black ${className ?? ""}`}>
      <SceneRenderer
        scene={scene}
        className="absolute inset-0"
        showPlaceholder={false}
        mode="preview"
      />
    </div>
  );
}
