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

// کامپوننت جدید برای شکار خطای دقیق
export function ErrorBoundary() {
  const error = useRouteError();
  
  // ثبت خطا در لاگ‌های سرور پاستا
  console.error("🔥 SHOPIFY OAUTH FATAL ERROR:", error);

  // نمایش خطای واقعی روی صفحه مرورگر به جای [object Object]
  return (
    <div style={{ padding: "2rem", color: "red", fontFamily: "monospace", direction: "ltr" }}>
      <h2>OAuth Authentication Error</h2>
      <pre style={{ background: "#f8d7da", padding: "1rem", borderRadius: "5px", overflow: "auto" }}>
        {error instanceof Error 
          ? `${error.name}: ${error.message}\n\n${error.stack}`
          : JSON.stringify(error, null, 2)
        }
      </pre>
    </div>
  );
}

export default function Auth() {
  return null;
}