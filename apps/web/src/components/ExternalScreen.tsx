import SceneRenderer from "./live/SceneRenderer";
import { useLiveContext } from "../contexts/LiveContext";

export default function ExternalLive() {
    const { scene, status } = useLiveContext();

    const isLive = status.mode === "live";
    const shouldRender = scene && (isLive || status.mode === "paused");

    const placeholder = "Esperando contenido...";

    return (
        <div className="w-screen h-screen overflow-hidden relative flex items-center justify-center bg-black">
            <SceneRenderer
                scene={shouldRender ? scene : null}
                className="h-full w-full"
                placeholder={placeholder}
                playMedia={isLive}
                mode="live"
            />
        </div>
    );
}
