(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const data = window.ARSENAL_DATA;
  if (!data || data.prompts.length !== 201) {
    $('#results-label').textContent = 'Não foi possível carregar a biblioteca. Extraia a pasta completa e abra o index.html novamente.';
    $('#load-more').hidden = true;
    return;
  }
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const byId = new Map(data.prompts.map((entry) => [entry.id, entry]));
  const searchTexts = new Map(data.prompts.map((e) => [e.id, normalize([e.profession, e.groupName, e.purpose, e.preset.name].join(' '))]));
  const state = {group: 0, query: '', view: 'all', limit: 6, configId: null};
  const overrides = new Map();
  const storageKey = 'arsenal-favorites-v3';
  let favorites = new Set();
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => byId.has(id)));
  } catch { storageAvailable = false; }
  function saveFavorites() {
    try { localStorage.setItem(storageKey, JSON.stringify([...favorites])); }
    catch { storageAvailable = false; }
  }
  const labels = {video: 'Vídeo', output: 'Pasta de saída', format: 'Formato', quality: 'Qualidade', duration: 'Duração', preset: 'Preset', style: 'Estilo visual', caption: 'Legenda', extras: 'Complementos', materials: 'Materiais de apoio, logo e referências'};
  function configuredPrompt(entry) {
    let text = entry.prompt;
    const values = overrides.get(entry.id) || {};
    for (const [field, label] of Object.entries(labels)) {
      const value = String(values[field] || '').replace(/[\r\n]+/g, ' ').trim();
      if (value) text = text.replace(new RegExp(`^- ${label}:.*$`, 'm'), () => `- ${label}: ${value}`);
    }
    return text;
  }
  let toastTimer;
  function toast(message) {
    const element = $('#toast');
    const activeDialog = $('dialog[open]');
    (activeDialog || document.body).append(element);
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3000);
  }
  function renderCategories() {
    const groups = [{id: 0, name: 'Todas as áreas', count: data.prompts.length}, ...data.groups];
    $('#category-nav').innerHTML = groups.map((g) => `<button class="category-button${g.id === state.group ? ' active' : ''}" type="button" data-group="${g.id}" aria-pressed="${g.id === state.group}"><span class="category-name">${escape(g.name)}</span><span class="category-count">${g.count}</span></button>`).join('');
    $('#category-select').innerHTML = groups.map((g) => `<option value="${g.id}">${escape(g.name)} (${g.count})</option>`).join('');
  }
  function filteredEntries() {
    const terms = normalize(state.query).trim().split(/\s+/).filter(Boolean);
    return data.prompts.filter((e) => (!state.group || e.group === state.group)
      && (state.view !== 'favorites' || favorites.has(e.id))
      && terms.every((term) => searchTexts.get(e.id).includes(term)));
  }
  function makeCard(entry) {
    const saved = favorites.has(entry.id);
    const edited = overrides.has(entry.id);
    const article = document.createElement('article');
    article.className = `prompt-card${edited ? ' is-edited' : ''}`;
    article.dataset.id = entry.id;
    article.setAttribute('aria-labelledby', `title-${entry.id}`);
    article.innerHTML = `<div class="card-heading"><span class="card-category">${escape(entry.groupName)}</span><span class="card-number">${String(entry.id).padStart(3, '0')}</span><button class="favorite-button icon-button${saved ? ' active' : ''}" type="button" data-favorite="${entry.id}" aria-pressed="${saved}" aria-label="${saved ? 'Remover' : 'Adicionar'} ${escape(entry.profession)} ${saved ? 'dos' : 'aos'} favoritos">${icon('star')}</button></div><h2 class="card-title" id="title-${entry.id}">${escape(entry.profession)}</h2><p class="card-description">${escape(entry.purpose)}</p><p class="card-preset"><span>PRESET</span>${escape(entry.preset.name)}</p><div class="prompt-panel"><div class="prompt-toolbar"><span class="prompt-label">PROMPT COMPLETO</span><button class="copy-button" type="button" data-copy="${entry.id}" aria-describedby="title-${entry.id}">${icon('copy')}<span>Copiar</span></button></div><pre class="prompt-box" tabindex="0" role="region" aria-label="Prompt de ${escape(entry.profession)}"></pre></div><div class="card-footer"><span class="card-note">${edited ? 'Preferências ajustadas' : 'Pronto para personalizar'}</span><div class="card-tools"><button class="configure-button" type="button" data-configure="${entry.id}" aria-describedby="title-${entry.id}">${icon('sliders')}<span>Ajustar opções</span></button><button class="download-button icon-button" type="button" data-download="${entry.id}" aria-label="Baixar prompt de ${escape(entry.profession)} em texto">${icon('download')}</button></div></div>`;
    $('.prompt-box', article).textContent = configuredPrompt(entry);
    return article;
  }
  function renderCards(append = false) {
    const entries = filteredEntries();
    const visible = entries.slice(0, state.limit);
    const grid = $('#prompt-grid');
    const start = append ? grid.children.length : 0;
    if (!append) grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    visible.slice(start).forEach((entry) => fragment.append(makeCard(entry)));
    grid.append(fragment);
    $('#favorites-count').textContent = favorites.size;
    $('#results-label').textContent = `${entries.length} ${entries.length === 1 ? 'prompt' : 'prompts'}`;
    $('#empty-state').hidden = entries.length > 0;
    $('#empty-title').textContent = state.view === 'favorites' && !favorites.size ? 'Seus favoritos começam aqui.' : 'Nenhum prompt encontrado.';
    $('#empty-description').textContent = state.view === 'favorites' && !favorites.size ? 'Use a estrela para guardar os prompts que mais utiliza.' : 'Tente outra busca ou explore todas as áreas.';
    $('#load-more').hidden = visible.length >= entries.length;
    $('#pagination-note').textContent = entries.length ? `${visible.length} de ${entries.length} prompts` : '';
  }
  function updateFilters() {
    state.limit = 6;
    $$('.category-button').forEach((button) => {
      const active = Number(button.dataset.group) === state.group;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#category-select').value = String(state.group);
    $$('.view-button').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderCards();
  }
  $('#search').addEventListener('input', (event) => { state.query = event.target.value; updateFilters(); });
  $('#category-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-group]');
    if (!button) return;
    state.group = Number(button.dataset.group); updateFilters();
  });
  $('#category-select').addEventListener('change', (event) => { state.group = Number(event.target.value); updateFilters(); });
  $$('.view-button').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; updateFilters(); }));
  $('#reset-filters').addEventListener('click', () => { state.query = ''; state.group = 0; state.view = 'all'; $('#search').value = ''; updateFilters(); $('#search').focus({preventScroll: true}); });
  $('#load-more').addEventListener('click', () => {
    const previous = $('#prompt-grid').children.length;
    state.limit += 6; renderCards(true);
    const next = $('#prompt-grid').children[previous];
    if (next) $('[data-copy]', next).focus({preventScroll: true});
  });
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the local-file fallback. */ }
    }
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.readOnly = true;
    temporary.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.append(temporary);
    const previous = document.activeElement;
    temporary.focus(); temporary.select(); temporary.setSelectionRange(0, text.length);
    let success = false;
    try { success = document.execCommand('copy'); } catch { /* Offer a manual selection. */ }
    temporary.remove();
    if (previous && previous.isConnected) previous.focus({preventScroll: true});
    return success;
  }
  function downloadPrompt(entry) {
    const blob = new Blob([configuredPrompt(entry)], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prompt-${String(entry.id).padStart(3, '0')}-${normalize(entry.profession).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#prompt-grid').addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.copy) {
      const entry = byId.get(Number(button.dataset.copy));
      if (!entry) return;
      button.disabled = true;
      const success = await copyText(configuredPrompt(entry));
      button.disabled = false;
      if (success) {
        button.classList.add('copied');
        toast(`Prompt de ${entry.profession} copiado.`);
        setTimeout(() => button.classList.remove('copied'), 2000);
      } else {
        const box = $('.prompt-box', button.closest('.prompt-card'));
        if (box && box.isConnected) {
          const range = document.createRange(); range.selectNodeContents(box);
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
          box.focus({preventScroll: true});
        }
        toast('Texto selecionado. Use a opção Copiar do navegador.');
      }
    } else if (button.dataset.favorite) {
      const id = Number(button.dataset.favorite);
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      saveFavorites();
      if (state.view === 'favorites') {
        renderCards();
        ($('#prompt-grid button') || $('[data-view="all"]')).focus({preventScroll: true});
      } else {
        const saved = favorites.has(id);
        const entry = byId.get(id);
        button.classList.toggle('active', saved);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', `${saved ? 'Remover' : 'Adicionar'} ${entry.profession} ${saved ? 'dos' : 'aos'} favoritos`);
        $('#favorites-count').textContent = favorites.size;
      }
      if (!storageAvailable) toast('Favorito guardado nesta sessão.');
    } else if (button.dataset.configure) openConfig(Number(button.dataset.configure), button);
    else if (button.dataset.download) downloadPrompt(byId.get(Number(button.dataset.download)));
  });

  const form = $('#config-form');
  const configDialog = $('#config-dialog');
  const guideDialog = $('#guide-dialog');
  const returnFocus = new Map();
  function synchronizeDialogs() {
    document.body.classList.toggle('dialog-open', !!$('dialog[open]'));
    if (!$('#toast').closest('dialog[open]')) document.body.append($('#toast'));
  }
  function openConfig(id, trigger) {
    const entry = byId.get(id);
    if (!entry) return;
    state.configId = id;
    form.reset();
    const values = overrides.get(id) || {};
    for (const [key, value] of Object.entries(values)) if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
    $('#config-profession').textContent = entry.profession;
    returnFocus.set(configDialog, trigger);
    configDialog.showModal(); synchronizeDialogs(); $('#config-title').focus({preventScroll: true});
  }
  function refreshConfiguredCard(id) {
    const card = $(`.prompt-card[data-id="${id}"]`);
    if (!card) return;
    $('.prompt-box', card).textContent = configuredPrompt(byId.get(id));
    $('.prompt-box', card).scrollTop = 0;
    card.classList.toggle('is-edited', overrides.has(id));
    $('.card-note', card).textContent = overrides.has(id) ? 'Preferências ajustadas' : 'Pronto para personalizar';
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).replace(/[\r\n]+/g, ' ').trim()]).filter(([, value]) => value));
    if (Object.keys(values).length) overrides.set(state.configId, values); else overrides.delete(state.configId);
    refreshConfiguredCard(state.configId); configDialog.close(); toast('Preferências aplicadas ao prompt.');
  });
  $('#reset-config').addEventListener('click', () => { form.reset(); overrides.delete(state.configId); refreshConfiguredCard(state.configId); toast('Configuração original restaurada.'); });
  $('#open-guide').addEventListener('click', (event) => { returnFocus.set(guideDialog, event.currentTarget); guideDialog.showModal(); synchronizeDialogs(); $('#guide-title').focus({preventScroll: true}); });
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if ($('#toast').parentElement === dialog) document.body.append($('#toast'));
      synchronizeDialogs();
      const trigger = returnFocus.get(dialog);
      if (trigger && trigger.isConnected) trigger.focus({preventScroll: true});
    });
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.key === '/' && !typing && !$('dialog[open]') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); $('#search').focus(); $('#search').scrollIntoView({block: 'center', behavior: 'instant'});
    }
  });
  renderCategories(); renderCards();
})();
