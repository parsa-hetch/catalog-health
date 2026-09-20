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

// این کامپوننت پرتاب‌های ریدارکت شاپیفای را می‌گیرد و از کرش کردن صفحه جلوگیری می‌کند
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}

export default function Auth() {
  return null;
}