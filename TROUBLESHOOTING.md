# AccaBiz - Troubleshooting & Common Issues

This document lists common issues that might occur during development or production, along with their root causes and solutions.

## 🟢 Backend (Fastify & Prisma)

### 1. `401 Unauthorized` on Company Routes
*   **Symptom**: Requests to `/api/company/...` return 401 even when logged in.
*   **Reason**: The `authenticate` hook is missing in `company.routes.ts`.
*   **Solution**: Ensure `fastify.addHook('preHandler', authenticate)` is called before registering routes in `src/modules/company/company.routes.ts`.

### 2. CORS Policy Errors
*   **Symptom**: Browser console shows "Blocked by CORS policy".
*   **Reason**: The frontend domain is not in the allowed origins list.
*   **Solution**: 
    1. Set the `CORS_ORIGINS` environment variable in the backend with a comma-separated list of allowed domains.
    2. Check `src/index.ts` for the `corsOrigins` regex logic.

### 3. Missing/Vanishing Attachments
*   **Symptom**: Files uploaded as attachments (Sales Invoices, LCs) disappear after a server restart.
*   **Reason**: Files are stored in the local `uploads/` directory, which is non-persistent on platforms like Render or Vercel.
*   **Solution**: 
    1. (Recommended) Use an external storage provider (S3, Cloudinary).
    2. Attach a persistent disk to your service and point `uploadsDir` to it.

### 4. Prisma Migration Drift
*   **Symptom**: Errors like `Column "deletedAt" does not exist`.
*   **Reason**: The database schema hasn't been updated to match the Prisma schema.
*   **Solution**: Run `npx prisma migrate deploy` in your production environment (or `npx prisma migrate dev` locally).

### 5. Login Restricted to Demo User
*   **Symptom**: Only `demo@example.com` can log in; others get "Offline mode" error.
*   **Reason**: `SYSTEM_MODE` environment variable is set to `"OFFLINE"`.
*   **Solution**: Change `SYSTEM_MODE` to `"LIVE"` in your `.env` file.

### 6. Generic `500 Internal Server Error`
*   **Symptom**: Backend returns a 500 status without a clear message.
*   **Reason**: Unhandled Prisma error (e.g., Foreign Key violation) falling through the default error handler.
*   **Solution**: Check `src/middleware/errorHandler.ts` and add a specific handler for the Prisma error code (e.g., `P2003` for foreign keys).

---

## 🔵 Frontend (Next.js & Tailwind)

### 1. Requests going to `localhost:5002` in Production
*   **Symptom**: The app works locally but fails in production with "Network Error".
*   **Reason**: `NEXT_PUBLIC_API_URL` is missing from the production environment, causing it to fallback to the local default in `lib/api.ts`.
*   **Solution**: Add `NEXT_PUBLIC_API_URL=https://your-api-url.com` to your production environment variables (e.g., in Render/Vercel dashboard).

### 2. Hydration Mismatches
*   **Symptom**: Text or layout "flickers" on load, or React warning "Text content did not match".
*   **Reason**: Accessing `localStorage`, `window`, or dynamic dates during the initial render before the component has "mounted" on the client.
*   **Solution**: Use the `mounted` state pattern:
    ```tsx
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null; // or a loader
    ```

### 3. Sidebar/Navigation showing wrong Company
*   **Symptom**: The sidebar displays data or links for a different company than the one in the URL.
*   **Reason**: The logic extracting the company ID from the URL path is failing or relying on a stale `active_company_id` in `localStorage`.
*   **Solution**: Clear `localStorage` and ensure the URL path follows the `/company/[uuid]/...` structure.

### 4. Validation Errors not showing on fields
*   **Symptom**: Form submission fails, but no red error messages appear under inputs.
*   **Reason**: The backend returned a validation error in a format that `parseFieldErrors` in `lib/api.ts` doesn't recognize.
*   **Solution**: Debug the response from the backend and update the `parseFieldErrors` function to correctly map the error paths to your form fields.

### 5. Build Failures: "Cannot find module '@/components/...'"
*   **Symptom**: `npm run build` fails with path resolution errors.
*   **Reason**: Incorrect `tsconfig.json` paths or case-sensitivity issues on Linux servers (Render/Vercel).
*   **Solution**: Ensure all imports use the exact casing as the filename and that `paths` in `tsconfig.json` are correctly configured.
