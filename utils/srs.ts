export type SrsGrade = 'again' | 'good';

export type SrsState = {
  ease: number; // EF in SM-2, typical 1.3 ~ 3.0
  interval: number; // days
  reps: number; // successful repetitions in a row
  lapses: number; // number of failures
  due: number; // epoch ms
};

export function defaultSrs(now: number): SrsState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

export function isDue(state: SrsState, now: number): boolean {
  return state.due <= now;
}

// SM-2 lite: only two grades (again/good)
export function updateSrs(prev: SrsState, grade: SrsGrade, now: number): SrsState {
  let { ease, interval, reps, lapses } = prev;
  if (grade === 'again') {
    lapses += 1;
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
    interval = 1; // schedule for tomorrow
  } else {
    // correct
    if (reps === 0) interval = 1; // first success
    else if (reps === 1) interval = 6; // second success
    else interval = Math.max(1, Math.round(interval * ease));
    reps += 1;
    ease = Math.min(3.0, ease + 0.05);
  }
  const due = now + interval * 24 * 60 * 60 * 1000;
  return { ease, interval, reps, lapses, due };
}

