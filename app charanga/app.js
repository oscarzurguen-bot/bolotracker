/* JavaScript - Charanga Manager Application Logic */

document.addEventListener('DOMContentLoaded', () => {
  // === ESTADO GLOBAL ===
  let state = {
    bolos: [],
    gasRate: 0.30,
    myCharangas: ['Charanga La Movida', 'Charanga Los Rumberos'],
    allInstruments: ['Bombo', 'Caja', 'Trompeta', 'Saxofón', 'Trombón', 'Piano', 'Bombardino'],
    myInstruments: ['Bombo', 'Caja', 'Trompeta', 'Saxofón', 'Trombón', 'Piano', 'Bombardino'],
    myMembers: [
      { name: 'María', icon: '🎺' },
      { name: 'Angy (Trombón)', icon: 'Trombón' },
      { name: 'Dani', icon: '🎷' },
      { name: 'Lucía', icon: '🎷' },
      { name: 'Rubén (Caja)', icon: '🥁' },
      { name: 'Angel (Bombo)', icon: 'Bombo' },
      { name: 'Sara (Bombardino)', icon: 'Bombardino' }
    ],
    currentFilter: 'all',
    currentView: 'list', // 'list' | 'calendar'
    calendarDate: new Date(),
    editingBoloMembers: []
  };

  // === INICIALIZACIÓN ===
  initApp();

  function initApp() {
    initTheme();
    populateTimeSelects();
    loadDataFromStorage();
    if (state.bolos.length === 0) {
      loadSampleData(false); // Cargar datos demo en la primera apertura si está vacío
    }
    setupEventListeners();
    initCloudSync();
    renderAll();
  }

  // === TEMA CLARO / OSCURO ===
  function initTheme() {
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);

    const headerBtnIcon = document.getElementById('theme-toggle-icon');
    if (headerBtnIcon) {
      headerBtnIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }

    const statusText = document.getElementById('theme-status-text');
    const settingsBtn = document.getElementById('btn-settings-theme-toggle');

    if (statusText) {
      statusText.innerHTML = theme === 'light' ? 'Claro ☀️' : 'Oscuro 🌙';
    }
    if (settingsBtn) {
      settingsBtn.textContent = theme === 'light' ? 'Cambiar a Modo Oscuro 🌙' : 'Cambiar a Modo Claro ☀️';
    }
  }

  function toggleTheme() {
    const newTheme = (state.theme === 'light') ? 'dark' : 'light';
    applyTheme(newTheme);
  }

  function populateTimeSelects() {
    const startSelect = document.getElementById('bolo-start-time');
    const endSelect = document.getElementById('bolo-end-time');
    if (!startSelect || !endSelect) return;

    let optionsHtml = '<option value="">--:--</option>';
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      optionsHtml += `<option value="${hh}:00">${hh}:00</option>`;
      optionsHtml += `<option value="${hh}:30">${hh}:30</option>`;
    }

    startSelect.innerHTML = optionsHtml;
    endSelect.innerHTML = optionsHtml;
  }

  function roundToHalfHour(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return '';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    if (m < 15) return `${String(h).padStart(2, '0')}:00`;
    if (m < 45) return `${String(h).padStart(2, '0')}:30`;
    const nextH = (h + 1) % 24;
    return `${String(nextH).padStart(2, '0')}:00`;
  }

  // === CARGA Y GUARDADO EN LOCALSTORAGE ===
  function loadDataFromStorage() {
    try {
      const storedBolos = localStorage.getItem('charanga_bolos');
      const storedRate = localStorage.getItem('charanga_gasRate');
      const storedCharangas = localStorage.getItem('charanga_myCharangas');
      const storedMembers = localStorage.getItem('charanga_myMembers');
      const storedAllInstruments = localStorage.getItem('charanga_allInstruments');
      const storedMyInstruments = localStorage.getItem('charanga_myInstruments');

      if (storedBolos) state.bolos = JSON.parse(storedBolos);
      if (storedRate) state.gasRate = parseFloat(storedRate) || 0.30;
      if (storedCharangas) state.myCharangas = JSON.parse(storedCharangas);
      if (storedMembers) state.myMembers = JSON.parse(storedMembers);
      if (storedAllInstruments) state.allInstruments = JSON.parse(storedAllInstruments);
      if (storedMyInstruments) state.myInstruments = JSON.parse(storedMyInstruments);

      // Sanitizar listas de instrumentos para asegurar que no contengan nombres de músicos
      const defaultList = ['Bombo', 'Caja', 'Trompeta', 'Saxofón', 'Trombón', 'Piano', 'Bombardino'];
      const memberNameList = (state.myMembers || []).map(m => (typeof m === 'object' ? m.name : String(m)).toLowerCase().trim());

      if (state.allInstruments) {
        state.allInstruments = state.allInstruments.filter(inst => {
          const norm = String(inst).toLowerCase().trim();
          return !memberNameList.some(mn => mn === norm || mn.startsWith(norm + ' '));
        });
        if (state.allInstruments.length === 0) state.allInstruments = [...defaultList];
      } else {
        state.allInstruments = [...defaultList];
      }

      if (state.myInstruments) {
        state.myInstruments = state.myInstruments.filter(inst => {
          const norm = String(inst).toLowerCase().trim();
          return !memberNameList.some(mn => mn === norm || mn.startsWith(norm + ' '));
        });
        if (state.myInstruments.length === 0) state.myInstruments = [...state.allInstruments];
      } else {
        state.myInstruments = [...state.allInstruments];
      }

      // Actualizar input de tarifa en ajustes
      const gasInput = document.getElementById('gas-rate-input');
      if (gasInput) gasInput.value = state.gasRate;
      updateGasRateDisplays();
    } catch (e) {
      console.error('Error cargando datos:', e);
    }
  }

  function saveDataToStorage() {
    localStorage.setItem('charanga_bolos', JSON.stringify(state.bolos));
    localStorage.setItem('charanga_gasRate', state.gasRate.toString());
    localStorage.setItem('charanga_myCharangas', JSON.stringify(state.myCharangas));
    localStorage.setItem('charanga_myMembers', JSON.stringify(state.myMembers));
    localStorage.setItem('charanga_allInstruments', JSON.stringify(state.allInstruments));
    localStorage.setItem('charanga_myInstruments', JSON.stringify(state.myInstruments));

    if (typeof syncToCloud === 'function') {
      syncToCloud();
    }
  }

  function updateGasRateDisplays() {
    const gasDisplay = document.getElementById('gas-rate-display');
    if (gasDisplay) gasDisplay.textContent = state.gasRate.toFixed(2).replace('.', ',');
  }

  // === RENDERIZADO GLOBAL ===
  function renderAll() {
    renderCharangasSettings();
    renderInstrumentsSettings();
    renderCharangaRadios();
    renderInstrumentRadios();
    renderFilterChips();
    renderKPIs();
    renderBolosList();
    renderFinances();
  }

  // === RENDERIZADORES DINÁMICOS Y PERSONALIZACIÓN ===
  function renderInstrumentsSettings() {
    const container = document.getElementById('settings-instruments-toggle-grid');
    if (!container) return;

    const defaultList = ['Bombo', 'Caja', 'Trompeta', 'Saxofón', 'Trombón', 'Piano', 'Bombardino'];
    if (!state.allInstruments || state.allInstruments.length === 0) {
      state.allInstruments = [...defaultList];
    }
    if (!state.myInstruments || state.myInstruments.length === 0) {
      state.myInstruments = [...state.allInstruments];
    }

    // Asegurar sincronización
    state.myInstruments.forEach(inst => {
      if (!state.allInstruments.includes(inst)) {
        state.allInstruments.push(inst);
      }
    });

    container.innerHTML = state.allInstruments.map(inst => {
      const isSelected = state.myInstruments.includes(inst);
      return `
        <button type="button" class="member-select-btn ${isSelected ? 'selected' : ''}" data-inst="${escapeHtml(inst)}">
          <span class="member-status-icon">${isSelected ? '✅' : '➕'}</span>
          <span class="member-name">${escapeHtml(inst)} ${getInstrumentIcon(inst)}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.member-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const inst = btn.getAttribute('data-inst');
        const idx = state.myInstruments.indexOf(inst);
        if (idx !== -1) {
          if (state.myInstruments.length > 1) {
            state.myInstruments.splice(idx, 1);
          } else {
            alert('Debes mantener al menos un instrumento activado.');
            return;
          }
        } else {
          state.myInstruments.push(inst);
        }
        saveDataToStorage();
        renderAll();
      });
    });
  }

  function renderCharangasSettings() {
    const container = document.getElementById('settings-charangas-list');
    if (!container) return;

    container.innerHTML = state.myCharangas.map(ch => `
      <span class="tag-chip">
        🎶 ${escapeHtml(ch)}
        <button type="button" class="tag-remove btn-del-charanga" data-charanga="${escapeHtml(ch)}">&times;</button>
      </span>
    `).join('');

    container.querySelectorAll('.btn-del-charanga').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-charanga');
        state.myCharangas = state.myCharangas.filter(c => c !== name);
        saveDataToStorage();
        renderAll();
      });
    });
  }

  function renderCharangaRadios() {
    const container = document.getElementById('charanga-radio-group');
    if (!container) return;

    const currentSelected = document.querySelector('input[name="charanga"]:checked')?.value || (state.myCharangas[0] || 'Otra');

    let html = state.myCharangas.map((ch, idx) => {
      const isChecked = currentSelected === ch || (idx === 0 && !state.myCharangas.includes(currentSelected) && currentSelected !== 'Otra');
      return `
        <label class="radio-card">
          <input type="radio" name="charanga" value="${escapeHtml(ch)}" ${isChecked ? 'checked' : ''}>
          <div class="radio-content">
            <span class="radio-icon">🎶</span>
            <span class="radio-label">${escapeHtml(ch)}</span>
          </div>
        </label>
      `;
    }).join('');

    html += `
      <label class="radio-card">
        <input type="radio" name="charanga" value="Otra" ${currentSelected === 'Otra' ? 'checked' : ''}>
        <div class="radio-content">
          <span class="radio-icon">✏️</span>
          <span class="radio-label">Otra</span>
        </div>
      </label>
    `;

    container.innerHTML = html;

    container.querySelectorAll('input[name="charanga"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const otherContainer = document.getElementById('charanga-other-container');
        if (radio.value === 'Otra') {
          if (otherContainer) otherContainer.classList.remove('hidden');
          const otherInput = document.getElementById('bolo-charanga-other');
          if (otherInput) otherInput.focus();
        } else {
          if (otherContainer) otherContainer.classList.add('hidden');
        }
        updatePriceCalculation(false);
      });
    });
  }

  function renderInstrumentRadios(selectedVal = null) {
    const container = document.getElementById('instrument-radio-group');
    if (!container) return;

    const available = ['Bombo', 'Caja', 'Trompeta', 'Saxofón', 'Trombón', 'Piano', 'Bombardino'];
    const activeList = (state.myInstruments && state.myInstruments.length > 0) ? [...state.myInstruments] : [...available];

    // Incluir siempre la opción "Aún no sé" al final
    if (!activeList.includes('Aún no sé')) {
      activeList.push('Aún no sé');
    }

    const currentChecked = selectedVal || document.querySelector('input[name="instrument"]:checked')?.value || activeList[0];

    container.innerHTML = activeList.map(inst => `
      <label class="radio-card">
        <input type="radio" name="instrument" value="${escapeHtml(inst)}" ${inst === currentChecked ? 'checked' : ''}>
        <div class="radio-content">
          <span class="radio-icon">${getInstrumentIcon(inst)}</span>
          <span class="radio-label">${escapeHtml(inst)}</span>
        </div>
      </label>
    `).join('');
  }

  function renderFilterChips() {
    const container = document.querySelector('.filter-chips');
    if (!container) return;

    let html = `
      <button class="chip-filter ${state.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
      <button class="chip-filter ${state.currentFilter === 'upcoming' ? 'active' : ''}" data-filter="upcoming">📅 Próximos</button>
      <button class="chip-filter ${state.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">⏳ Pendientes</button>
      <button class="chip-filter ${state.currentFilter === 'paid' ? 'active' : ''}" data-filter="paid">✅ Cobrados</button>
    `;

    state.myCharangas.forEach(ch => {
      const isActive = state.currentFilter === ch;
      html += `<button class="chip-filter ${isActive ? 'active' : ''}" data-filter="${escapeHtml(ch)}">🎶 ${escapeHtml(ch)}</button>`;
    });

    html += `
      <button class="chip-filter ${state.currentFilter === 'car' ? 'active' : ''}" data-filter="car">🚗 Con coche</button>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.chip-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentFilter = btn.getAttribute('data-filter');
        renderBolosList();
      });
    });
  }

  // === RENDER KPI (RESUMEN CABECERA) ===
  function renderKPIs() {
    let pendingSum = 0;
    let estimatedSum = 0;

    state.bolos.forEach(b => {
      const bStatus = b.status || 'pending';
      const cachePrice = parseFloat(b.price) || 0;
      const gasMoney = (b.hasCar && b.km) ? (parseFloat(b.km) * state.gasRate) : 0;
      const totalBolo = cachePrice + gasMoney;

      if (bStatus === 'pending') {
        pendingSum += totalBolo;
        estimatedSum += totalBolo;
      } else if (bStatus === 'upcoming') {
        estimatedSum += totalBolo;
      }
    });

    const pendingEl = document.getElementById('kpi-total-pending');
    if (pendingEl) pendingEl.textContent = formatCurrency(pendingSum);

    const estimatedEl = document.getElementById('kpi-estimated-earnings');
    if (estimatedEl) estimatedEl.textContent = formatCurrency(estimatedSum);
  }

  // === RENDER LISTA DE BOLOS ===
  function renderBolosList() {
    const container = document.getElementById('bolos-list');
    const countBadge = document.getElementById('bolos-count');

    // Filtrar bolos de forma limpia y robusta
    let filtered = state.bolos.filter(b => {
      const bStatus = b.status || 'pending';
      if (state.currentFilter === 'upcoming') {
        return bStatus === 'upcoming';
      }
      if (state.currentFilter === 'pending') {
        return bStatus === 'pending';
      }
      if (state.currentFilter === 'paid') {
        return bStatus === 'paid';
      }
      if (state.currentFilter === 'car') {
        return Boolean(b.hasCar);
      }
      if (state.currentFilter === 'all') {
        return true;
      }
      // Filtro por charanga / grupo específico
      return b.charanga === state.currentFilter;
    });

    // Ordenar por fecha descendente
    filtered.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));

    countBadge.textContent = filtered.length.toString();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 10px;">🥁</div>
          <p style="font-weight: 600;">No hay actuaciones grabadas en esta vista.</p>
          <p style="font-size: 13px;">Pulsa el botón "+" arriba para añadir un nuevo bolo.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(bolo => {
      let statusClass = 'pending';
      let statusText = '⏳ Pendiente';
      if (bolo.status === 'upcoming') {
        statusClass = 'upcoming';
        statusText = '📅 Próximo';
      } else if (bolo.status === 'paid') {
        statusClass = 'paid';
        statusText = '✅ Cobrado';
      }

      const cachePrice = parseFloat(bolo.price) || 0;
      const gasMoney = bolo.hasCar && bolo.km ? (parseFloat(bolo.km) * state.gasRate) : 0;
      const totalPrice = cachePrice + gasMoney;
      
      const instrumentIcon = getInstrumentIcon(bolo.instrument);
      const charangaName = bolo.charanga || 'MenudoChaperon';
      const timeStr = bolo.startTime ? `${bolo.startTime}${bolo.endTime ? ' - ' + bolo.endTime : ''}` : (bolo.time ? bolo.time + 'h' : '');

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bolo.name + ', España')}`;

      return `
        <div class="item-card" data-bolo-id="${bolo.id}">
          <div class="item-top-row">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="item-title">📍 ${escapeHtml(bolo.name)}</h3>
              <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps-subtle" title="Cómo llegar con Google Maps GPS" onclick="event.stopPropagation();">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; opacity:0.85;"><rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)"/><path d="M9.5 15v-3.5a1.5 1.5 0 0 1 1.5-1.5h3.5"/><polyline points="12.5 8 15 10 12.5 12"/></svg>
                Cómo llegar
              </a>
            </div>
            <button class="status-badge ${statusClass}" data-action="toggle-status" data-bolo-id="${bolo.id}">
              ${statusText}
            </button>
          </div>

          <div class="item-meta">
            <span class="item-meta-icon">📅 ${formatDateStr(bolo.date)}${timeStr ? ' (' + timeStr + ')' : ''}</span>
          </div>

          <div class="item-pills-row">
            <span class="pill-info pill-charanga">🎶 ${escapeHtml(charangaName)}</span>
            ${bolo.type ? `<span class="pill-info">🎉 ${escapeHtml(bolo.type)}</span>` : ''}
            ${bolo.hours ? `<span class="pill-info">⏱️ ${bolo.hours}h</span>` : ''}
            ${bolo.hasCar ? `<span class="pill-info pill-car">🚗 ${bolo.km} km (${formatCurrency(gasMoney)})</span>` : ''}
            ${bolo.members && bolo.members.length > 0 ? `<span class="pill-info">👥 ${bolo.members.length} componentes</span>` : ''}
          </div>

          <div class="item-footer">
            <div class="footer-prices-left">
              <span class="price-cache-white">${formatCurrency(cachePrice)}</span>
              ${gasMoney > 0 ? `<span class="price-gas-blue">+${formatCurrency(gasMoney)}</span>` : ''}
            </div>
            <span class="price-total-orange">${formatCurrency(totalPrice)}</span>
          </div>
        </div>
      `;
    }).join('');
  }



  // === RENDER FINANZAS Y PASAPORTE DE PUEBLOS ===
  function renderFinances() {
    let paidTotal = 0;
    let pendingTotal = 0;
    let totalKm = 0;
    let instCounts = {};
    let charangaCounts = {};
    let townMap = {};

    state.bolos.forEach(b => {
      const price = parseFloat(b.price) || 0;
      const gasMoney = (b.hasCar && b.km) ? (parseFloat(b.km) * state.gasRate) : 0;

      if (b.status === 'paid') paidTotal += price;
      else if (b.status === 'pending') pendingTotal += price;

      if (b.hasCar && b.km) {
        totalKm += parseFloat(b.km) || 0;
      }

      const instName = b.instrument || 'Caja';
      instCounts[instName] = (instCounts[instName] || 0) + 1;

      const charName = b.charanga || (state.myCharangas[0] || 'Charanga');
      charangaCounts[charName] = (charangaCounts[charName] || 0) + 1;

      // PASAPORTE DE PUEBLOS
      const townName = (b.name || 'Pueblo').trim();
      if (!townMap[townName]) {
        townMap[townName] = {
          name: townName,
          count: 0,
          totalEarned: 0,
          totalGasoline: 0,
          lastDate: b.date,
          bolos: []
        };
      }

      townMap[townName].count++;
      townMap[townName].totalEarned += price;
      townMap[townName].totalGasoline += gasMoney;
      townMap[townName].bolos.push(b);

      if (new Date(b.date) > new Date(townMap[townName].lastDate)) {
        townMap[townName].lastDate = b.date;
      }
    });

    state.townMap = townMap;
    const gasTotal = totalKm * state.gasRate;
    const grandTotal = paidTotal + pendingTotal; // Solo cachés sin gasolina

    const paidEl = document.getElementById('fin-paid-total');
    if (paidEl) paidEl.textContent = formatCurrency(paidTotal);
    const pendingEl = document.getElementById('fin-pending-total');
    if (pendingEl) pendingEl.textContent = formatCurrency(pendingTotal);
    const kmEl = document.getElementById('fin-total-km');
    if (kmEl) kmEl.textContent = `${totalKm.toLocaleString('es-ES')} km`;
    const gasEl = document.getElementById('fin-gas-total');
    if (gasEl) gasEl.textContent = formatCurrency(gasTotal);
    const gasRateLabel = document.getElementById('fin-gas-rate-label');
    if (gasRateLabel) gasRateLabel.textContent = state.gasRate.toFixed(2).replace('.', ',');
    const grandEl = document.getElementById('fin-grand-total');
    if (grandEl) grandEl.textContent = formatCurrency(grandTotal);

    const townsList = Object.values(townMap);

    // RENDERIZAR PASAPORTE DE GIRA (SELLOS DE PUEBLOS)
    const townsCountBadge = document.getElementById('towns-count');
    if (townsCountBadge) townsCountBadge.textContent = `${townsList.length} pueblos`;

    const passportGrid = document.getElementById('passport-grid');
    if (passportGrid) {
      if (townsList.length === 0) {
        passportGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">
            📍 Todavía no has registrado ningún pueblo en tus bolos.
          </div>
        `;
      } else {
        townsList.sort((a, b) => b.count - a.count || b.totalEarned - a.totalEarned);

        passportGrid.innerHTML = townsList.map(t => {
          const isVip = t.count > 1;
          const grandTotalTown = t.totalEarned; // Omite gasolina

          return `
            <div class="passport-stamp-card ${isVip ? 'vip-town' : ''}" data-town="${escapeHtml(t.name)}">
              ${isVip ? `<span class="stamp-badge-vip">⭐ ${t.count} Bolos</span>` : ''}
              <div class="stamp-town-name">📍 ${escapeHtml(t.name)}</div>
              <div class="stamp-info-row">
                <span>Último: ${formatDateStr(t.lastDate)}</span>
              </div>
              <div class="stamp-info-row" style="margin-top: 6px;">
                <span>Caché Ganado:</span>
                <span class="stamp-total-money">${formatCurrency(grandTotalTown)}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Desglose por Charanga
    const charContainer = document.getElementById('charanga-stats');
    if (charContainer) {
      charContainer.innerHTML = Object.keys(charangaCounts).map(ch => `
        <div class="inst-stat-item">
          <span style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
            🎶 ${escapeHtml(ch)}
          </span>
          <strong style="color: #C084FC;">${charangaCounts[ch]} bolos</strong>
        </div>
      `).join('');
    }

    // Desglose instrumentos
    const instContainer = document.getElementById('instrument-stats');
    if (instContainer) {
      instContainer.innerHTML = Object.keys(instCounts).map(inst => `
        <div class="inst-stat-item">
          <span style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
            ${getInstrumentIcon(inst)} ${inst}
          </span>
          <strong style="color: var(--primary-gold);">${instCounts[inst]} bolos</strong>
        </div>
      `).join('');
    }
  }

  // === MODAL FICHA COMPLETA DEL PUEBLO ===
  function openTownDetailModal(townName, townData) {
    const modal = document.getElementById('modal-town-detail');
    const titleEl = document.getElementById('modal-town-title');
    const bodyEl = document.getElementById('modal-town-body');
    if (!modal || !titleEl || !bodyEl || !townData) return;

    titleEl.textContent = `📍 Ficha del Pueblo: ${townName}`;

    const totalMoney = townData.totalEarned; // Omite gasolina

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(townName + ', España')}`;

    let html = `
      <div class="finance-overview-card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
          <h3>📊 Resumen en ${escapeHtml(townName)}</h3>
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps-subtle" title="Cómo llegar con Google Maps">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; opacity:0.85;"><rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)"/><path d="M9.5 15v-3.5a1.5 1.5 0 0 1 1.5-1.5h3.5"/><polyline points="12.5 8 15 10 12.5 12"/></svg>
            Cómo llegar
          </a>
        </div>
        <div class="finance-row">
          <span>Actuaciones realizadas:</span>
          <strong>${townData.count} ${townData.count === 1 ? 'bolo' : 'bolos'}</strong>
        </div>
        <div class="finance-divider"></div>
        <div class="finance-row total-highlight">
          <span>CACHÉ TOTAL GANADO:</span>
          <strong style="color: var(--primary-gold);">${formatCurrency(totalMoney)}</strong>
        </div>
      </div>

      <h4 style="font-family: var(--font-heading); font-size: 14px; color: #FFF; margin-bottom: 8px;">📅 Historial de Bolos en este pueblo:</h4>
      <div class="items-list">
    `;

    html += townData.bolos.map(b => {
      const cachePrice = parseFloat(b.price) || 0;
      const gasMoney = (b.hasCar && b.km) ? (parseFloat(b.km) * state.gasRate) : 0;
      const totalBolo = cachePrice + gasMoney;
      const isPaid = b.status === 'paid';
      const timeStr = b.startTime ? `${b.startTime}${b.endTime ? ' - ' + b.endTime : ''}` : (b.time ? b.time + 'h' : '');

      return `
        <div class="item-card">
          <div class="item-top-row">
            <h3 class="item-title">🎉 ${escapeHtml(b.type || b.name)}</h3>
            <span class="status-badge ${isPaid ? 'paid' : 'pending'}">
              ${isPaid ? '✅ Cobrado' : '⏳ Pendiente'}
            </span>
          </div>

          <div class="item-meta">
            <span>📅 ${formatDateStr(b.date)}${timeStr ? ' (' + timeStr + ')' : ''}</span>
          </div>

          <div class="item-pills-row">
            <span class="pill-info pill-charanga">🎶 ${escapeHtml(b.charanga || 'Charanga')}</span>
            <span class="pill-info pill-instrument">${getInstrumentIcon(b.instrument)} ${escapeHtml(b.instrument || 'Caja')}</span>
            ${b.hasCar ? `<span class="pill-info pill-car">🚗 ${b.km} km (+${formatCurrency(gasMoney)})</span>` : ''}
          </div>

          <div class="item-footer">
            <div class="footer-prices-left">
              <span class="price-cache-white">${formatCurrency(cachePrice)}</span>
              ${gasMoney > 0 ? `<span class="price-gas-blue">+${formatCurrency(gasMoney)}</span>` : ''}
            </div>
            <span class="price-total-orange">${formatCurrency(totalBolo)}</span>
          </div>
        </div>
      `;
    }).join('');

    html += `</div>`;
    bodyEl.innerHTML = html;

    modal.classList.remove('hidden');
  }

  // === GESTIÓN DE EVENTOS ===
  function setupEventListeners() {
    // CAMBIO DE TEMA CLARO/OSCURO
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', toggleTheme);
    }
    const btnSettingsThemeToggle = document.getElementById('btn-settings-theme-toggle');
    if (btnSettingsThemeToggle) {
      btnSettingsThemeToggle.addEventListener('click', toggleTheme);
    }

    // NAVEGACIÓN BOTTOM NAV (DELEGACIÓN DE EVENTOS ROBUSTA)
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.bottom-nav .nav-item');
      if (navItem) {
        e.preventDefault();
        const targetId = navItem.getAttribute('data-target');
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

          navItem.classList.add('active');
          targetSection.classList.add('active');
          window.scrollTo({ top: 0, behavior: 'smooth' });

          if (targetId === 'view-finanzas' || targetId === 'view-pasaporte') {
            renderFinances();
          } else if (targetId === 'view-bolos') {
            renderKPIs();
            renderBolosList();
          }
        }
        return;
      }

      // CLIC EN PINES DEL MAPA Y SELLOS DE PUEBLOS DEL PASAPORTE
      const townCard = e.target.closest('[data-town]');
      if (townCard) {
        e.preventDefault();
        const townName = townCard.getAttribute('data-town');
        if (townName && state.townMap && state.townMap[townName]) {
          openTownDetailModal(townName, state.townMap[townName]);
        }
      }
    });

    // BOTÓN RÁPIDO AÑADIR (HEADER)
    document.getElementById('btn-quick-add').addEventListener('click', () => {
      openModalBolo();
    });

    // FILTROS DE CHIPS
    document.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.currentFilter = chip.getAttribute('data-filter');
        renderBolosList();
      });
    });

    // DELEGACIÓN CLICS EN LISTA BOLOS (TOGGLE STATUS / VER DETALLE)
    document.getElementById('bolos-list').addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-action="toggle-status"]');
      if (toggleBtn) {
        e.stopPropagation();
        const id = toggleBtn.getAttribute('data-bolo-id');
        toggleBoloStatus(id);
        return;
      }

      const card = e.target.closest('.item-card');
      if (card) {
        const id = card.getAttribute('data-bolo-id');
        openBoloDetail(id);
      }
    });

    // SWITCH CAR Y CÁLCULO EN TIEMPO REAL
    const carSwitch = document.getElementById('bolo-has-car');
    const kmInput = document.getElementById('bolo-km');

    carSwitch.addEventListener('change', () => {
      const fields = document.getElementById('car-details-fields');
      if (carSwitch.checked) {
        fields.classList.remove('hidden');
      } else {
        fields.classList.add('hidden');
      }
      updateGasCalc();
    });

    kmInput.addEventListener('input', updateGasCalc);

    // CÁLCULO AUTOMÁTICO DE DURACIÓN EN HORAS SEGÚN HORAS DE INICIO Y FIN
    const startTimeInput = document.getElementById('bolo-start-time');
    const endTimeInput = document.getElementById('bolo-end-time');

    if (startTimeInput) {
      startTimeInput.addEventListener('change', calcHoursFromTimes);
      startTimeInput.addEventListener('input', calcHoursFromTimes);
    }
    if (endTimeInput) {
      endTimeInput.addEventListener('change', calcHoursFromTimes);
      endTimeInput.addEventListener('input', calcHoursFromTimes);
    }

    // SELECTOR DE CHARANGA (OTRA)
    document.querySelectorAll('input[name="charanga"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const otherContainer = document.getElementById('charanga-other-container');
        if (radio.value === 'Otra') {
          otherContainer.classList.remove('hidden');
          const otherInput = document.getElementById('bolo-charanga-other');
          if (otherInput) otherInput.focus();
        } else {
          otherContainer.classList.add('hidden');
        }
      });
    });

    // SELECCIÓN DE MÚSICOS (Gestionada dinámicamente en renderMemberTags)

    // AÑADIR NUEVO INSTRUMENTO PERSONALIZADO EN AJUSTES
    const btnAddInstCustom = document.getElementById('btn-add-custom-instrument');
    if (btnAddInstCustom) {
      btnAddInstCustom.addEventListener('click', () => {
        const input = document.getElementById('input-new-instrument-name');
        const val = input ? input.value.trim() : '';
        if (val) {
          const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);
          if (!state.allInstruments) state.allInstruments = [];
          if (!state.myInstruments) state.myInstruments = [];

          if (!state.allInstruments.includes(formattedVal)) {
            state.allInstruments.push(formattedVal);
          }
          if (!state.myInstruments.includes(formattedVal)) {
            state.myInstruments.push(formattedVal);
          }
          input.value = '';
          saveDataToStorage();
          renderAll();
        }
      });
    }

    // AÑADIR NUEVA CHARANGA EN AJUSTES
    const btnAddCharanga = document.getElementById('btn-add-charanga');
    if (btnAddCharanga) {
      btnAddCharanga.addEventListener('click', () => {
        const input = document.getElementById('input-new-charanga');
        const val = input ? input.value.trim() : '';
        if (val && !state.myCharangas.includes(val)) {
          state.myCharangas.push(val);
          input.value = '';
          saveDataToStorage();
          renderAll();
        }
      });
    }

    // CERRAR MODALES (DELEGACIÓN GLOBAL + CLIC FUERA Y TECLA ESCAPE)
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close]') || e.target.closest('.btn-close-modal');
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const modalId = closeBtn.getAttribute('data-close');
        if (modalId) {
          closeModal(modalId);
        } else {
          const modalOverlay = closeBtn.closest('.modal-overlay');
          if (modalOverlay) modalOverlay.classList.add('hidden');
        }
        return;
      }

      // Clic directo en el fondo oscuro (.modal-overlay)
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    });

    // FORMULARIO GUARDAR BOLO
    const formBolo = document.getElementById('form-bolo');
    if (formBolo) formBolo.addEventListener('submit', handleSaveBolo);

    const btnSaveBolo = document.getElementById('btn-save-bolo');
    if (btnSaveBolo) {
      btnSaveBolo.addEventListener('click', (e) => {
        handleSaveBolo(e);
      });
    }

    const btnDeleteBolo = document.getElementById('btn-delete-bolo');
    if (btnDeleteBolo) btnDeleteBolo.addEventListener('click', handleDeleteBolo);

    // AJUSTES
    document.getElementById('gas-rate-input').addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.gasRate = val;
        saveDataToStorage();
        updateGasRateDisplays();
        renderAll();
      }
    });

    document.getElementById('btn-export-data').addEventListener('click', exportBackup);
    document.getElementById('input-import-data').addEventListener('change', importBackup);
    document.getElementById('btn-load-sample').addEventListener('click', () => loadSampleData(true));
    document.getElementById('btn-clear-all').addEventListener('click', clearAllData);
  }

  // === MANEJO DE COBRAS RÁPIDAS Y ESTADOS ===
  function toggleBoloStatus(id) {
    const bolo = state.bolos.find(b => b.id === id);
    if (bolo) {
      if (bolo.status === 'upcoming') {
        bolo.status = 'pending';
      } else if (bolo.status === 'pending') {
        bolo.status = 'paid';
      } else {
        bolo.status = 'upcoming';
      }
      saveDataToStorage();
      renderAll();
    }
  }

  // === CÁLCULO DE GASOLINA EN MODAL ===
  function updateGasCalc() {
    const km = parseFloat(document.getElementById('bolo-km').value) || 0;
    const total = km * state.gasRate;
    document.getElementById('bolo-gas-calc').textContent = formatCurrency(total);
  }

  // === CÁLCULO AUTOMÁTICO DE HORAS (INICIO -> FIN) ===
  function calcHoursFromTimes() {
    const startTimeEl = document.getElementById('bolo-start-time');
    const endTimeEl = document.getElementById('bolo-end-time');
    const hoursEl = document.getElementById('bolo-hours');

    if (!startTimeEl || !endTimeEl || !hoursEl) return;
    const startVal = startTimeEl.value;
    const endVal = endTimeEl.value;

    if (startVal && endVal) {
      const [sH, sM] = startVal.split(':').map(Number);
      const [eH, eM] = endVal.split(':').map(Number);
      let sMins = sH * 60 + sM;
      let eMins = eH * 60 + eM;
      if (eMins <= sMins) {
        eMins += 24 * 60; // Cruza medianoche (madrugada)
      }
      const totalHours = Math.round(((eMins - sMins) / 60) * 10) / 10;
      if (totalHours > 0) {
        hoursEl.value = totalHours;
      }
    }
  }

  // === COMPONENTES TAGS EN MODAL ===
  function addMemberFromInput() {
    const input = document.getElementById('input-member-name');
    const name = input.value.trim();
    if (name && !state.editingBoloMembers.includes(name)) {
      state.editingBoloMembers.push(name);
      input.value = '';
      renderMemberTags();
    }
  }

  function removeMember(name) {
    const norm = String(name).toLowerCase().trim();
    state.editingBoloMembers = state.editingBoloMembers.filter(m => {
      const mName = typeof m === 'object' ? m.name : String(m);
      return mName.toLowerCase().trim() !== norm;
    });
    renderMemberTags();
  }

  function renderMemberTags() {
    const gridContainer = document.getElementById('modal-bolo-members-grid') || document.querySelector('#modal-bolo .members-toggle-grid');

    // Obtener miembros habituales de state.myMembers
    const habitualMembers = state.myMembers && state.myMembers.length > 0 ? state.myMembers : [
      { name: 'María', icon: '🎺' },
      { name: 'Angy (Trombón)', icon: 'Trombón' },
      { name: 'Dani', icon: '🎷' },
      { name: 'Lucía', icon: '🎷' },
      { name: 'Rubén (Caja)', icon: '🥁' },
      { name: 'Angel (Bombo)', icon: 'Bombo' },
      { name: 'Sara (Bombardino)', icon: 'Bombardino' }
    ];

    if (gridContainer) {
      gridContainer.innerHTML = habitualMembers.map(m => {
        const mName = typeof m === 'object' ? m.name : String(m);
        const isSelected = state.editingBoloMembers.some(em => {
          const emName = typeof em === 'object' ? em.name : String(em);
          return emName.toLowerCase().trim() === mName.toLowerCase().trim();
        });

        return `
          <button type="button" class="member-select-btn ${isSelected ? 'selected' : ''}" data-member="${escapeHtml(mName)}">
            <span class="member-status-icon">${isSelected ? '✅' : '➕'}</span>
            <span class="member-name">${formatMemberHTML(m)}</span>
          </button>
        `;
      }).join('');

      gridContainer.querySelectorAll('.member-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const name = btn.getAttribute('data-member');
          const idx = state.editingBoloMembers.findIndex(em => {
            const emName = typeof em === 'object' ? em.name : String(em);
            return emName.toLowerCase().trim() === name.toLowerCase().trim();
          });

          if (idx !== -1) {
            state.editingBoloMembers.splice(idx, 1);
          } else {
            const foundObj = habitualMembers.find(m => (typeof m === 'object' ? m.name : String(m)).toLowerCase().trim() === name.toLowerCase().trim());
            state.editingBoloMembers.push(foundObj || name);
          }
          renderMemberTags();
        });
      });
    }

    // Renderizar invitados extra (músicos no habituales añadidos manualmente)
    const extraMembers = state.editingBoloMembers.filter(em => {
      const emName = typeof em === 'object' ? em.name : String(em);
      return !habitualMembers.some(h => {
        const hName = typeof h === 'object' ? h.name : String(h);
        return hName.toLowerCase().trim() === emName.toLowerCase().trim();
      });
    });

    const extraContainer = document.getElementById('extra-members-list');
    if (extraContainer) {
      extraContainer.innerHTML = extraMembers.map(m => {
        const mName = typeof m === 'object' ? m.name : String(m);
        return `
          <span class="tag-chip">
            ${formatMemberHTML(m)}
            <button type="button" class="tag-remove" data-name="${escapeHtml(mName)}">&times;</button>
          </span>
        `;
      }).join('');

      extraContainer.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeMember(btn.getAttribute('data-name'));
        });
      });
    }
  }

  // === MODAL BOLO: APERTURA Y FORMULARIO ===
  function openModalBolo(boloId = null, prefillDate = null) {
    const modal = document.getElementById('modal-bolo');
    const titleEl = document.getElementById('modal-bolo-title');
    const deleteBtn = document.getElementById('btn-delete-bolo');

    document.getElementById('form-bolo').reset();
    state.editingBoloMembers = [];

    if (boloId) {
      const bolo = state.bolos.find(b => b.id === boloId);
      if (!bolo) return;

      titleEl.textContent = 'Editar Bolo';
      deleteBtn.classList.remove('hidden');

      document.getElementById('bolo-id').value = bolo.id;
      document.getElementById('bolo-name').value = bolo.name || '';
      const typeEl = document.getElementById('bolo-type');
      if (typeEl) typeEl.value = bolo.type || '';
      document.getElementById('bolo-date').value = bolo.date;
      
      const startTimeEl = document.getElementById('bolo-start-time');
      const endTimeEl = document.getElementById('bolo-end-time');
      const hoursEl = document.getElementById('bolo-hours');
      
      if (startTimeEl) startTimeEl.value = roundToHalfHour(bolo.startTime || bolo.time || '');
      if (endTimeEl) endTimeEl.value = roundToHalfHour(bolo.endTime || '');
      if (hoursEl) hoursEl.value = bolo.hours || '';

      document.getElementById('bolo-price').value = bolo.price || '';
      document.getElementById('bolo-status').value = bolo.status || 'pending';
      document.getElementById('bolo-notes').value = bolo.notes || '';

      // Charanga
      const charangaVal = bolo.charanga || 'MenudoChaperon';
      const otherContainer = document.getElementById('charanga-other-container');
      const otherInput = document.getElementById('bolo-charanga-other');

      if (charangaVal === 'MenudoChaperon' || charangaVal === 'VayaMovida') {
        const charRadio = document.querySelector(`input[name="charanga"][value="${charangaVal}"]`);
        if (charRadio) charRadio.checked = true;
        if (otherContainer) otherContainer.classList.add('hidden');
        if (otherInput) otherInput.value = '';
      } else {
        const otherRadio = document.querySelector(`input[name="charanga"][value="Otra"]`);
        if (otherRadio) otherRadio.checked = true;
        if (otherContainer) otherContainer.classList.remove('hidden');
        if (otherInput) otherInput.value = charangaVal;
      }

      // Instrumento
      renderInstrumentRadios(bolo.instrument);

      // Coche
      const hasCar = bolo.hasCar || false;
      document.getElementById('bolo-has-car').checked = hasCar;
      document.getElementById('car-details-fields').classList.toggle('hidden', !hasCar);
      document.getElementById('bolo-km').value = bolo.km || '';
      updateGasCalc();
      calcHoursFromTimes();

    } else {
      titleEl.textContent = 'Nuevo Bolo';
      deleteBtn.classList.add('hidden');

      document.getElementById('bolo-id').value = '';
      document.getElementById('bolo-date').value = prefillDate || new Date().toISOString().split('T')[0];

      // Reset radio charanga
      renderCharangaRadios();

      const otherContainer = document.getElementById('charanga-other-container');
      if (otherContainer) otherContainer.classList.add('hidden');
      const otherInput = document.getElementById('bolo-charanga-other');
      if (otherInput) otherInput.value = '';

      document.getElementById('car-details-fields').classList.add('hidden');
      updateGasCalc();
    }

    modal.classList.remove('hidden');

    // Resetear scroll siempre arriba del todo al abrir la modal
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;
    modal.scrollTop = 0;
  }

  function handleSaveBolo(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = document.getElementById('bolo-id').value;
    const nameInput = document.getElementById('bolo-name');
    const dateInput = document.getElementById('bolo-date');

    const name = nameInput ? nameInput.value.trim() : ''; // Pueblo
    const typeEl = document.getElementById('bolo-type');
    const type = typeEl ? typeEl.value.trim() : '';
    const date = dateInput ? dateInput.value : '';

    if (!name) {
      alert('Por favor, escribe el nombre del Pueblo para el bolo.');
      if (nameInput) nameInput.focus();
      return;
    }

    if (!date) {
      alert('Por favor, selecciona una Fecha para el bolo.');
      if (dateInput) dateInput.focus();
      return;
    }

    try {
      const startTimeEl = document.getElementById('bolo-start-time');
      const endTimeEl = document.getElementById('bolo-end-time');
      const hoursEl = document.getElementById('bolo-hours');

      const startTime = startTimeEl ? startTimeEl.value : '';
      const endTime = endTimeEl ? endTimeEl.value : '';
      const hours = hoursEl ? (parseFloat(hoursEl.value) || 0) : 0;
      const time = startTime || '';

      const price = parseFloat(document.getElementById('bolo-price').value) || 0;
      const status = document.getElementById('bolo-status').value;
      
      // Obtener Charanga de forma segura
      const charangaRadioChecked = document.querySelector('input[name="charanga"]:checked');
      let charangaRadio = charangaRadioChecked ? charangaRadioChecked.value : (state.myCharangas[0] || 'Charanga');
      let charanga = charangaRadio;
      if (charangaRadio === 'Otra') {
        const otherText = document.getElementById('bolo-charanga-other').value.trim();
        charanga = otherText || 'Otra Charanga';
      }

      const instrument = '';
      const hasCar = document.getElementById('bolo-has-car').checked;
      const km = hasCar ? (parseFloat(document.getElementById('bolo-km').value) || 0) : 0;
      const notes = document.getElementById('bolo-notes').value.trim();

      if (id) {
        // Modificar existente
        const index = state.bolos.findIndex(b => b.id === id);
        if (index !== -1) {
          state.bolos[index] = {
            ...state.bolos[index],
            name, type, date, startTime, endTime, hours, time, price, status, charanga, instrument, hasCar, km, notes
          };
        }
      } else {
        // Crear nuevo
        const newBolo = {
          id: Date.now().toString(),
          name, type, date, startTime, endTime, hours, time, price, status, charanga, instrument, hasCar, km, notes
        };
        state.bolos.push(newBolo);
      }

      saveDataToStorage();
      renderAll();
    } catch (err) {
      console.error('Error al guardar el bolo:', err);
    } finally {
      closeModal('modal-bolo');
    }
  }

  function handleDeleteBolo() {
    const id = document.getElementById('bolo-id').value;
    if (id && confirm('¿Estás seguro de eliminar este bolo?')) {
      state.bolos = state.bolos.filter(b => b.id !== id);
      saveDataToStorage();
      renderAll();
      closeModal('modal-bolo');
    }
  }

  // === DETALLE COMPLETO BOLO ===
  function openBoloDetail(id) {
    const bolo = state.bolos.find(b => b.id === id);
    if (!bolo) return;

    const modal = document.getElementById('modal-bolo-detail');
    const body = document.getElementById('detail-body');
    const editBtn = document.getElementById('btn-edit-detail-bolo');

    const gasMoney = bolo.hasCar && bolo.km ? (parseFloat(bolo.km) * state.gasRate) : 0;
    const timeInfo = bolo.startTime ? `${bolo.startTime}${bolo.endTime ? ' a ' + bolo.endTime : ''} ${bolo.hours ? '(' + bolo.hours + 'h)' : ''}` : (bolo.time ? bolo.time + 'h' : '');

    let statusClass = 'pending';
    let statusText = '⏳ Pendiente';
    if (bolo.status === 'upcoming') {
      statusClass = 'upcoming';
      statusText = '📅 Próximo';
    } else if (bolo.status === 'paid') {
      statusClass = 'paid';
      statusText = '✅ Cobrado';
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bolo.name + ', España')}`;

    body.innerHTML = `
      <div class="detail-section">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h2 style="font-family: var(--font-heading); font-size: 20px;">📍 ${escapeHtml(bolo.name)}</h2>
            <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps-subtle" title="Cómo llegar con Google Maps">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; opacity:0.85;"><rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)"/><path d="M9.5 15v-3.5a1.5 1.5 0 0 1 1.5-1.5h3.5"/><polyline points="12.5 8 15 10 12.5 12"/></svg>
              Cómo llegar
            </a>
          </div>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </div>

        <div class="detail-row"><span class="detail-icon">🎶</span> <strong>Charanga:</strong> ${escapeHtml(bolo.charanga || 'MenudoChaperon')}</div>
        ${bolo.type ? `<div class="detail-row"><span class="detail-icon">🎉</span> <strong>Tipo de bolo:</strong> ${escapeHtml(bolo.type)}</div>` : ''}
        <div class="detail-row"><span class="detail-icon">📅</span> <strong>Fecha:</strong> ${formatDateStr(bolo.date)}</div>
        ${timeInfo ? `<div class="detail-row"><span class="detail-icon">⏱️</span> <strong>Horario:</strong> ${timeInfo}</div>` : ''}
        <div class="detail-row"><span class="detail-icon">💰</span> <strong>Caché:</strong> ${formatCurrency(parseFloat(bolo.price) || 0)}</div>

        ${bolo.hasCar ? `
          <div class="detail-row" style="color: var(--status-cyan);">
            <span class="detail-icon">🚗</span> <strong>Gasolina:</strong> ${bolo.km} km (${formatCurrency(gasMoney)})
          </div>
        ` : ''}

        ${bolo.notes ? `
          <div style="background-color: var(--bg-input); padding: 12px; border-radius: var(--radius-md);">
            <strong style="font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 4px;">Notas:</strong>
            <p style="font-size: 14px; white-space: pre-wrap;">${escapeHtml(bolo.notes)}</p>
          </div>
        ` : ''}
      </div>
    `;

    editBtn.onclick = () => {
      closeModal('modal-bolo-detail');
      openModalBolo(bolo.id);
    };

    modal.classList.remove('hidden');
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  // === EXPORTACIÓN E IMPORTACIÓN BACKUP ===
  function exportBackup() {
    const data = {
      bolos: state.bolos,
      gasRate: state.gasRate,
      myCharangas: state.myCharangas,
      myMembers: state.myMembers,
      allInstruments: state.allInstruments,
      myInstruments: state.myInstruments,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charanga_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data.bolos)) {
          state.bolos = data.bolos;
          if (data.gasRate) state.gasRate = data.gasRate;
          if (Array.isArray(data.myCharangas)) state.myCharangas = data.myCharangas;
          if (Array.isArray(data.myMembers)) state.myMembers = data.myMembers;
          if (Array.isArray(data.allInstruments)) state.allInstruments = data.allInstruments;
          if (Array.isArray(data.myInstruments)) state.myInstruments = data.myInstruments;
          saveDataToStorage();
          renderAll();
          alert('¡Copia de seguridad restaurada con éxito!');
        } else {
          alert('El archivo JSON no tiene un formato válido de la app.');
        }
      } catch (err) {
        alert('Error al leer el archivo de copia de seguridad.');
      }
    };
    reader.readAsText(file);
  }

  function loadSampleData(confirmUser = true) {
    if (confirmUser && !confirm('¿Cargar datos de ejemplo? Esto añadirá bolos demostrativos.')) {
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const sampleBolos = [
      {
        id: 'sample-1',
        name: 'Villar del Río',
        type: 'Pasacalles',
        date: todayStr,
        startTime: '18:30',
        endTime: '21:30',
        hours: 3,
        price: 120,
        status: 'pending',
        charanga: 'Charanga La Movida',
        instrument: 'Trompeta',
        hasCar: true,
        km: 90,
        members: ['María 🎺', 'Angy 📯', 'Dani 🎷', 'Rubén 🥁'],
        notes: 'Pasacalles y diana floreada.'
      },
      {
        id: 'sample-2',
        name: 'Béjar',
        type: 'Procesión',
        date: '2026-08-10',
        startTime: '17:00',
        endTime: '20:00',
        hours: 3,
        price: 150,
        status: 'pending',
        charanga: 'Charanga Los Rumberos',
        instrument: 'Caja',
        hasCar: true,
        km: 140,
        members: ['Dani 🎷', 'Lucía 🎷', 'Angel 🥁'],
        notes: 'Vestimenta oficial.'
      },
      {
        id: 'sample-3',
        name: 'Ciudad Rodrigo',
        type: 'Vermú',
        date: '2026-07-05',
        startTime: '12:00',
        endTime: '15:00',
        hours: 3,
        price: 100,
        status: 'paid',
        charanga: 'Charanga La Movida',
        instrument: 'Bombo',
        hasCar: false,
        km: 0,
        members: ['María 🎺', 'Sara 🪘'],
        notes: 'Cobrado en mano tras finalizar.'
      }
    ];

    state.bolos = sampleBolos;
    saveDataToStorage();
    renderAll();
  }

  function clearAllData() {
    if (confirm('⚠️ ¿ATENCIÓN! ¿Quieres eliminar TODOS los bolos guardados?')) {
      state.bolos = [];
      saveDataToStorage();
      renderAll();
    }
  }

  // === HELPERS DE FORMATO Y UTILIDADES ===
  function formatCurrency(val) {
    return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  }

  function formatDateStr(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  function getInstrumentIcon(inst) {
    if (!inst) return '🎵';
    const norm = inst.toLowerCase().trim();

    if (norm.includes('sé') || norm.includes('se') || norm.includes('?')) {
      return '❓';
    }

    if (norm.includes('bombo')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="display:inline-block; vertical-align:-2px;"><path d="M5.5 4.5 C8.5 4.2 12.5 4.5 15.5 3.5 L15.5 20.5 C12.5 19.5 8.5 19.8 5.5 19.5 C2.8 16.5 2.8 7.5 5.5 4.5 Z" fill="#C46D2E" stroke="#5C2508" stroke-width="1.1"/><path d="M8.5 4.2 C11 4.1 13.5 4.3 15.5 3.5 L15.5 20.5 C13.5 19.7 11 20 8.5 19.8 Z" fill="#E58E44" opacity="0.45"/><ellipse cx="15.5" cy="12" rx="6.5" ry="8.5" fill="none" stroke="#5C2508" stroke-width="1.8"/><ellipse cx="15.5" cy="12" rx="5.5" ry="7.5" fill="#FAFAFA" stroke="#CBD5E1" stroke-width="1"/><rect x="14.7" y="3" width="1.6" height="1.4" rx="0.4" fill="#E2E8F0" stroke="#475569" stroke-width="0.6"/><rect x="14.7" y="19.6" width="1.6" height="1.4" rx="0.4" fill="#E2E8F0" stroke="#475569" stroke-width="0.6"/><rect x="21" y="11.3" width="1.4" height="1.6" rx="0.4" fill="#E2E8F0" stroke="#475569" stroke-width="0.6"/><rect x="9" y="11.3" width="1.4" height="1.6" rx="0.4" fill="#E2E8F0" stroke="#475569" stroke-width="0.6"/><line x1="2" y1="22" x2="8" y2="13.5" stroke="#B45309" stroke-width="2.2" stroke-linecap="round"/><circle cx="8" cy="13.5" r="2.5" fill="#FFFBEB" stroke="#78350F" stroke-width="1"/></svg>`;
    }

    if (norm.includes('bombardino') || norm.includes('eufonio')) {
      return `<img src="bombardino.png" alt="Bombardino" style="width:18px; height:18px; object-fit:contain; display:inline-block; vertical-align:-4px;">`;
    }

    if (norm.includes('trombon') || norm.includes('trombón')) {
      return `<img src="trombon.png" alt="Trombón" style="width:21px; height:21px; object-fit:contain; display:inline-block; vertical-align:-4px;">`;
    }

    switch (inst) {
      case 'Caja': return '🥁';
      case 'Trompeta': return '🎺';
      case 'Saxofón': return '🎷';
      case 'Piano': return '🎹';
      case 'Aún no sé': return '❓';
      default: return '🎵';
    }
  }

  function formatMemberHTML(memberInput) {
    if (!memberInput) return '';
    let nameStr = '';
    let iconStr = '';

    if (typeof memberInput === 'object') {
      nameStr = (memberInput.name || '').trim();
      iconStr = (memberInput.icon || '').trim();
    } else {
      nameStr = String(memberInput).trim();
    }

    const combined = (nameStr + ' ' + iconStr).toLowerCase();

    if (combined.includes('trombon') || combined.includes('trombón') || combined.includes('📯')) {
      const clean = nameStr.replace(/📯/g, '').trim();
      return `${escapeHtml(clean)} ${getInstrumentIcon('Trombón')}`;
    }
    if (combined.includes('bombardino') || combined.includes('eufonio')) {
      return `${escapeHtml(nameStr)} ${getInstrumentIcon('Bombardino')}`;
    }
    if (combined.includes('bombo') || combined.includes('🪘')) {
      const clean = nameStr.replace(/🪘/g, '').trim();
      return `${escapeHtml(clean)} ${getInstrumentIcon('Bombo')}`;
    }
    if (combined.includes('trompeta') || combined.includes('🎺')) {
      const clean = nameStr.replace(/🎺/g, '').trim();
      return `${escapeHtml(clean)} 🎺`;
    }
    if (combined.includes('saxo') || combined.includes('saxofón') || combined.includes('🎷')) {
      const clean = nameStr.replace(/🎷/g, '').trim();
      return `${escapeHtml(clean)} 🎷`;
    }
    if (combined.includes('caja') || combined.includes('🥁')) {
      const clean = nameStr.replace(/🥁/g, '').trim();
      return `${escapeHtml(clean)} 🥁`;
    }
    if (combined.includes('piano') || combined.includes('🎹')) {
      const clean = nameStr.replace(/🎹/g, '').trim();
      return `${escapeHtml(clean)} 🎹`;
    }

    const fallbackIcon = iconStr ? escapeHtml(iconStr) : '👤';
    return `${escapeHtml(nameStr)} ${fallbackIcon}`;
  }

  // === MÓDULO DE AUTENTICACIÓN GOOGLE Y SINCRONIZACIÓN NUBE (FIREBASE) ===
  const cloudSync = {
    user: null,
    db: null,
    auth: null
  };

  function initCloudSync() {
    // Cargar cuenta de Google guardada en este dispositivo
    const savedUser = localStorage.getItem('bolotracker_cloud_user');
    if (savedUser) {
      try {
        cloudSync.user = JSON.parse(savedUser);
      } catch (e) {
        console.error('Error leyendo cuenta guardada:', e);
      }
    }

    if (typeof firebase !== 'undefined') {
      const firebaseConfig = {
        apiKey: "AIzaSyDemoBoloTrackerApiKey2026",
        authDomain: "bolotracker-app.firebaseapp.com",
        projectId: "bolotracker-app",
        storageBucket: "bolotracker-app.appspot.com",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:abcdef123456"
      };

      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        cloudSync.auth = firebase.auth();
        cloudSync.db = firebase.firestore();

        cloudSync.auth.onAuthStateChanged(user => {
          if (user) {
            cloudSync.user = {
              uid: user.uid,
              displayName: user.displayName || 'Músico',
              email: user.email || '',
              photoURL: user.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c'
            };
            localStorage.setItem('bolotracker_cloud_user', JSON.stringify(cloudSync.user));
            syncFromCloud();
          }
          updateCloudUI();
        });
      } catch (err) {
        console.log('Firebase local fallback activo:', err);
      }
    }

    setupCloudEventListeners();
    updateCloudUI();
  }

  function setupCloudEventListeners() {
    const loginBtn = document.getElementById('btn-google-login');
    const logoutBtn = document.getElementById('btn-google-logout');
    const manualSyncBtn = document.getElementById('btn-manual-sync');
    const confirmGoogleLoginBtn = document.getElementById('btn-confirm-google-login');

    if (loginBtn) {
      loginBtn.addEventListener('click', handleGoogleLogin);
    }
    if (confirmGoogleLoginBtn) {
      confirmGoogleLoginBtn.addEventListener('click', executeGoogleLoginFromModal);
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleGoogleLogout);
    }
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', () => {
        if (cloudSync.user) {
          syncFromCloud();
          alert(`¡Sincronización de la cuenta (${cloudSync.user.email}) completada!`);
        } else {
          alert('Debes conectar tu cuenta de Google primero.');
        }
      });
    }
  }

  function handleGoogleLogin() {
    // Abrir modal interactivo de Google Login
    const modal = document.getElementById('modal-google-login');
    if (modal) {
      modal.classList.remove('hidden');
    } else {
      promptGoogleAccountFallback();
    }
  }

  function executeGoogleLoginFromModal() {
    const emailInput = document.getElementById('google-email-input');
    const inputEmail = emailInput ? emailInput.value.trim() : '';

    if (!inputEmail || !inputEmail.includes('@')) {
      alert('Por favor, escribe un correo electrónico de Google válido.');
      if (emailInput) emailInput.focus();
      return;
    }

    const cleanEmail = inputEmail.trim();
    const namePart = cleanEmail.split('@')[0];
    const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const userUid = 'user_' + cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    cloudSync.user = {
      uid: userUid,
      displayName: displayName,
      email: cleanEmail,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(namePart)}`
    };

    localStorage.setItem('bolotracker_cloud_user', JSON.stringify(cloudSync.user));
    updateCloudUI();
    syncToCloud();

    closeModal('modal-google-login');
    alert(`✅ ¡Cuenta de Google vinculada con éxito (${cleanEmail})!\nTus bolos y cobros están sincronizados en la nube.`);
  }

  function handleGoogleLogout() {
    if (confirm('¿Quieres cerrar sesión de tu cuenta de Google? Tus bolos continuarán guardados en este dispositivo.')) {
      if (cloudSync.auth && cloudSync.auth.currentUser) {
        cloudSync.auth.signOut();
      }
      cloudSync.user = null;
      localStorage.removeItem('bolotracker_cloud_user');
      updateCloudUI();
    }
  }

  function updateCloudUI() {
    const unauthBox = document.getElementById('cloud-status-unauth');
    const authBox = document.getElementById('cloud-status-auth');
    const avatar = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-email');

    if (cloudSync.user) {
      if (unauthBox) unauthBox.classList.add('hidden');
      if (authBox) authBox.classList.remove('hidden');

      if (avatar) avatar.src = cloudSync.user.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
      if (nameEl) nameEl.textContent = cloudSync.user.displayName || 'Músico';
      if (emailEl) emailEl.textContent = cloudSync.user.email || '';
    } else {
      if (unauthBox) unauthBox.classList.remove('hidden');
      if (authBox) authBox.classList.add('hidden');
    }
  }

  async function syncFromCloud() {
    if (!cloudSync.user || !cloudSync.db) return;
    try {
      const docRef = cloudSync.db.collection('users').doc(cloudSync.user.uid);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const cloudData = docSnap.data();
        if (cloudData.bolos && Array.isArray(cloudData.bolos)) {
          state.bolos = cloudData.bolos;
        }
        if (cloudData.myCharangas && Array.isArray(cloudData.myCharangas)) {
          state.myCharangas = cloudData.myCharangas;
        }
        if (cloudData.myInstruments && Array.isArray(cloudData.myInstruments)) {
          state.myInstruments = cloudData.myInstruments;
        }
        if (cloudData.allInstruments && Array.isArray(cloudData.allInstruments)) {
          state.allInstruments = cloudData.allInstruments;
        }
        if (cloudData.gasRate) {
          state.gasRate = cloudData.gasRate;
        }
        // Guardar localmente la versión descargada de la nube
        localStorage.setItem('charanga_bolos', JSON.stringify(state.bolos));
        localStorage.setItem('charanga_gasRate', state.gasRate.toString());
        localStorage.setItem('charanga_myCharangas', JSON.stringify(state.myCharangas));
        localStorage.setItem('charanga_allInstruments', JSON.stringify(state.allInstruments));
        localStorage.setItem('charanga_myInstruments', JSON.stringify(state.myInstruments));

        renderAll();
      } else {
        // Primera vez en la nube para este usuario: Migrar bolos locales a la nube automáticamente
        syncToCloud();
      }
    } catch (err) {
      console.error('Error sincronizando desde la nube:', err);
    }
  }

  async function syncToCloud() {
    if (!cloudSync.user || !cloudSync.db) return;
    try {
      const docRef = cloudSync.db.collection('users').doc(cloudSync.user.uid);
      await docRef.set({
        bolos: state.bolos,
        myCharangas: state.myCharangas,
        myInstruments: state.myInstruments,
        allInstruments: state.allInstruments,
        gasRate: state.gasRate,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Error guardando en la nube:', err);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});
