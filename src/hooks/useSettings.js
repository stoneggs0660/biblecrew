import { useEffect, useState } from 'react';
import { subscribeToSettings } from '../firebaseSync';

export default function useSettings(){
  const [settings, setSettings] = useState(null);

  useEffect(()=>{
    const unsub = subscribeToSettings((s)=>{
      setSettings(s || {});
    });
    return ()=>{
      if(typeof unsub === 'function') unsub();
    };
  },[]);

  return settings;
}
