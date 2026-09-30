const assert=require('node:assert/strict');
require('../../frontend/planner/calendar.js');
const {date,key,addDays,monday,occurs,isPastDate}=globalThis.StudentCalendar;
const once={event_date:'2027-01-10',recurrence:'none',day:6};
assert(occurs(once,date('2027-01-10')));
assert(!occurs(once,date('2027-01-17')));
const weekly={event_date:'2026-09-28',recurrence:'weekly',day:0,repeat_until:'2026-10-12'};
assert(!occurs(weekly,date('2026-09-21')));
assert(occurs(weekly,date('2026-09-28')));
assert(occurs(weekly,date('2026-10-05'))); // Sydney daylight saving transition
assert(occurs(weekly,date('2026-10-12')));
assert(!occurs(weekly,date('2026-10-19')));
assert(!occurs(weekly,date('2026-10-06')));
assert(occurs({day:0},date('2027-08-02'))); // Preserved legacy weekly series
assert.equal(key(addDays(date('2026-12-31'),1)),'2027-01-01');
assert.equal(key(addDays(date('2028-02-28'),1)),'2028-02-29');
assert.equal(key(monday(date('2027-01-03'))),'2026-12-28');
const today = new Date(2026,8,20,23,59);
assert(isPastDate(date('2026-09-19'),today));
assert(!isPastDate(date('2026-09-20'),today)); // Today stays clear even late at night.
assert(!isPastDate(date('2026-09-21'),today));
assert(isPastDate(date('2026-12-31'),new Date(2027,0,1,0,0)));
assert(!isPastDate(date('2027-01-01'),new Date(2027,0,1,0,0)));
assert(isPastDate(date('2026-10-04'),date('2026-10-05'))); // Sydney DST.
assert(isPastDate(date('2026-09-28'),date('2026-10-01')));
assert(!isPastDate(date('2026-10-05'),date('2026-10-01'))); // Same weekly series, future occurrence.
console.log('PASS calendar dates: one-off, weekly bounds, weekends, DST, leap year, year boundary and past-date fading');
