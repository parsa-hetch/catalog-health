import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// افزودن action برای هندل کردن درخواست‌های POST احتمالی در پروسه OAuth
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// این خط بسیار حیاتی است: خطاهای ریدارکت شاپفای را کنترل می‌کند تا ۵۰۰ ندهد
export const ErrorBoundary = boundary.error;

// یک کامپوننت خالی به عنوان پیش‌فرض، تا React Router موقع رندر مسیر گیج نشود
export default function Auth() {
  return null;
}