
import { useEffect, useState, useCallback } from "react";
import { subscribeToLastBibleBookmark, saveLastBibleBookmark } from "../firebaseSync";

export default function useBibleBookmark(uid) {
  const [bookmark, setBookmark] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setBookmark(null);
      setLoading(false);
      return;
    }
    const unsub = subscribeToLastBibleBookmark(uid, data => {
      setBookmark(data);
      setLoading(false);
    });
    return () => { try{unsub&&unsub();}catch(e){} };
  }, [uid]);

  const saveBookmark = useCallback(async (data) => {
    if (!uid) return;
    await saveLastBibleBookmark(uid, data);
  }, [uid]);

  return { bookmark, loading, saveBookmark };
}
