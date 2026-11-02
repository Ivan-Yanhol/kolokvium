/* ЛОГІКА. Усі файли завантажуються локально — без fetch(), сервера та інтернету. */
(function () {
  'use strict';
  const BASE = window.QUESTION_BANK;
  const STORAGE_KEY = 'kolokvium_offline_edits_v2';
  // НАЗВИ РІВНІВ (змінюй тут, якщо викладач змінить вимоги)
  const labels = ['Дати означення / сформулювати', 'Навести приклади / виконати завдання', 'Написати повне доведення', 'Написати повне доведення'];
  const $ = (id) => document.getElementById(id);
  const state = { mode: 'auto', editMode: false, edits: {} };

  function modStar(value, modulo) {
    return ((value - 1) % modulo + modulo) % modulo + 1;
  }
  function calculate(k) {
    return [
      [modStar(k, 23), modStar(k + 12, 23)],
      [modStar(k, 9), modStar(k + 5, 9)],
      [modStar(k, 7)],
      [modStar(k, 4)]
    ];
  }
  function getVariant() {
    const raw = $('variant').value.trim();
    const n = Number(raw);
    const ok = raw !== '' && Number.isInteger(n) && n >= 1 && n <= 100;
    $('error').textContent = ok ? '' : 'Введи ціле число від 1 до 100.';
    $('calculate').disabled = !ok;
    return ok ? n : null;
  }
  // За замовчуванням перші два рівні короткі, а доведення — розгорнуті.
  // Ручні режими залишено на випадок, якщо треба повторити більше або швидше.
  function answerMode(level) {
    if (state.mode === 'auto') return level <= 2 ? 'brief' : 'long';
    return state.mode;
  }
  function answerCaption(level) {
    if (state.mode !== 'auto') return state.mode === 'brief' ? 'Коротка відповідь' : 'Розгорнута відповідь';
    return ['Означення / формулювання', 'Приклад / результат', 'Повне доведення', 'Повне доведення'][level - 1];
  }
  function item(level, number) {
    const original = BASE[String(level)][number - 1];
    if (!original || original.id !== number) {
      throw new Error('База запитань має неправильні номери: Nivel ' + level + ', № ' + number);
    }
    return { ...original, ...(state.edits[level + '-' + number] || {}) };
  }
  function node(type, className, text) {
    const el = document.createElement(type);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function flash(message) { $('message').textContent = message; }
  function createEditor(level, number, q) {
    const box = node('div', 'editor');
    for (const [name, caption] of [['q', 'Умова'], ['brief', 'Коротка відповідь'], ['long', 'Повна відповідь']]) {
      const wrapper = node('div');
      const label = node('label', '', caption);
      const textarea = node('textarea', name === 'long' ? 'large' : '');
      textarea.value = q[name];
      textarea.dataset.field = name;
      wrapper.append(label, textarea);
      box.append(wrapper);
    }
    const actions = node('div', 'editor-actions');
    const save = node('button', 'button primary', 'Зберегти правки');
    save.type = 'button';
    save.addEventListener('click', () => {
      const fields = box.querySelectorAll('textarea');
      const obj = {};
      fields.forEach(field => { obj[field.dataset.field] = field.value; });
      state.edits[level + '-' + number] = obj;
      storeChanges();
      render();
      flash('Зміни до Nivel ' + level + ', №' + number + ' збережено. Рекомендовано також натиснути «Експорт змін (JSON)».');
    });
    const cancel = node('button', 'button', 'Не зберігати');
    cancel.type = 'button';
    cancel.addEventListener('click', () => render());
    actions.append(save, cancel);
    box.append(actions);
    return box;
  }
  function render() {
    const k = getVariant();
    if (k === null) {
      $('summary').replaceChildren();
      $('questions').replaceChildren();
      return;
    }
    const all = calculate(k);
    const headline = node('h2', '', 'Варіант №' + k);
    const summary = node('div', 'summary-grid');
    all.forEach((nums, index) => {
      const tile = node('div', 'summary-tile');
      tile.append(node('span', '', 'Nivel ' + (index + 1)), node('strong', '', nums.map(n => '№' + n).join(' і ')));
      summary.append(tile);
    });
    $('summary').replaceChildren(headline, summary);
    const content = document.createDocumentFragment();
    all.forEach((nums, index) => {
      const level = index + 1;
      const section = node('section', 'level');
      const heading = node('div', 'level-head');
      heading.append(node('h2', '', 'Nivel ' + level), node('span', '', labels[index]));
      section.append(heading);
      nums.forEach((number) => {
        const q = item(level, number);
        const card = node('article', 'question');
        card.append(
          node('div', 'question-top', 'ЗАВДАННЯ №' + number),
          node('div', 'question-title', q.q),
          node('div', 'answer-mode', state.mode === 'auto' && level === 1 && q.teacherType ? q.teacherType : answerCaption(level)),
          node('div', 'answer', q[answerMode(level)])
        );
        if (state.editMode) card.append(createEditor(level, number, q));
        section.append(card);
      });
      content.append(section);
    });
    $('questions').replaceChildren(content);
  }
  function setMode(mode) {
    if (!['auto', 'brief', 'long'].includes(mode)) return;
    state.mode = mode;
    for (const [buttonId, value] of [['auto-mode', 'auto'], ['short-mode', 'brief'], ['full-mode', 'long']]) {
      $(buttonId).classList.toggle('is-active', mode === value);
      $(buttonId).setAttribute('aria-pressed', mode === value ? 'true' : 'false');
    }
    $('mode-help').textContent = mode === 'auto'
      ? 'За викладачем: Nivel 1 — коротке означення або сформульована властивість (формула лише за потреби); Nivel 2 — приклади; Nivel 3–4 — повне доведення.'
      : mode === 'brief'
        ? 'Ручний режим: для всіх рівнів показано коротку відповідь. Поверни «За рівнями», щоб побачити повні доведення.'
        : 'Ручний режим: для всіх рівнів показано розгорнуту відповідь. Поверни «За рівнями», щоб скоротити означення та приклади.';
    render();
  }
  function asPlainText() {
    const k = getVariant();
    if (k === null) return '';
    let text = 'КОЛОКВІУМ — ВАРІАНТ ' + k + '\n';
    calculate(k).forEach((numbers, index) => {
      const level = index + 1;
      text += '\nNIVEL ' + level + '\n';
      numbers.forEach(number => {
        const q = item(level, number);
        text += '\n№' + number + '. ' + q.q + '\n' + q[answerMode(level)] + '\n';
      });
    });
    return text;
  }
  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function storeChanges() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.edits));
    } catch (error) {
      flash('Браузер не дозволив локальне збереження. Натисни «Експорт змін (JSON)», щоб не втратити правки.');
    }
  }
  function loadChanges() {
    try {
      const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) state.edits = validateEdits(loaded);
    } catch (error) { state.edits = {}; }
  }
  function validateEdits(data) {
    const result = {};
    for (const [key, patch] of Object.entries(data)) {
      const [level, number] = key.split('-').map(Number);
      if (!Number.isInteger(level) || level < 1 || level > 4 || !Number.isInteger(number) || number < 1 || !BASE[String(level)][number-1] || !patch || typeof patch !== 'object') continue;
      const p = {};
      for (const name of ['q', 'brief', 'long']) {
        if (typeof patch[name] === 'string' && patch[name].length < 100000) p[name] = patch[name];
      }
      result[key] = p;
    }
    return result;
  }
  $('calculate').addEventListener('click', render);
  $('variant').addEventListener('input', render);
  $('variant').addEventListener('keydown', event => { if (event.key === 'Enter') render(); });
  $('auto-mode').addEventListener('click', () => setMode('auto'));
  $('short-mode').addEventListener('click', () => setMode('brief'));
  $('full-mode').addEventListener('click', () => setMode('long'));
  $('print').addEventListener('click', () => window.print());
  $('copy').addEventListener('click', async () => {
    const value = asPlainText();
    if (!value) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      flash('Текст скопійовано.');
    } catch (error) {
      const textarea = node('textarea');
      textarea.value = value;
      document.body.append(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      textarea.remove();
      flash(success ? 'Текст скопійовано.' : 'Браузер заборонив копіювання. Можна виділити текст вручну.');
    }
  });
  $('edit').addEventListener('click', () => {
    state.editMode = !state.editMode;
    $('edit').setAttribute('aria-pressed', state.editMode ? 'true' : 'false');
    $('edit').textContent = state.editMode ? 'Завершити редагування' : 'Редагувати відповіді';
    render();
  });
  $('export').addEventListener('click', () => {
    download('moji_zminy_kolokvium.json', JSON.stringify(state.edits, null, 2), 'application/json;charset=utf-8');
    flash('Зміни експортовано у JSON-файл. Збережи його разом із програмою.');
  });
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error('Завеликий файл');
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некоректний формат файлу');
      state.edits = validateEdits(data);
      storeChanges();
      render();
      flash('Зміни імпортовано успішно.');
    } catch (error) { flash('Не вдалося імпортувати JSON-файл: ' + error.message); }
    event.target.value = '';
  });
  $('reset').addEventListener('click', () => {
    if (Object.keys(state.edits).length === 0) { flash('Змін ще немає.'); return; }
    if (!window.confirm('Видалити всі твої редагування? Спочатку можна експортувати їх у JSON.')) return;
    state.edits = {};
    storeChanges();
    render();
    flash('Усі власні правки скасовано; показано початкові відповіді з index.html.');
  });
  if (!BASE || !['1','2','3','4'].every((lv, i) => Array.isArray(BASE[lv]) && BASE[lv].length === [23,9,7,4][i])) {
    flash('Помилка: у index.html немає коректної бази запитань.');
    return;
  }
  loadChanges();
  render();
  if (Object.keys(state.edits).length > 0) {
    flash("Є твої попередні локальні правки, які можуть перекривати нові відповіді. Збережи їх через «Експорт змін (JSON)», а потім за потреби натисни «Скасувати мої зміни». ");
  }
})();
