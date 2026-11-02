"use client";

import {
  Bounds,
  ContactShadows,
  Edges,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useBounds,
} from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import type { Group } from "three";

import type { BuildSlot } from "@/generated/prisma/enums";
import type { Finish, Scene, SceneShape, ScenePart, Tone } from "@/lib/builder/scene";

// The WebGL view of a build. Everything it draws comes from buildScene();
// this file only turns that into meshes, materials and pointer events.
// Units are millimetres (the camera is set up for that).

export type PcSceneProps = {
  scene: Scene;
  selected: BuildSlot | "CASE" | null;
  hovered: BuildSlot | "CASE" | null;
  errorSlots: ReadonlySet<string>;
  exploded: boolean;
  reducedMotion: boolean;
  resetSignal: number;
  ghostLabels: Partial<Record<BuildSlot | "CASE", string>>;
  // A layer over the canvas, owned by the page, that the "+ Part" labels are
  // drawn into. Inside the canvas's own container they break when the page
  // unmounts it.
  labelLayer: RefObject<HTMLDivElement | null>;
  onSelect: (slot: BuildSlot | "CASE") => void;
  onHover: (slot: BuildSlot | "CASE" | null) => void;
};

const ACCENT = "#38bdf8";
const ERROR = "#f87171";

function toneColor(tone: Tone, finish: Finish): string {
  const white = finish === "white";
  switch (tone) {
    case "body":
      return white ? "#e6eaf0" : finish === "black" ? "#2a2f38" : "#363d4a";
    case "pcb":
      return "#22392f";
    case "metal":
      return white ? "#d5dbe3" : "#9aa4b3";
    case "dark":
      return white ? "#d9dee6" : "#1a1e26";
    case "light":
      return "#e6eaf0";
    case "accent":
      return "#7dd3fc";
    case "chip":
      return "#a3adbb";
  }
}

export default function PcScene(props: PcSceneProps) {
  const [D, H, W] = props.scene.caseDims;
  const distance = Math.max(D, H) * 2.1;

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{
        position: [-distance * 0.45, distance * 0.3, distance * 0.85],
        fov: 35,
        near: 10,
        far: 8000,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onHover(null)}
    >
      <color attach="background" args={["#0b1018"]} />
      <hemisphereLight args={["#dbeafe", "#0b1018", 1.1]} />
      <directionalLight position={[-400, 700, 900]} intensity={2.4} />
      <directionalLight position={[600, 200, -500]} intensity={0.8} color="#93c5fd" />
      {/* Studio-style reflections, generated locally (no image downloads). */}
      <Environment resolution={128} near={10} far={20000}>
        <Lightformer intensity={2.5} position={[0, 2500, 1500]} scale={[3000, 1500, 1]} />
        <Lightformer
          intensity={1.2}
          position={[-3000, 500, 0]}
          rotation-y={Math.PI / 2}
          scale={[2000, 2000, 1]}
        />
        <Lightformer
          intensity={0.8}
          color="#7dd3fc"
          position={[3000, 0, -1000]}
          rotation-y={-Math.PI / 2}
          scale={[2000, 1200, 1]}
        />
      </Environment>
      {/* The case's own lighting, so the inside reads through the glass. */}
      <pointLight
        position={[0, H / 2 - 40, W / 2 - 30]}
        intensity={0.9}
        decay={0}
        color="#e0f2fe"
      />

      {/* Bounds measures from the centre, so leave room for the near corner
          of a case seen at an angle. */}
      <Bounds fit clip observe margin={1.6}>
        <CaseShell {...props} />
        {props.scene.parts.map((part) => (
          <PartMesh key={part.slot} part={part} {...props} />
        ))}
        <FitOnReset resetSignal={props.resetSignal} />
      </Bounds>

      <ContactShadows
        key={props.scene.caseSize}
        position={[0, -H / 2 - 1, 0]}
        scale={Math.max(D, W) * 2.5}
        opacity={0.55}
        blur={2.4}
        far={H}
        frames={1}
      />
      <Controls distance={distance} resetSignal={props.resetSignal} />
    </Canvas>
  );
}

