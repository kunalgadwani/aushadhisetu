"use client";

import { useMemo, useState } from "react";

interface CatalogueModalProps<T extends { name: string }> {
  title: string;
  items: T[];
  onClose: () => void;
  onSelect: (item: T) => void;
  renderMeta?: (item: T) => string;
}

export function CatalogueModal<T extends { name: string }>({
  title,
  items,
  onClose,
  onSelect,
  renderMeta,
}: CatalogueModalProps<T>) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(20);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((item) => item.name.toLowerCase().includes(q))
      : items;
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <input
          autoFocus
          className="search-input"
          onChange={(event) => {
            setQuery(event.target.value);
            setVisible(20);
          }}
          placeholder="Search by name"
          value={query}
        />
        <ul className="catalog-list">
          {filtered.slice(0, visible).map((item) => (
            <li key={item.name}>
              <button type="button" onClick={() => onSelect(item)}>
                <strong>{item.name}</strong>
                {renderMeta && <span>{renderMeta(item)}</span>}
              </button>
            </li>
          ))}
        </ul>
        {visible < filtered.length && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setVisible((value) => value + 20)}
          >
            Load 20 more
          </button>
        )}
        {filtered.length === 0 && <p className="empty-note">No matching entries.</p>}
      </div>
    </div>
  );
}
