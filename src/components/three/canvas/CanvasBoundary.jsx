import { Component } from "react";

/**
 * Shows `fallback` if the 3D canvas fails to start (no WebGL 2 context: an old
 * or blocklisted GPU, or the browser ran out of contexts) instead of breaking
 * the whole page.
 */
export default class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) console.warn("3D scene failed to start:", error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
