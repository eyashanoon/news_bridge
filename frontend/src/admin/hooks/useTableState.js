import { useMemo, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

const DEFAULT_SORT = { key: null, direction: "asc" };

export function useTableState({
  initialSearch = "",
  initialFilters = {},
  initialPage = 0,
  initialPageSize = 20,
  initialSort = DEFAULT_SORT,
  debounceMs = 300,
} = {}) {
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [sort, setSort] = useState(initialSort);

  const debouncedSearch = useDebouncedValue(search, debounceMs);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const resetFilters = () => {
    setSearch("");
    setFilters(initialFilters);
    setPage(0);
    setSort(initialSort);
  };

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const queryState = useMemo(
    () => ({ search: debouncedSearch, filters, page, pageSize, sort }),
    [debouncedSearch, filters, page, pageSize, sort]
  );

  return {
    search,
    setSearch,
    debouncedSearch,
    filters,
    setFilter,
    setFilters,
    resetFilters,
    page,
    setPage,
    pageSize,
    sort,
    setSort,
    toggleSort,
    queryState,
  };
}
