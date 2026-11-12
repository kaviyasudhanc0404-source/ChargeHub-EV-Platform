import { Link } from "react-router-dom";
import Logo from "@/components/brand/Logo";

const COLUMNS = [
  { title: "Drivers", links: [{ to: "/stations", label: "Find stations" }, { to: "/auth?mode=register", label: "Create account" }, { to: "/auth", label: "Sign in" }] },
  { title: "Providers", links: [{ to: "/auth?mode=register&type=provider", label: "List your charger" }, { to: "/#providers", label: "How it works" }] },
];

const Footer = () => (
  <footer className="border-t border-border/70 bg-card/40">
    {/* Phones: brand on top, Drivers and Providers side by side; tablet and up: three columns */}
    <div className="container grid grid-cols-2 gap-x-6 gap-y-8 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:gap-10">
      <div className="col-span-2 max-w-sm space-y-3 md:col-span-1">
        <Logo />
        <p className="text-sm text-muted-foreground">
          Road distances, live availability and simple slot booking for EV drivers across Tamil Nadu and India.
        </p>
      </div>
      {COLUMNS.map((column) => (
        <div key={column.title}>
          <p className="mb-3 text-sm font-semibold text-foreground">{column.title}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {column.links.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="transition-colors hover:text-primary">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-border/70">
      {/* Extra bottom space on phones so the dock never covers this line */}
      <p className="container pb-28 pt-5 text-xs text-muted-foreground md:pb-5">© {new Date().getFullYear()} ChargeHub · Map data © OpenStreetMap contributors</p>
    </div>
  </footer>
);

export default Footer;
