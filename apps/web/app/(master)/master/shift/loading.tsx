import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Skeleton className="h-10" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}
