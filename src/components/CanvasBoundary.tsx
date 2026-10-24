"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps a WebGL failure inside the canvas it came from.
 *
 * three.js throws `Error creating WebGL context` when it can't get one — a
 * blocked or disabled GPU, a locked-down enterprise browser, headless Chrome
 * without a software renderer. `/play` has always had that failure mode, and
 * the symptom used to be a dead page: one route broken, the rest of the site
 * fine, because reaching `/play` meant loading a document.
 *
 * **Then `/play` went behind the easter egg**, and the only way in became a
 * client navigation from `/`. Same throw, much worse blast radius — it
 * propagates past the route and tears down the React root, so the whole tab
 * goes blank and Back can't bring `/` back either. Measured in headless Chrome
 * with no `--use-angle=swiftshader`: `document.body` with nothing in it but
 * `<script>` tags, before and after Back.
 *
 * A boundary is the only thing that stops that, and it has to be a class —
 * `getDerivedStateFromError` has no hook equivalent, and
 * `react-error-boundary` would be a fourth runtime dependency for twenty
 * lines.
 *
 * It deliberately says what went wrong rather than hiding it. A visitor whose
 * browser can't do WebGL should be told that, not shown an empty box; it's the
 * same call `Model3D`'s `loading` state makes about the gap before the chunk
 * arrives.
 */
export default class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="t-meta py-10 text-center">
          This browser couldn&rsquo;t open a WebGL canvas, so the model
          can&rsquo;t render here.
        </p>
      );
    }
    return this.props.children;
  }
}
