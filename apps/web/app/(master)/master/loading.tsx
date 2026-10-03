import { Skeleton } from "@/components/ui";

export default function MasterLoading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 p-4">
      <Skeleton className="h-18" />
      <Skeleton className="h-18" />
      <Skeleton className="h-18" />
    </main>
  );
}
