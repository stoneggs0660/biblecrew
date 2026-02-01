
export function getMonthDates(year, month) {
  const dates = [];
  const last = new Date(year, month, 0).getDate();
  for (let d=1; d<=last; d++){
    const day = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    dates.push(day);
  }
  return dates;
}
