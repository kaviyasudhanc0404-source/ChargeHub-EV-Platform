import { Zap } from "lucide-react";

const PageLoader = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground" role="status">
    <span className="relative mb-4 grid h-12 w-12 place-items-center">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <Zap className="h-5 w-5 fill-primary text-primary" />
    </span>
    <p className="text-sm">{label}</p>
  </div>
);

export default PageLoader;
