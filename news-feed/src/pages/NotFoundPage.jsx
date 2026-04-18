import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="panel">
      <h3>Page Not Found</h3>
      <p>The route you requested does not exist.</p>
      <Link to="/" className="visit-btn">Back to Home</Link>
    </div>
  );
}