// "Reset view": back to a view that fits the whole PC on screen.
function FitOnReset({ resetSignal }: { resetSignal: number }) {
  const bounds = useBounds();
  useEffect(() => {
    if (resetSignal) bounds.refresh().clip().fit();
  }, [resetSignal, bounds]);
  return null;
}

function Controls({ distance }: { distance: number; resetSignal: number }) {
  return (
    <OrbitControls
      makeDefault
      enableDamping
      enablePan={false}
      minDistance={distance * 0.45}
      maxDistance={distance * 1.6}
      maxPolarAngle={Math.PI * 0.82}
    />
  );
}

// Moves a part towards its exploded position, a little each frame.
function useExplode(
  part: { explode: [number, number, number] },
  exploded: boolean,
  instant: boolean,
) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const target = exploded ? part.explode : [0, 0, 0];
    let moving = false;
    (["x", "y", "z"] as const).forEach((axis, i) => {
      const delta = target[i] - g.position[axis];
      if (Math.abs(delta) < 0.5 || instant) g.position[axis] = target[i];
      else {
        g.position[axis] += delta * 0.18;
        moving = true;
      }
    });
    if (moving) invalidate();
  });
  // Kick off a frame when the target changes.
  useEffect(() => invalidate(), [exploded, invalidate]);
  return group;
}

function pointerHandlers(
  slot: BuildSlot | "CASE",
  onSelect: PcSceneProps["onSelect"],
  onHover: PcSceneProps["onHover"],
) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(slot);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(slot);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
  };
}

function PartMesh({
  part,
  selected,
  hovered,
  errorSlots,
  exploded,
  reducedMotion,
  ghostLabels,
  labelLayer,
  onSelect,
  onHover,
}: { part: ScenePart } & PcSceneProps) {
  const group = useExplode(part, exploded, reducedMotion);
  const isSelected = selected === part.slot;
  const isHovered = hovered === part.slot;
  const hasError = errorSlots.has(part.slot);
  const glow = hasError ? ERROR : ACCENT;
  const glowIntensity = isSelected ? 0.55 : isHovered ? 0.3 : hasError ? 0.35 : 0;

  return (
    <group ref={group} {...pointerHandlers(part.slot, onSelect, onHover)}>
      {part.ghost ? (
        <>
          <mesh position={part.center}>
            <boxGeometry args={part.size} />
            <meshBasicMaterial
              color={ACCENT}
              transparent
              opacity={isSelected ? 0.28 : isHovered ? 0.2 : 0.08}
              depthWrite={false}
            />
            <Edges color={ACCENT} />
          </mesh>
          {ghostLabels[part.slot] && (
            <Html
              position={part.label}
              center
              zIndexRange={[20, 0]}
              portal={labelLayer as RefObject<HTMLElement>}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(part.slot)}
                className="pointer-events-auto rounded-full border border-accent/60 bg-background/85 px-2 py-0.5 text-[11px] whitespace-nowrap text-accent backdrop-blur"
              >
                + {ghostLabels[part.slot]}
              </button>
            </Html>
          )}
        </>
      ) : (
        part.shapes.map((shape, i) => (
          <Shape
            key={i}
            shape={shape}
            finish={part.finish}
            glow={glowIntensity > 0 ? glow : null}
            glowIntensity={glowIntensity}
          />
        ))
      )}
      {!part.ghost && isSelected && (
        <mesh position={part.center} raycast={() => null}>
          <boxGeometry args={[part.size[0] + 8, part.size[1] + 8, part.size[2] + 8]} />
          <meshBasicMaterial visible={false} />
          <Edges color={hasError ? ERROR : ACCENT} />
        </mesh>
      )}
    </group>
  );
}

