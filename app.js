// Notes open an email. This is the only personal address on the site.
const FEEDBACK_EMAIL = 'hyder286@gmail.com';
const STORAGE_KEY = 'meal-plan-shopping-v1';
const SLOTS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
];

const view = document.getElementById('view');
const live = document.getElementById('live');
let plan = null;

function el(tag, props) {
  const node = document.createElement(tag);
  const children = Array.prototype.slice.call(arguments, 2);
  if (props) {
    Object.keys(props).forEach(function (key) {
      const value = props[key];
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, value === true ? '' : String(value));
    });
  }
  children.forEach(function (child) { append(node, child); });
  return node;
}

function append(node, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) {
    child.forEach(function (item) { append(node, item); });
    return;
  }
  node.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

function londonISODate(dayOffset) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = function (type) {
    return Number(parts.find(function (part) { return part.type === type; }).value);
  };
  const utc = new Date(Date.UTC(pick('year'), pick('month') - 1, pick('day') + (dayOffset || 0)));
  return utc.toISOString().slice(0, 10);
}

function dateFromISO(iso) {
  const bits = iso.split('-').map(Number);
  return new Date(Date.UTC(bits[0], bits[1] - 1, bits[2]));
}

function formatDay(iso, options) {
  return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: 'UTC' }, options)).format(dateFromISO(iso));
}

function longDate(iso) {
  return formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' });
}

function shortRange(start, end) {
  const sameMonth = formatDay(start, { month: 'short' }) === formatDay(end, { month: 'short' });
  if (sameMonth) {
    return formatDay(start, { day: 'numeric' }) + '–' + formatDay(end, { day: 'numeric', month: 'short' });
  }
  const opts = { day: 'numeric', month: 'short' };
  return formatDay(start, opts) + ' – ' + formatDay(end, opts);
}

function weekRange(week) {
  if (!week.days.length) return week.name || 'Week';
  return shortRange(week.days[0].date, week.days[week.days.length - 1].date);
}

function personName(key) {
  const known = { raja: 'Raja', laurence: 'Laurence' };
  const lower = String(key).toLowerCase();
  if (known[lower]) return known[lower];
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mealFor(day, slot) {
  const meals = day.meals || {};
  if (meals[slot]) return meals[slot];
  const found = Object.keys(meals).find(function (key) { return key.toLowerCase() === slot; });
  return found ? meals[found] : null;
}

function portionEntries(portions) {
  if (!portions || typeof portions !== 'object') return [];
  const order = { raja: 0, laurence: 1 };
  return Object.keys(portions)
    .filter(function (key) { return String(portions[key]).trim(); })
    .sort(function (a, b) {
      const ia = order[a.toLowerCase()];
      const ib = order[b.toLowerCase()];
      return (ia == null ? 9 : ia) - (ib == null ? 9 : ib);
    })
    .map(function (key) { return { name: personName(key), text: String(portions[key]) }; });
}

function kcalLabel(kcal) {
  const number = Number(kcal);
  if (!Number.isFinite(number)) return '';
  return 'About ' + Math.round(number) + ' kcal (estimate)';
}

function money(amount, currency) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount);
}

function loadChecks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    return {};
  }
}

function saveChecks(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

function routeFromHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!raw) return null;
  const bits = raw.split('/');
  const route = bits[0];
  if (['today', 'tomorrow', 'week', 'shop'].indexOf(route) === -1) return null;
  return { route: route, weekId: bits[1] || null };
}

function findDay(iso) {
  for (let i = 0; i < plan.weeks.length; i += 1) {
    const week = plan.weeks[i];
    const day = week.days.find(function (item) { return item.date === iso; });
    if (day) return { week: week, day: day };
  }
  return null;
}

function weekById(id) {
  return plan.weeks.find(function (week) { return week.id === id; }) || null;
}

function defaultWeek() {
  const today = findDay(londonISODate(0));
  return (today && today.week) || plan.weeks[0];
}

function buildMailto(options) {
  const subject = options.mealLabel
    ? 'DIET feedback: ' + options.date + ' ' + options.mealLabel
    : 'DIET feedback: ' + options.date + ' general';
  const lines = [];
  if (options.mealLabel) {
    lines.push(options.mealName ? options.mealLabel + ': ' + options.mealName : options.mealLabel);
  } else {
    lines.push('General note');
  }
  lines.push(options.date);
  lines.push('');
  lines.push(options.comment.trim());
  return 'mailto:' + FEEDBACK_EMAIL
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(lines.join('\n'));
}

