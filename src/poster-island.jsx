import React, { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const MIN_SIZE = 5;

function blockStyle(block) {
  return {
    left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${block.height}%`,
    transform: `rotate(${block.rotation || 0}deg)`
  };
}

function Handle({ direction, onStart }) {
  return <button type="button" contentEditable={false} className={`resize-handle resize-${direction}`} aria-label={`Resize ${direction}`} onPointerDown={(event) => onStart(event, "resize", direction)} />;
}

function PosterIsland({ design, titleText, messageText, selectedBlockId, imagePreviewUrls, audioPreviewUrls, videoPreviewUrls, onSelect, onBlockChange, onTextChange, onInteractionStart, onMediaMetadata }) {
  const canvasRef = useRef(null);
  const interactionRef = useRef(null);
  const callbacksRef = useRef({ onBlockChange });
  callbacksRef.current = { onBlockChange };

  useEffect(() => {
    const move = (event) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const { block, bounds, startX, startY, mode, direction } = interaction;
      const xChange = ((event.clientX - startX) / bounds.width) * 100;
      const yChange = ((event.clientY - startY) / bounds.height) * 100;
      let patch;

      if (mode === "drag") {
        patch = {
          x: Math.max(0, Math.min(100 - block.width, block.x + xChange)),
          y: Math.max(0, Math.min(100 - block.height, block.y + yChange))
        };
      } else if (mode === "rotate") {
        const centerX = bounds.left + ((block.x + block.width / 2) / 100) * bounds.width;
        const centerY = bounds.top + ((block.y + block.height / 2) / 100) * bounds.height;
        patch = { rotation: Math.round(Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI) + 90) };
      } else {
        const right = block.x + block.width;
        const bottom = block.y + block.height;
        if (block.aspect_ratio) {
          const canvasRatio = bounds.width / bounds.height;
          let width = direction.match(/[ew]/) ? block.width + (direction.includes("e") ? xChange : -xChange) :
            (block.height + (direction.includes("s") ? yChange : -yChange)) * block.aspect_ratio / canvasRatio;
          const maxWidth = Math.min(direction.includes("w") ? right : 100 - block.x,
            (direction.includes("n") ? bottom : 100 - block.y) * block.aspect_ratio / canvasRatio);
          width = Math.max(MIN_SIZE, Math.min(maxWidth, width));
          const height = width * canvasRatio / block.aspect_ratio;
          patch = { width, height, x: direction.includes("w") ? right - width : block.x, y: direction.includes("n") ? bottom - height : block.y };
        } else {
          patch = { x: block.x, y: block.y, width: block.width, height: block.height };
          if (direction.includes("e")) patch.width = Math.max(MIN_SIZE, Math.min(100 - block.x, block.width + xChange));
          if (direction.includes("s")) patch.height = Math.max(MIN_SIZE, Math.min(100 - block.y, block.height + yChange));
          if (direction.includes("w")) { patch.width = Math.max(MIN_SIZE, Math.min(right, block.width - xChange)); patch.x = right - patch.width; }
          if (direction.includes("n")) { patch.height = Math.max(MIN_SIZE, Math.min(bottom, block.height - yChange)); patch.y = bottom - patch.height; }
        }
      }
      callbacksRef.current.onBlockChange(interaction.id, patch);
    };
    const stop = () => { interactionRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);

  const start = (event, id, block, mode = "drag", direction) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onInteractionStart();
    onSelect(id);
    interactionRef.current = { id, block: { ...block }, bounds: canvasRef.current.getBoundingClientRect(), startX: event.clientX, startY: event.clientY, mode, direction };
  };

  const handles = (id, block) => <>
    {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => <Handle key={direction} direction={direction} onStart={(event) => start(event, id, block, "resize", direction)} />)}
    <button type="button" contentEditable={false} className="rotate-handle" aria-label="Rotate block" onPointerDown={(event) => start(event, id, block, "rotate")} />
  </>;

  const textBlock = (id, text, block) => {
    const selected = selectedBlockId === id;
    const label = id === "title" ? "Title" : id === "message" ? "Message" : `Message block ${design.sealed_blocks.indexOf(block) + 1}`;
    return <div key={id} className={`poster-block sealed-block poster-${id}-block${selected ? " selected" : ""}`} style={blockStyle(block)} aria-label={label}
      contentEditable={undefined} suppressContentEditableWarning
      onPointerDown={(event) => { if (!event.currentTarget.isContentEditable) start(event, id, block); }}
      onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.contentEditable = "true"; event.currentTarget.focus(); }}
      onInput={(event) => onTextChange(id, event.currentTarget.textContent)}
      onBlur={(event) => { event.currentTarget.contentEditable = "false"; }}>
      {text}{selected && handles(id, block)}
    </div>;
  };

  const mediaBlock = (id, block, type, url) => {
    if (!url) return null;
    const selected = selectedBlockId === id;
    const media = type === "image" ? <img src={url} alt="Capsule image" onLoad={(event) => onMediaMetadata(id, { aspectRatio: event.currentTarget.naturalWidth / event.currentTarget.naturalHeight })} /> :
      type === "video" ? <video controls src={url} onPointerDown={(event) => event.stopPropagation()} onLoadedMetadata={(event) => onMediaMetadata(id, { aspectRatio: event.currentTarget.videoWidth / event.currentTarget.videoHeight })} /> :
        type === "audio" ? <audio controls src={url} onPointerDown={(event) => event.stopPropagation()} /> : null;
    if (!media) return null;
    return <div key={id} className={`poster-block sealed-block${type === "image" ? " poster-image-block" : " poster-media-block"}${selected ? " selected" : ""}`} style={blockStyle(block)} onPointerDown={(event) => start(event, id, block)}>
      {media}{type !== "image" && <button type="button" contentEditable={false} className="media-drag-handle" onPointerDown={(event) => start(event, id, block)}>Move</button>}{selected && handles(id, block)}
    </div>;
  };

  const blocks = [];
  if (!design.hidden_blocks.includes("title")) blocks.push(textBlock("title", titleText || "Your title", design.title_block));
  if (!design.hidden_blocks.includes("message")) blocks.push(textBlock("message", messageText || "Your sealed message", design.message_block));
  if (design.audio_block) blocks.push(mediaBlock("audio", design.audio_block, "audio", audioPreviewUrls[0]));
  if (design.video_block) blocks.push(mediaBlock("video", design.video_block, "video", videoPreviewUrls[0]));
  design.sealed_blocks.forEach((block) => {
    if (block.media_type === "audio") blocks.push(mediaBlock(block.id, block, "audio", audioPreviewUrls[block.media_index]));
    else if (block.media_type === "video") blocks.push(mediaBlock(block.id, block, "video", videoPreviewUrls[block.media_index]));
    else if (block.image_url || Number.isInteger(block.image_index)) blocks.push(mediaBlock(block.id, block, "image", block.image_url || imagePreviewUrls[block.id]));
    else blocks.push(textBlock(block.id, block.text || "New text", block));
  });

  return <div ref={canvasRef} className="poster editor-canvas" aria-label="Capsule poster canvas" tabIndex="0" style={{ backgroundColor: design.theme.background_color, color: design.theme.accent_color }} data-font={design.theme.font}>{blocks}</div>;
}

const roots = new WeakMap();
export function render(element, props) {
  let root = roots.get(element);
  if (!root) { root = createRoot(element); roots.set(element, root); }
  // create.js reads the canvas synchronously after its state callbacks.
  flushSync(() => root.render(<PosterIsland {...props} />));
}