function Shape({
  shape,
  finish,
  glow,
  glowIntensity,
}: {
  shape: SceneShape;
  finish: Finish;
  glow: string | null;
  glowIntensity: number;
}) {
  const color = toneColor(shape.tone, finish);
  const accent = shape.tone === "accent";
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={shape.tone === "metal" ? 0.35 : 0.6}
      metalness={shape.tone === "metal" || shape.tone === "chip" ? 0.6 : 0.15}
      emissive={accent ? color : (glow ?? "#000000")}
      emissiveIntensity={accent ? 1.2 : glowIntensity}
    />
  );
  if (shape.kind === "box") {
    return (
      <mesh position={shape.position}>
        <boxGeometry args={shape.size} />
        {material}
      </mesh>
    );
  }
  // Fans: a ring with a hub. Cylinders point along y, so turn them to face.
  const rotation: [number, number, number] =
    shape.facing === "x"
      ? [0, 0, Math.PI / 2]
      : shape.facing === "z"
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];
  return (
    <group position={shape.position} rotation={rotation}>
      <mesh>
        <cylinderGeometry args={[shape.radius, shape.radius, 10, 40, 1, true]} />
        {material}
      </mesh>
      <mesh>
        <cylinderGeometry args={[shape.radius * 0.92, shape.radius * 0.92, 4, 40]} />
        <meshStandardMaterial color="#0e1116" roughness={0.8} transparent opacity={0.85} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[shape.radius * 0.3, shape.radius * 0.3, 8, 24]} />
        <meshStandardMaterial
          color={toneColor("body", finish)}
          emissive={glow ?? "#000000"}
          emissiveIntensity={glowIntensity}
        />
      </mesh>
    </group>
  );
}

// The case: solid panels with a glass side towards the viewer. Without a
// case chosen, an outline you can click to pick one.
function CaseShell({
  scene,
  selected,
  hovered,
  errorSlots,
  ghostLabels,
  labelLayer,
  onSelect,
  onHover,
}: PcSceneProps) {
  const [D, H, W] = scene.caseDims;
  const t = 5;
  const handlers = pointerHandlers("CASE", onSelect, onHover);
  const isSelected = selected === "CASE";
  const isHovered = hovered === "CASE";
  const hasError = errorSlots.has("CASE");

  if (!scene.hasCase) {
    return (
      <group {...handlers}>
        <mesh>
          <boxGeometry args={[D, H, W]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={isSelected ? 0.08 : isHovered ? 0.06 : 0.02}
            depthWrite={false}
          />
          <Edges color={ACCENT} />
        </mesh>
        {ghostLabels.CASE && (
          <Html
            position={[0, H / 2 + 24, 0]}
            center
            zIndexRange={[20, 0]}
            portal={labelLayer as RefObject<HTMLElement>}
          >
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onSelect("CASE")}
              className="pointer-events-auto rounded-full border border-accent/60 bg-background/85 px-2 py-0.5 text-[11px] whitespace-nowrap text-accent backdrop-blur"
            >
              + {ghostLabels.CASE}
            </button>
          </Html>
        )}
      </group>
    );
  }

  const color = toneColor("body", scene.caseFinish);
  const glow = hasError ? ERROR : ACCENT;
  const glowIntensity = isSelected ? 0.35 : isHovered ? 0.18 : hasError ? 0.25 : 0;
  const panel = (size: [number, number, number], position: [number, number, number]) => (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.2}
        emissive={glowIntensity ? glow : "#000000"}
        emissiveIntensity={glowIntensity}
      />
    </mesh>
  );
  return (
    <group>
      <group {...handlers}>
        {panel([D, H, t], [0, 0, -W / 2])}
        {panel([D, t, W], [0, H / 2, 0])}
        {panel([D, t, W], [0, -H / 2, 0])}
        {panel([t, H, W], [-D / 2, 0, 0])}
        {panel([t, H, W], [D / 2, 0, 0])}
        {/* Feet */}
        {panel([40, 10, 30], [-D / 2 + 50, -H / 2 - 8, W / 2 - 40])}
        {panel([40, 10, 30], [D / 2 - 50, -H / 2 - 8, W / 2 - 40])}
        {panel([40, 10, 30], [-D / 2 + 50, -H / 2 - 8, -W / 2 + 40])}
        {panel([40, 10, 30], [D / 2 - 50, -H / 2 - 8, -W / 2 + 40])}
      </group>
      {/* Glass: see-through and click-through, so parts inside can be picked. */}
      <mesh position={[0, 0, W / 2]} raycast={() => null}>
        <boxGeometry args={[D, H, 2]} />
        <meshPhysicalMaterial
          color="#bfe3ff"
          transparent
          opacity={0.08}
          roughness={0.05}
          depthWrite={false}
        />
        <Edges color={isSelected ? ACCENT : "#3b4656"} />
      </mesh>
    </group>
  );
}
