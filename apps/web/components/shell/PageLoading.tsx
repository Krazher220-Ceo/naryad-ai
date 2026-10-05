import { Skeleton } from "@/components/ui";

// Мгновенный отклик на нажатие: каркас остаётся, вместо экрана — заглушки,
// пока сервер готовит данные (loading.tsx в разделах ролей).
export function PageLoading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-xl flex-col gap-3 p-4 lg:max-w-5xl lg:py-8">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </main>
  );
}