function feedbackForm(context) {
  const fieldId = context.mealLabel
    ? 'note-' + context.date + '-' + context.mealLabel.toLowerCase()
    : 'note-general';
  const status = el('p', { class: 'form-status', role: 'status' });
  const textarea = el('textarea', {
    id: fieldId,
    rows: context.mealLabel ? '3' : '4',
    maxlength: '1000',
    placeholder: context.mealLabel
      ? 'A swap, a question, or how this meal went'
      : 'A swap, a question, or anything about the plan',
  });
  const link = el('a', {
    class: 'button',
    href: '#note',
    'aria-disabled': 'true',
  }, 'Email this note');

  function currentContext() {
    return {
      date: context.mealLabel ? context.date : londonISODate(0),
      mealLabel: context.mealLabel,
      mealName: context.mealName,
      comment: textarea.value,
    };
  }

  function sync() {
    const comment = textarea.value.trim();
    if (!comment) {
      link.setAttribute('href', '#note');
      link.setAttribute('aria-disabled', 'true');
      return;
    }
    link.setAttribute('href', buildMailto(currentContext()));
    link.removeAttribute('aria-disabled');
    textarea.removeAttribute('aria-invalid');
  }

  textarea.addEventListener('input', sync);
  link.addEventListener('click', function (event) {
    sync();
    if (!textarea.value.trim()) {
      event.preventDefault();
      textarea.setAttribute('aria-invalid', 'true');
      status.textContent = 'Write a note first.';
      textarea.focus();
      return;
    }
    status.textContent = 'Opening your email app…';
  });

  return el('form', {
    class: 'feedback',
    onsubmit: function (event) { event.preventDefault(); },
  },
    el('label', { for: fieldId }, context.mealLabel ? 'Note on this meal' : 'Your note'),
    textarea,
    el('p', { class: 'hint' }, 'Opens your email app. Nothing is saved on this website.'),
    link,
    status
  );
}

function recipeBlock(meal) {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const steps = Array.isArray(meal.steps) ? meal.steps : [];
  if (!ingredients.length && !steps.length) return null;
  const label = ingredients.length && steps.length
    ? 'Ingredients and steps'
    : (ingredients.length ? 'Ingredients' : 'Steps');
  return el('details', { class: 'recipe' },
    el('summary', {}, label),
    el('div', { class: 'recipe-body' },
      ingredients.length ? el('h4', {}, 'Ingredients') : null,
      ingredients.length ? el('ul', { class: 'ingredients' }, ingredients.map(function (row) {
        if (!row || !row.item) return null;
        return el('li', {},
          el('span', {}, row.item),
          row.qty ? el('span', { class: 'qty' }, row.qty) : null
        );
      })) : null,
      steps.length ? el('h4', {}, 'Steps') : null,
      steps.length ? el('ol', { class: 'steps' }, steps.map(function (step) {
        return el('li', {}, step);
      })) : null
    )
  );
}

function mealCard(day, slot, label, meal, level) {
  const portions = portionEntries(meal.portions);
  const kcal = kcalLabel(meal.kcal);
  const title = el(level === 4 ? 'h4' : 'h3', { class: 'meal-name' }, meal.name || label);
  return el('article', { class: 'meal', 'data-slot': slot },
    el('p', { class: 'kicker' }, label),
    title,
    kcal ? el('p', { class: 'kcal' }, kcal) : null,
    portions.length ? el('ul', { class: 'portions' }, portions.map(function (portion) {
      return el('li', { class: 'portion' },
        el('span', { class: 'portion-name' }, portion.name),
        portion.text
      );
    })) : null,
    recipeBlock(meal),
    feedbackForm({
      date: day.date,
      mealLabel: label,
      mealName: meal.name || '',
    })
  );
}

function dayMeals(day, level) {
  return SLOTS.map(function (slot) {
    const meal = mealFor(day, slot[0]);
    if (!meal || !meal.name) return null;
    return mealCard(day, slot[0], slot[1], meal, level);
  }).filter(Boolean);
}

