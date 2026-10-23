import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Layout } from "@/components/Layout";
import DiscoverPage from "@/pages/DiscoverPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { Skeleton } from "@/components/ui/skeleton";

const EventPage = lazy(() => import("@/pages/EventPage"));
const StatsPage = lazy(() => import("@/pages/StatsPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const fallback = (
  <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-10 sm:px-6 lg:px-8" role="status" aria-label="Loading">
    <Skeleton className="h-10 w-2/3" />
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-64 w-full" />
  </div>
);
const lazyEl = (el: React.ReactNode) => <Suspense fallback={fallback}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DiscoverPage /> },
      { path: "events/:eventCode", element: lazyEl(<EventPage />) },
      { path: "insights", element: lazyEl(<StatsPage />) },
      { path: "stats", element: <Navigate to="/insights" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
