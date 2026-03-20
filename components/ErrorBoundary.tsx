import React from "react";

const isProduction = process.env.NODE_ENV === "production";

class FallbackErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

function createErrorBoundary(): React.ComponentType<{ children: React.ReactNode }> {
  if (isProduction && typeof window !== "undefined") {
    const Bugsnag = require("@bugsnag/js").default;
    const BugsnagPluginReact = require("@bugsnag/plugin-react").default;

    if (!Bugsnag.isStarted()) {
      Bugsnag.start({
        apiKey: "64e770e7c1fa67c74c6a5e2f2e93512e",
        plugins: [new BugsnagPluginReact()],
        enabledReleaseStages: ["production"],
        releaseStage: process.env.NODE_ENV,
      });
    }

    return Bugsnag.getPlugin("react")!.createErrorBoundary(React);
  }

  return FallbackErrorBoundary;
}

export const ErrorBoundary = createErrorBoundary();
