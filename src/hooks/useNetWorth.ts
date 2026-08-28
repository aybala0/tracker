import { useEffect, useState } from "react";

export function useNetWorth() {
  const [data, setData] = useState({ net: 0, checking: 0, cards: 0 });

  useEffect(() => {
    fetch("/api/summary/net-worth")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  return data;
}
