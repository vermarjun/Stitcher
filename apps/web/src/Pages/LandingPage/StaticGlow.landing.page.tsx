import React, { useEffect, useRef } from "react";
import { Renderer, Triangle, Program, Mesh } from "ogl";

/**
 * StaticGlow — the initial cyan-glow shader, rendered ONCE and frozen.
 *
 * The whole heat problem is *continuous* WebGL: a shader that re-renders every
 * frame keeps the GPU awake. This draws a single frame on mount (and again only
 * if the container resizes), then stops entirely — no requestAnimationFrame, no
 * per-frame work. `preserveDrawingBuffer` keeps that one frame on screen. It's a
 * real shader (soft cyan glow at top fading to black, with subtle grain) but
 * costs the same as a static image afterwards: nothing. It cannot heat or lag.
 */
const StaticGlow: React.FC<{ maxDPR?: number }> = ({ maxDPR = 1.5 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, maxDPR));
    const renderer = new Renderer({
      dpr,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true, // keep the single frame visible after we stop
    });
    const gl = renderer.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);

    Object.assign(gl.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    container.appendChild(gl.canvas);

    const vertex = /* glsl */ `
      attribute vec2 position;
      void main(){ gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fragment = /* glsl */ `
      precision highp float;
      uniform vec2 uResolution;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uResolution.xy;       // y: 0 bottom -> 1 top
        float aspect = uResolution.x / max(uResolution.y, 1.0);

        // soft cyan glow near the top-centre
        vec2 d = uv - vec2(0.5, 0.84);
        d.x *= aspect * 0.42;   // widen horizontally
        d.y *= 1.15;
        float glow = pow(smoothstep(0.95, 0.0, length(d)), 1.5);
        float vert = pow(smoothstep(-0.1, 1.0, uv.y), 1.3);  // brighter up top
        float n = noise(uv * vec2(2.0, 3.0));                // subtle grain
        float a = clamp(glow * vert + 0.05 * n * vert * glow, 0.0, 1.0);

        vec3 deep  = vec3(0.0, 0.05, 0.08);
        vec3 cyan  = vec3(0.0, 0.70, 0.92);
        vec3 white = vec3(0.80, 0.97, 1.0);
        vec3 col = mix(deep, cyan, smoothstep(0.0, 0.55, a));
        col = mix(col, white, smoothstep(0.62, 1.0, a));
        col *= a;  // fade to black where unlit

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const geometry = new Triangle(gl);
    const resBuf = new Float32Array(2);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: { uResolution: { value: resBuf } },
    });
    const mesh = new Mesh(gl, { geometry, program });

    // Draw exactly one frame; redraw only on resize. No animation loop.
    const renderOnce = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      resBuf[0] = gl.drawingBufferWidth;
      resBuf[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };
    const ro = new ResizeObserver(renderOnce);
    ro.observe(container);
    renderOnce();

    return () => {
      ro.disconnect();
      try {
        container.removeChild(gl.canvas);
      } catch {
        /* detached */
      }
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    };
  }, [maxDPR]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default StaticGlow;
