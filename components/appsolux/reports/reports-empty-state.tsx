type ReportsEmptyStateProps = {
  message: string;
};

export function ReportsEmptyState({ message }: ReportsEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