function emptyDay(title, iso) {
  return el('section', { class: 'stack' },
    el('div', {},
      el('h2', {}, title),
      el('p', { class: 'lede' }, longDate(iso))
    ),
    el('div', { class: 'empty' },
      el('p', {}, 'Nothing is written in for ' + title.toLowerCase() + '.'),
      el('p', {}, 'The week view still has every meal that is in the plan.'),
      el('a', { class: 'button', href: '#week' }, 'See the week')
    )
  );
}

function renderDayPage(title, iso) {
  const found = findDay(iso);
  if (!found) {
    view.replaceChildren(emptyDay(title, iso));
    return;
  }
  const meals = dayMeals(found.day, 3);
  view.replaceChildren(el('section', { class: 'stack' },
    el('div', {},
      el('h2', {}, title),
      el('p', { class: 'lede' }, longDate(iso) + (found.week.name ? ' · ' + found.week.name : ''))
    ),
    meals.length ? el('div', { class: 'stack' }, meals) : el('div', { class: 'empty' }, el('p', {}, 'No meals on this day.'))
  ));
}

function weekTabs(selectedId, route) {
  return el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Weeks' },
    plan.weeks.map(function (week) {
      const selected = week.id === selectedId;
      return el('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': selected ? 'true' : 'false',
        onclick: function () { location.hash = route + '/' + encodeURIComponent(week.id); },
      }, week.name || weekRange(week));
    })
  );
}

function renderWeek(weekId) {
  const week = weekById(weekId) || defaultWeek();
  const today = londonISODate(0);
  const tomorrow = londonISODate(1);
  view.replaceChildren(el('section', {},
    el('h2', {}, week.name || 'Week'),
    el('p', { class: 'lede' }, week.days.length
      ? weekRange(week) + '. Tap a meal for ingredients and steps.'
      : 'No days in this week yet.'),
    weekTabs(week.id, 'week'),
    el('div', {}, week.days.map(function (day) {
      const badge = day.date === today
        ? el('span', { class: 'badge' }, 'Today')
        : (day.date === tomorrow ? el('span', { class: 'badge quiet' }, 'Tomorrow') : null);
      return el('section', { class: 'day' },
        el('div', { class: 'day-head' },
          el('h3', { class: 'day-title' }, longDate(day.date)),
          badge
        ),
        el('div', { class: 'stack' }, dayMeals(day, 4))
      );
    }))
  ));
}

function shopKey(week, aisle, item) {
  return [week.id, aisle.aisle, item.item, item.qty || ''].join('|');
}

function renderShop(weekId) {
  const week = weekById(weekId) || defaultWeek();
  const currency = plan.currency || 'GBP';
  const aisles = Array.isArray(week.shopping) ? week.shopping : [];
  const checks = loadChecks();
  let stored = true;
  const boxes = [];

  const progress = el('p', { class: 'progress' }, '0 ticked');
  const meterBar = el('span', {});
  const meter = el('div', {
    class: 'meter',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-label': 'Items ticked',
  }, meterBar);
  const clear = el('button', { type: 'button', class: 'button ghost' }, 'Clear ticks');

  function refresh() {
    const ticked = boxes.filter(function (box) { return box.checked; }).length;
    progress.textContent = ticked + ' of ' + boxes.length + ' ticked';
    meter.setAttribute('aria-valuemax', String(boxes.length));
    meter.setAttribute('aria-valuenow', String(ticked));
    meterBar.style.width = boxes.length ? ((ticked / boxes.length) * 100) + '%' : '0';
    clear.disabled = ticked === 0;
  }

  const aisleNodes = aisles.map(function (aisle) {
    const items = Array.isArray(aisle.items) ? aisle.items : [];
    const cost = Number(aisle.estimatedCost);
    return el('section', { class: 'aisle' },
      el('div', { class: 'aisle-head' },
        el('h3', {}, aisle.aisle || 'Shopping'),
        Number.isFinite(cost) ? el('p', { class: 'aisle-cost' }, 'about ' + money(cost, currency)) : null
      ),
      el('ul', { class: 'shop-list' }, items.map(function (item) {
        if (!item || !item.item) return null;
        const key = shopKey(week, aisle, item);
        const box = el('input', { type: 'checkbox' });
        box.checked = Boolean(checks[key]);
        boxes.push(box);
        const row = el('label', { class: box.checked ? 'shop-item is-ticked' : 'shop-item' },
          box,
          el('span', { class: 'shop-name' }, item.item),
          item.qty ? el('span', { class: 'qty' }, item.qty) : null
        );
        box.addEventListener('change', function () {
          const next = loadChecks();
          if (box.checked) next[key] = true;
          else delete next[key];
          stored = saveChecks(next) && stored;
          row.classList.toggle('is-ticked', box.checked);
          refresh();
          if (!stored) progress.textContent += ' · ticks could not be saved on this phone';
        });
        return el('li', {}, row);
      }))
    );
  });

  clear.addEventListener('click', function () {
    if (!boxes.some(function (box) { return box.checked; })) return;
    if (!window.confirm('Clear the ticks for this week on this phone?')) return;
    const next = loadChecks();
    const prefix = week.id + '|';
    Object.keys(next).forEach(function (key) {
      if (key.indexOf(prefix) === 0) delete next[key];
    });
    saveChecks(next);
    boxes.forEach(function (box) {
      box.checked = false;
      box.closest('.shop-item').classList.remove('is-ticked');
    });
    refresh();
  });

  const pence = aisles.reduce(function (sum, aisle) {
    const cost = Number(aisle.estimatedCost);
    return sum + (Number.isFinite(cost) ? Math.round(cost * 100) : 0);
  }, 0);

  view.replaceChildren(el('section', {},
    el('h2', {}, 'Shopping list'),
    el('p', { class: 'lede' }, (week.name || weekRange(week)) + '. Ticks stay on this phone only.'),
    weekTabs(week.id, 'shop'),
    pence ? el('p', { class: 'total' }, 'About ' + money(pence / 100, currency) + ' for the list') : null,
    el('p', { class: 'hint' }, 'Prices are a rough estimate for the whole list, ticked or not.'),
    boxes.length ? el('div', { class: 'shop-actions' }, progress, clear) : null,
    boxes.length ? meter : null,
    aisleNodes.length ? aisleNodes : el('div', { class: 'empty' }, el('p', {}, 'No shopping list for this week.'))
  ));
  refresh();
}

