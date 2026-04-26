import Holidays from 'date-holidays';
const hd = new Holidays('NL');
console.log(hd.isHoliday(new Date('2026-12-25')));
