import { useEffect, useState } from "react";
import { getFeedback } from "../api";

export function AdminPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getFeedback(user).then((response) => setFeedback(response.feedback)).catch((requestError) => setError(requestError.message));
  }, [user]);

  const keyword = search.trim().toLowerCase();
  const visibleFeedback = feedback.filter((item) =>
    item.message.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword)
  );

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
        <p>A simple view of feedback received from members of the public.</p>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <label htmlFor="feedback-search">
          Search feedback
          <input
            id="feedback-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search messages or citizen names"
          />
        </label>
        {search && <button type="button" className="text-button" onClick={() => setSearch("")}>Clear search</button>}
        <div className="list-header">
          <strong>Latest feedback</strong>
          <span role="status">{keyword ? `${visibleFeedback.length} of ${feedback.length} items` : `${feedback.length} items`}</span>
        </div>
        {keyword && visibleFeedback.length === 0 && !error && (
          <p className="muted">No feedback matches “{search.trim()}”. Try another message keyword or citizen name, or clear the search.</p>
        )}
        {visibleFeedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">{item.name} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <p>{item.message}</p>
            </div>
            <span className="status-pill">{item.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
