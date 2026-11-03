export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex items-center gap-3 text-sm font-medium text-muted">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
        Loading your workspace
      </div>
    </div>
  );
}