function renderRoute() {
  if (!plan) return;
  const route = routeFromHash() || { route: 'today', weekId: null };
  document.querySelectorAll('.nav a').forEach(function (link) {
    if (link.dataset.route === route.route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const titles = { today: 'Today', tomorrow: 'Tomorrow', week: 'Week', shop: 'Shopping' };
  if (route.route === 'today') renderDayPage('Today', londonISODate(0));
  else if (route.route === 'tomorrow') renderDayPage('Tomorrow', londonISODate(1));
  else if (route.route === 'week') renderWeek(route.weekId);
  else renderShop(route.weekId);
  document.title = titles[route.route] + ' · Raja & Laurence';
  live.textContent = titles[route.route];
  window.scrollTo(0, 0);
}

function renderNote() {
  const section = document.getElementById('note');
  section.replaceChildren(el('div', { class: 'note-card' },
    el('h2', { id: 'note-heading' }, 'A note about the plan'),
    el('p', { class: 'hint' }, 'Use this for anything that is not about one meal.'),
    feedbackForm({ mealLabel: null, mealName: '', date: londonISODate(0) })
  ));
}

function showError() {
  view.replaceChildren(el('div', { class: 'empty' },
    el('h2', {}, 'The plan did not load'),
    el('p', {}, 'Check data/plan.json, then refresh this page.')
  ));
}

function dataUrl() {
  return new URL('data/plan.json', document.baseURI).href;
}

function normalize(data) {
  if (!data || !Array.isArray(data.weeks)) throw new Error('shape');
  data.weeks.forEach(function (week, index) {
    const days = Array.isArray(week.days) ? week.days.slice() : [];
    days.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    week.days = days;
    if (!week.id) week.id = (days[0] && days[0].date) || ('week-' + (index + 1));
  });
  return data;
}

function renderDateline() {
  document.getElementById('dateline').textContent = longDate(londonISODate(0));
}

document.getElementById('jump-note').addEventListener('click', function () {
  const note = document.getElementById('note');
  note.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const field = note.querySelector('textarea');
  if (field) field.focus({ preventScroll: true });
});

renderDateline();
renderNote();
window.addEventListener('hashchange', renderRoute);

fetch(dataUrl(), { cache: 'no-cache' })
  .then(function (response) {
    if (!response.ok) throw new Error('status');
    return response.json();
  })
  .then(normalize)
  .then(function (data) {
    plan = data;
    if (!routeFromHash()) history.replaceState(null, '', '#today');
    renderRoute();
  })
  .catch(showError);
