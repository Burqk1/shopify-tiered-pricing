/**
 * Auth Login Route
 *
 * Handles the login flow for Shopify OAuth.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const errorParam = url.searchParams.get("error");

  if (shop) {
    throw await login(request);
  }

  return json({ shop: null, error: errorParam });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop");

  if (!shop) {
    return json({ error: "Shop domain is required" }, { status: 400 });
  }

  // Reconstruct request with shop parameter
  const url = new URL(request.url);
  url.searchParams.set("shop", shop.toString());

  const newRequest = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });

  throw await login(newRequest);
};

export default function Login() {
  const { error } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Tiered Pricing - Login</title>
        <link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css" />
        <style>{`
          body {
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f6f6f7;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .login-card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
          }
          h1 { margin: 0 0 1.5rem; font-size: 1.5rem; }
          label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
          input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #c9cccf;
            border-radius: 4px;
            font-size: 1rem;
            box-sizing: border-box;
          }
          button {
            width: 100%;
            margin-top: 1rem;
            padding: 0.75rem;
            background: #008060;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
          }
          button:hover { background: #006e52; }
          .error { color: #d72c0d; margin-bottom: 1rem; }
        `}</style>
      </head>
      <body>
        <div className="login-card">
          <h1>Tiered Pricing</h1>
          {error && <div className="error">{error}</div>}
          <Form method="post">
            <label htmlFor="shop">Shop Domain</label>
            <input
              type="text"
              id="shop"
              name="shop"
              placeholder="your-store.myshopify.com"
              required
            />
            <button type="submit">Log in</button>
          </Form>
        </div>
      </body>
    </html>
  );
}
