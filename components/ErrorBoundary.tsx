import React from "react";
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

Bugsnag.start({
    apiKey: "64e770e7c1fa67c74c6a5e2f2e93512e",
    plugins: [new BugsnagPluginReact()],
    enabledReleaseStages: [ 'production' ],
    releaseStage: process.env.NODE_ENV
  });

export const ErrorBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);
