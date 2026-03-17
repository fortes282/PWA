import { SkeletonStats } from "@/components/Skeleton";
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" />
        <SkeletonStats count={4} />
      </div>
    </div>
  );
}
