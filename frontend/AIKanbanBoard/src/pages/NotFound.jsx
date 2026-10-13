import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
    <p className="font-display text-8xl font-bold tracking-tight tabular text-gradient">404</p>
    <h1 className="font-display text-2xl font-semibold tracking-tight">Stranica nije pronađena</h1>
    <p className="max-w-sm text-muted">
      Stranica koju tražite ne postoji.
    </p>
    <Link to="/dashboard">
      <Button className="mt-2">Nazad na početnu stranu</Button>
    </Link>
  </div>
);

export default NotFound;
