import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export function ErrorBoundary() {
  const error = useRouteError() as any;

  // اگر شاپیفای اسکریپتِ ریدارکت App Bridge را پرتاب کرده باشد، ما آن را مستقیماً در HTML رندر می‌کنیم تا مرورگر آن را اجرا کند
  if (error && error.data && typeof error.data === "string" && error.data.includes("app-bridge.js")) {
    return (
      <div dangerouslySetInnerHTML={{ __html: error.data }} />
    );
  }

  // نمایش سایر خطاهای احتمالی
  return (
    <div style={{ padding: "2rem", color: "red", fontFamily: "monospace", direction: "ltr" }}>
      <h2>Unhandled Error</h2>
      <pre>
        {error instanceof Error 
          ? `${error.name}: ${error.message}`
          : JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );
}

export default function Auth() {
  return null;
}