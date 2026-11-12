import { Link } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/brand/Logo";

const NotFound = () => (
  <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
    <div className="bg-grid pointer-events-none absolute inset-0" />
    <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />
    <div className="relative space-y-6 text-center">
      <Logo className="justify-center" />
      <p className="text-gradient font-display text-8xl font-bold sm:text-9xl">404</p>
      <div>
        <h1 className="text-2xl font-bold">This road doesn't lead anywhere</h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for has moved or never existed.</p>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/"><ArrowLeft /> Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/stations"><MapPin /> Find stations</Link>
        </Button>
      </div>
    </div>
  </div>
);

export default NotFound;
