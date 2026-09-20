import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      "s-link": React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
    }
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Overview</s-link>
        <s-link href="/app/issues">Issues</s-link>
        <s-link href="/app/scan">Scan</s-link>
        <s-link href="/app/scans">Scan History</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError() as any;
  console.error("🔥 DASHBOARD CRASH:", error);

  // اجازه می‌دهیم شاپفای ریدارکت‌های امنیتی خودش را هندل کند
  if (isRouteErrorResponse(error) || (error && error.status)) {
    return boundary.error(error);
  }

  // نمایش خطاهای مربوط به کدهای شما در یک باکس قرمز واضح
  return (
    <div style={{ padding: "2rem", backgroundColor: "#ffebee", color: "#b71c1c", margin: "1rem", borderRadius: "8px", direction: "ltr", fontFamily: "monospace" }}>
      <h2>Application UI Crash!</h2>
      <p>The app is authenticated, but a bug in your React code/loaders caused a crash:</p>
      <pre style={{ overflowX: "auto", marginTop: "1rem", backgroundColor: "#fff", padding: "1rem", borderRadius: "4px" }}>
        {error instanceof Error 
          ? `${error.name}: ${error.message}\n\n${error.stack}`
          : JSON.stringify(error, null, 2)
        }
      </pre>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};