#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = ['breakfast', 'lunch', 'dinner'];
const BANNED_KEYS = /weight|bmi|diagnos|medication|illness|disease|e-?mail/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ALLOWED_EMAIL = 'hyder286@gmail.com';

function weekdayOf(iso) {
  const bits = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(bits[0], bits[1] - 1, bits[2])).getUTCDay()];
}

function walkKeys(value, at) {
  if (!value || typeof value !== 'object') return;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  keys.forEach(function (key) {
    if (BANNED_KEYS.test(key)) fail(at + ' has a private field "' + key + '"');
    walkKeys(value[key], at + '.' + key);
  });
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { walkKeys(item, at + '[' + index + ']'); });
  }
}

const planPath = path.join(root, 'data', 'plan.json');
let plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (error) {
  console.error('data/plan.json is not valid JSON.');
  console.error(error.message);
  process.exit(1);
}

walkKeys(plan, 'plan');
const planText = fs.readFileSync(planPath, 'utf8');
const planEmails = planText.match(EMAIL) || [];
planEmails.forEach(function (email) {
  fail('data/plan.json contains an email address (' + email + ')');
});

if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
  fail('plan.weeks must be a non-empty array');
}

const seenDates = new Set();
(plan.weeks || []).forEach(function (week, weekIndex) {
  const where = 'weeks[' + weekIndex + ']';
  if (!week.id) fail(where + ' needs an id');
  if (!Array.isArray(week.days) || week.days.length === 0) fail(where + ' needs days');
  (week.days || []).forEach(function (day, dayIndex) {
    const at = where + '.days[' + dayIndex + ']';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) fail(at + ' date must be YYYY-MM-DD');
    else if (day.weekday !== weekdayOf(day.date)) {
      fail(at + ' weekday should be ' + weekdayOf(day.date) + ' for ' + day.date);
    }
    if (seenDates.has(day.date)) fail(at + ' repeats the date ' + day.date);
    seenDates.add(day.date);
    SLOTS.forEach(function (slot) {
      const meal = day.meals && day.meals[slot];
      const mealAt = at + '.meals.' + slot;
      if (!meal) {
        fail(mealAt + ' is missing');
        return;
      }
      if (!meal.name) fail(mealAt + ' needs a name');
      if (!Array.isArray(meal.ingredients) || meal.ingredients.length === 0) fail(mealAt + ' needs ingredients');
      (meal.ingredients || []).forEach(function (item, index) {
        if (!item.item || !item.qty) fail(mealAt + '.ingredients[' + index + '] needs item and qty');
      });
      if (!Array.isArray(meal.steps) || meal.steps.some(function (step) { return typeof step !== 'string' || !step.trim(); })) {
        fail(mealAt + ' needs steps as text');
      }
      ['raja', 'laurence'].forEach(function (person) {
        if (!meal.portions || typeof meal.portions[person] !== 'string' || !meal.portions[person].trim()) {
          fail(mealAt + ' needs portions.' + person);
        }
      });
      if (!Number.isFinite(Number(meal.kcal))) fail(mealAt + ' needs an estimated kcal number');
    });
  });
  if (!Array.isArray(week.shopping) || week.shopping.length === 0) fail(where + ' needs a shopping list');
  const lines = new Set();
  (week.shopping || []).forEach(function (aisle, aisleIndex) {
    const at = where + '.shopping[' + aisleIndex + ']';
    if (!aisle.aisle) fail(at + ' needs an aisle');
    if (!Number.isFinite(Number(aisle.estimatedCost))) fail(at + ' needs estimatedCost as a number');
    if (!Array.isArray(aisle.items) || aisle.items.length === 0) fail(at + ' needs items');
    (aisle.items || []).forEach(function (item, index) {
      if (!item.item || !item.qty) fail(at + '.items[' + index + '] needs item and qty');
      const key = aisle.aisle + '|' + item.item + '|' + item.qty;
      if (lines.has(key)) fail(at + ' repeats ' + item.item);
      lines.add(key);
    });
  });
});

['index.html', 'app.js', 'styles.css', 'README.md'].forEach(function (file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const found = text.match(EMAIL) || [];
  found.forEach(function (email) {
    if (email.toLowerCase() !== ALLOWED_EMAIL) fail(file + ' has an unexpected email ' + email);
  });
});

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
if (app.indexOf('DIET feedback: ') === -1) fail('app.js subject must start with "DIET feedback: "');
if (app.indexOf(ALLOWED_EMAIL) === -1) fail('app.js is missing the feedback address');
if (app.indexOf('Europe/London') === -1) fail('app.js should use the Europe/London date');

if (errors.length) {
  console.error('plan check failed:');
  errors.forEach(function (message) { console.error('- ' + message); });
  process.exit(1);
}

console.log('plan.json looks good (' + seenDates.size + ' days).');
