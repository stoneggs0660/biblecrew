import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToHallOfFameYear, subscribeToLegacyMonthlyHallOfFame, saveMonthlyHallOfFame } from '../firebaseSync';
import { db } from '../firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { getMonthDates } from '../utils/dateUtils';
import { CREW_KEYS } from '../utils/crewConfig';

export default function HallOfFame() {
  return (
    <div style={{
      padding: '100px 20px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#555'
    }}>
      &lt;명예의 전당 점검 중&gt;
    </div>
  );
}
