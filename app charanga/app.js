(() => {
  // Diagnóstico global: capturar cualquier error de JS o promesa no controlada
  // en cuanto ocurra, incluso antes de que el resto de la app cargue, y guardarlo
  // para poder verlo en el panel de depuración de Ajustes sin consola del navegador.
  window.addEventListener('error', (e) => {
    try {
      const msg = 'JS: ' + (e.message || 'error desconocido') + ' @ ' + (e.filename || '?').split('/').pop() + ':' + (e.lineno || '?');
      localStorage.setItem('bolotracker_last_js_error', msg);
    } catch (err) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try {
      const reason = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
      localStorage.setItem('bolotracker_last_js_error', 'Promise: ' + reason);
    } catch (err) {}
  });

  // Limpiar cualquier error guardado de una carga anterior: si esta carga no
  // produce ningún error nuevo, el panel de depuración no debe seguir
  // mostrando indefinidamente un aviso de una versión ya corregida.
  try { localStorage.removeItem('bolotracker_last_js_error'); } catch (err) {}

  // === ESTADO GLOBAL ===
  let state = {
    bolos: [],
    gasRate: 0.30,
    myCharangas: ['Charanga La Movida', 'Charanga Los Rumberos'],
    charangaColors: {},
    charangaGasRates: {},
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
    currentFilter: 'upcoming',
    currentView: 'list', // 'list' | 'calendar'
    calendarDate: new Date(),
    editingBoloMembers: [],
    passportSearchQuery: ''
  };

  // === INICIALIZACIÓN DE LA APLICACIÓN ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  function initApp() {
    try { renderDebugUI(); } catch (e) {}
    exportGlobalHandlers();
    state.currentFilter = 'upcoming';
    initTheme();
    populateTimeSelects();
    loadDataFromStorage();
    const hasCloudAccount = !!localStorage.getItem('bolotracker_cloud_user');
    if ((!state.bolos || state.bolos.length === 0) && !hasCloudAccount) {
      loadSampleData(false); // Cargar datos demo solo si es un usuario nuevo sin cuenta en la nube
    }
    setupEventListeners();
    renderAll();

    // Re-renderizado de seguridad para asegurar contador y KPIs sincronizados
    setTimeout(() => {
      renderAll();
    }, 50);

    try {
      initCloudSync();
    } catch (e) {
      console.warn('Servicio de nube no disponible o bloqueado:', e);
    }
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
      const storedCharangaColors = localStorage.getItem('charanga_charangaColors');
      const storedCharangaGasRates = localStorage.getItem('charanga_charangaGasRates');
      const storedMembers = localStorage.getItem('charanga_myMembers');
      const storedAllInstruments = localStorage.getItem('charanga_allInstruments');
      const storedMyInstruments = localStorage.getItem('charanga_myInstruments');
      const storedOverrides = localStorage.getItem('charanga_townLocationOverrides');

      if (storedBolos !== null) {
        try {
          const parsed = JSON.parse(storedBolos);
          if (Array.isArray(parsed)) {
            state.bolos = parsed;
          }
        } catch (e) {}
      }
      if (storedRate) state.gasRate = parseFloat(storedRate) || 0.30;
      if (storedCharangas) state.myCharangas = JSON.parse(storedCharangas);
      if (storedCharangaColors) {
        try { state.charangaColors = JSON.parse(storedCharangaColors); } catch (e) {}
      }
      if (storedCharangaGasRates) {
        try { state.charangaGasRates = JSON.parse(storedCharangaGasRates); } catch (e) {}
      }
      if (storedMembers) state.myMembers = JSON.parse(storedMembers);
      if (storedAllInstruments) state.allInstruments = JSON.parse(storedAllInstruments);
      if (storedMyInstruments) state.myInstruments = JSON.parse(storedMyInstruments);
      if (storedOverrides) {
        try { state.townLocationOverrides = JSON.parse(storedOverrides); } catch (e) {}
      }

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

      updateGasRateDisplays();
    } catch (e) {
      console.error('Error cargando datos:', e);
    }
  }

  function saveDataToStorage() {
    localStorage.setItem('charanga_bolos', JSON.stringify(state.bolos));
    localStorage.setItem('charanga_gasRate', state.gasRate.toString());
    localStorage.setItem('charanga_myCharangas', JSON.stringify(state.myCharangas));
    localStorage.setItem('charanga_charangaColors', JSON.stringify(state.charangaColors));
    localStorage.setItem('charanga_charangaGasRates', JSON.stringify(state.charangaGasRates));
    localStorage.setItem('charanga_myMembers', JSON.stringify(state.myMembers));
    localStorage.setItem('charanga_allInstruments', JSON.stringify(state.allInstruments));
    localStorage.setItem('charanga_myInstruments', JSON.stringify(state.myInstruments));
    localStorage.setItem('charanga_townLocationOverrides', JSON.stringify(state.townLocationOverrides || {}));

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
    if (!state.currentFilter) state.currentFilter = 'upcoming';
    renderCharangasSettings();
    renderCharangaRadios();
    renderFilterChips();
    renderKPIs();
    renderBolosList();
    renderCalendar();
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

  // === COLORES POR GRUPO (CHARANGA) ===
  // Paleta ampliada a petición del usuario. "Rojo" y "amarillo claro" caen
  // cerca del rojo de peligro y del dorado de marca por definición (son esos
  // colores), el resto se mantiene distinto del resto de la app: azul de
  // "próximo", verde de "cobrado", cian de coche/gasolina. El "morado oscuro"
  // sustituye al antiguo índigo en el mismo puesto de la paleta (los grupos
  // que ya lo tenían asignado pasan a este color automáticamente).
  const CHARANGA_COLOR_PALETTE = [
    { text: '#F472B6', rgb: '236, 72, 153' },   // rosa
    { text: '#A3E635', rgb: '132, 204, 22' },   // lima
    { text: '#9333EA', rgb: '147, 51, 234' },   // morado oscuro
    { text: '#E879F9', rgb: '217, 70, 239' },   // fucsia
    { text: '#94A3B8', rgb: '100, 116, 139' },  // pizarra
    { text: '#F87171', rgb: '248, 113, 113' },  // rojo
    { text: '#FDE047', rgb: '253, 224, 71' },   // amarillo claro
    { text: '#BE123C', rgb: '190, 18, 60' },    // granate
    { text: '#7DD3FC', rgb: '125, 211, 252' }   // azul claro
  ];

  function getCharangaColorIndex(name) {
    if (!name) return 0;
    if (!state.charangaColors) state.charangaColors = {};
    if (typeof state.charangaColors[name] !== 'number') {
      const usedCount = Object.keys(state.charangaColors).length;
      state.charangaColors[name] = usedCount % CHARANGA_COLOR_PALETTE.length;
    }
    return state.charangaColors[name];
  }

  function getCharangaColor(name) {
    return CHARANGA_COLOR_PALETTE[getCharangaColorIndex(name)];
  }

  function charangaColorStyle(name) {
    const c = getCharangaColor(name);
    return `background-color:rgba(${c.rgb},0.15);color:${c.text};border-color:rgba(${c.rgb},0.35);`;
  }

  function getCharangaGasRate(name) {
    if (name && typeof state.charangaGasRates[name] === 'number') {
      return state.charangaGasRates[name];
    }
    return state.gasRate;
  }

  // Importe de gasolina de un bolo: usa el valor guardado explícitamente si
  // existe (el usuario pudo modificarlo a mano), y si no, lo calcula a partir
  // del km y la tarifa del grupo (compatibilidad con bolos guardados antes de
  // que este campo existiera como tal).
  function getBoloGasAmount(bolo) {
    if (typeof bolo.gasAmount === 'number') return Math.round(bolo.gasAmount);
    if (bolo.hasCar && bolo.km) {
      return Math.round(parseFloat(bolo.km) * getCharangaGasRate(bolo.charanga));
    }
    return 0;
  }

  function suggestNextCharangaColorIndex() {
    const usedIndices = Object.values(state.charangaColors || {});
    for (let i = 0; i < CHARANGA_COLOR_PALETTE.length; i++) {
      if (!usedIndices.includes(i)) return i;
    }
    return usedIndices.length % CHARANGA_COLOR_PALETTE.length;
  }

  function renderColorPickerButton(btnEl, index) {
    if (!btnEl) return;
    btnEl.style.backgroundColor = CHARANGA_COLOR_PALETTE[index].text;
  }

  function renderColorPickerMenu(menuEl, selectedIndex, onSelect) {
    menuEl.innerHTML = CHARANGA_COLOR_PALETTE.map((c, idx) => `
      <button type="button" class="color-swatch-option ${idx === selectedIndex ? 'selected' : ''}" data-idx="${idx}" style="background-color:${c.text};" title="Elegir este color"></button>
    `).join('');
    menuEl.querySelectorAll('.color-swatch-option').forEach(optBtn => {
      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(parseInt(optBtn.getAttribute('data-idx'), 10));
        menuEl.classList.add('hidden');
      });
    });
  }

  // Índice de color elegido en el selector de "nuevo grupo" (Ajustes), antes de pulsar Añadir
  let newCharangaColorIndex = 0;
  // Índice de color elegido en el modal de "editar grupo", antes de pulsar Guardar
  let editCharangaColorIndex = 0;

  function renderCharangasSettings() {
    const container = document.getElementById('settings-charangas-list');
    if (!container) return;

    container.innerHTML = state.myCharangas.map(ch => {
      const gasRate = getCharangaGasRate(ch);
      const ratesText = `⛽ ${gasRate.toFixed(2)} €/km`;
      return `
        <div class="charanga-settings-card btn-edit-charanga" data-charanga="${escapeHtml(ch)}">
          <span class="charanga-color-dot-static" style="background-color:${getCharangaColor(ch).text};"></span>
          <div class="charanga-settings-card-info">
            <strong>🎶 ${escapeHtml(ch)}</strong>
            <span class="charanga-settings-card-rates">${ratesText}</span>
          </div>
          <button type="button" class="tag-remove btn-del-charanga" data-charanga="${escapeHtml(ch)}" title="Eliminar grupo">&times;</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-del-charanga').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.getAttribute('data-charanga');
        state.myCharangas = state.myCharangas.filter(c => c !== name);
        delete state.charangaColors[name];
        delete state.charangaGasRates[name];
        saveDataToStorage();
        renderAll();
      });
    });

    container.querySelectorAll('.btn-edit-charanga').forEach(chip => {
      chip.addEventListener('click', () => {
        openEditCharangaModal(chip.getAttribute('data-charanga'));
      });
    });

    // Preparar el color sugerido por defecto para el próximo grupo a añadir
    newCharangaColorIndex = suggestNextCharangaColorIndex();
    renderColorPickerButton(document.getElementById('btn-new-charanga-color'), newCharangaColorIndex);
  }

  function openEditCharangaModal(name) {
    const modal = document.getElementById('modal-edit-charanga');
    const nameInput = document.getElementById('edit-charanga-name');
    const originalInput = document.getElementById('edit-charanga-original-name');
    const swatchBtn = document.getElementById('btn-edit-charanga-color');
    const gasRateInput = document.getElementById('edit-charanga-gas-rate');
    if (!modal || !nameInput || !originalInput || !swatchBtn) return;

    originalInput.value = name;
    nameInput.value = name;
    editCharangaColorIndex = getCharangaColorIndex(name);
    renderColorPickerButton(swatchBtn, editCharangaColorIndex);
    if (gasRateInput) gasRateInput.value = getCharangaGasRate(name);

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
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
            <span class="charanga-color-dot-static" style="background-color:${getCharangaColor(ch).text};"></span>
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
        updateGasCalc();
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
      const gasMoney = getBoloGasAmount(b);
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

  function renderBolosList() {
    const container = document.getElementById('bolos-list');
    const countBadge = document.getElementById('bolos-count');
    if (!state.bolos || !Array.isArray(state.bolos)) {
      state.bolos = [];
    }

    // Normalizar filtro actual
    if (!state.currentFilter || state.currentFilter === 'all') {
      state.currentFilter = 'upcoming';
    }

    // Filtrar bolos de forma limpia y robusta
    let filtered = [];
    if (state.currentFilter === 'upcoming') {
      filtered = state.bolos.filter(b => (b.status || 'pending') === 'upcoming');
    } else if (state.currentFilter === 'pending') {
      filtered = state.bolos.filter(b => (b.status || 'pending') === 'pending');
    } else if (state.currentFilter === 'paid') {
      filtered = state.bolos.filter(b => (b.status || 'pending') === 'paid');
    } else if (state.currentFilter === 'car') {
      filtered = state.bolos.filter(b => Boolean(b.hasCar));
    } else {
      // Filtro por charanga / grupo específico
      filtered = state.bolos.filter(b => b.charanga === state.currentFilter);
    }

    // Ordenación inteligente según filtro
    try {
      filtered.sort((a, b) => {
        const timeA = a.startTime || a.time || '00:00';
        const timeB = b.startTime || b.time || '00:00';
        const dateA = a.date ? new Date(a.date + 'T' + timeA).getTime() : 0;
        const dateB = b.date ? new Date(b.date + 'T' + timeB).getTime() : 0;

        if (state.currentFilter === 'upcoming') {
          return dateA - dateB; // Próximos: del más cercano a más lejano en el tiempo
        }
        // Pendientes, Cobrados y resto de filtros: del más reciente al más antiguo
        return dateB - dateA;
      });
    } catch (e) {
      console.warn('Error ordenando bolos:', e);
    }

    if (countBadge) countBadge.textContent = filtered.length.toString();

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
      const gasMoney = getBoloGasAmount(bolo);
      const totalPrice = cachePrice + gasMoney;
      
      const instrumentIcon = getInstrumentIcon(bolo.instrument);
      const charangaName = bolo.charanga || 'MenudoChaperon';
      const timeStr = bolo.startTime ? `${bolo.startTime}${bolo.endTime ? ' - ' + bolo.endTime : ''}` : (bolo.time ? bolo.time + 'h' : '');

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bolo.name + ', España')}`;

      return `
        <div class="item-card" data-bolo-id="${bolo.id}" onclick="openBoloDetail('${bolo.id}')">
          <div class="item-top-row">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="item-title">📍 ${escapeHtml(bolo.name)}</h3>
              <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-maps-subtle" title="Cómo llegar con Google Maps GPS" onclick="event.stopPropagation();">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; opacity:0.85;"><rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)"/><path d="M9.5 15v-3.5a1.5 1.5 0 0 1 1.5-1.5h3.5"/><polyline points="12.5 8 15 10 12.5 12"/></svg>
                Cómo llegar
              </a>
            </div>
            <div class="status-dropdown-wrapper" onclick="event.stopPropagation();">
              <button type="button" class="status-badge ${statusClass}" onclick="event.stopPropagation(); handleOpenStatusMenu(event, '${bolo.id}')">
                ${statusText} ▾
              </button>
              <div id="status-menu-${bolo.id}" class="status-dropdown-menu hidden" onclick="event.stopPropagation();">
                <button type="button" class="status-opt-item ${bolo.status === 'upcoming' ? 'active' : ''}" onclick="event.stopPropagation(); handleSetStatus(event, '${bolo.id}', 'upcoming')">
                  📅 Próximo
                </button>
                <button type="button" class="status-opt-item ${bolo.status === 'pending' ? 'active' : ''}" onclick="event.stopPropagation(); handleSetStatus(event, '${bolo.id}', 'pending')">
                  ⏳ Pendiente
                </button>
                <button type="button" class="status-opt-item ${bolo.status === 'paid' ? 'active' : ''}" onclick="event.stopPropagation(); handleSetStatus(event, '${bolo.id}', 'paid')">
                  ✅ Cobrado
                </button>
              </div>
            </div>
          </div>

          <div class="item-meta">
            <span class="item-meta-icon">📅 ${formatDateStr(bolo.date)}${timeStr ? ' (' + timeStr + ')' : ''}</span>
          </div>

          <div class="item-pills-row">
            <span class="pill-info pill-charanga" style="${charangaColorStyle(charangaName)}">🎶 ${escapeHtml(charangaName)}</span>
            ${bolo.type ? `<span class="pill-info">🎉 ${escapeHtml(bolo.type)}</span>` : ''}
            ${bolo.hours ? `<span class="pill-info">⏱️ ${bolo.hours}h</span>` : ''}
            ${bolo.hasCar ? `<span class="pill-info pill-car">🚗 ${bolo.km} km</span>` : ''}
            ${bolo.members && bolo.members.length > 0 ? `<span class="pill-info">👥 ${bolo.members.length} componentes</span>` : ''}
          </div>

          <div class="item-footer">
            <div class="footer-prices-left">
              <span class="price-cache-muted">Caché: ${formatCurrency(cachePrice)}</span>
              ${gasMoney > 0 ? `<span class="price-gas-blue">+${formatCurrency(gasMoney)}</span>` : ''}
            </div>
            <span class="price-total-highlight ${statusClass}">${formatCurrency(totalPrice)}</span>
          </div>
        </div>
      `;
    }).join('');
  }



  function handleFinancesFilterChange() {
    const yearEl = document.getElementById('fin-filter-year');
    const monthEl = document.getElementById('fin-filter-month');
    if (yearEl) state.financesFilterYear = yearEl.value;
    if (monthEl) state.financesFilterMonth = monthEl.value;
    renderFinances();
  }

  // === CLASIFICACIÓN DE MUNICIPIOS (PROVINCIAS Y COMUNIDADES AUTÓNOMAS DE ESPAÑA) ===
  const SPAIN_TOWNS_MAP = {
    // Salamanca (Comarca por comarca, pueblos principales y pedanías)
    'salamanca': { province: 'Salamanca', region: 'Castilla y León', isCapital: true },
    'vitigudino': { province: 'Salamanca', region: 'Castilla y León' },
    'majugajes': { province: 'Salamanca', region: 'Castilla y León' },
    'alderodrigo': { province: 'Salamanca', region: 'Castilla y León' },
    'bejar': { province: 'Salamanca', region: 'Castilla y León' },
    'béjar': { province: 'Salamanca', region: 'Castilla y León' },
    'ciudad rodrigo': { province: 'Salamanca', region: 'Castilla y León' },
    'mirobriga': { province: 'Salamanca', region: 'Castilla y León' },
    'peñaranda': { province: 'Salamanca', region: 'Castilla y León' },
    'peñaranda de bracamonte': { province: 'Salamanca', region: 'Castilla y León' },
    'bracamonte': { province: 'Salamanca', region: 'Castilla y León' },
    'alba de tormes': { province: 'Salamanca', region: 'Castilla y León' },
    'guijuelo': { province: 'Salamanca', region: 'Castilla y León' },
    'santa marta': { province: 'Salamanca', region: 'Castilla y León' },
    'santa marta de tormes': { province: 'Salamanca', region: 'Castilla y León' },
    'carbajosa': { province: 'Salamanca', region: 'Castilla y León' },
    'carbajosa de la sagrada': { province: 'Salamanca', region: 'Castilla y León' },
    'villamayor': { province: 'Salamanca', region: 'Castilla y León' },
    'villamayor de armuña': { province: 'Salamanca', region: 'Castilla y León' },
    'villares de la reina': { province: 'Salamanca', region: 'Castilla y León' },
    'villares': { province: 'Salamanca', region: 'Castilla y León' },
    'cabrerizos': { province: 'Salamanca', region: 'Castilla y León' },
    'ledesma': { province: 'Salamanca', region: 'Castilla y León' },
    'lumbrales': { province: 'Salamanca', region: 'Castilla y León' },
    'la alberca': { province: 'Salamanca', region: 'Castilla y León' },
    'alberca': { province: 'Salamanca', region: 'Castilla y León' },
    'tamames': { province: 'Salamanca', region: 'Castilla y León' },
    'macotera': { province: 'Salamanca', region: 'Castilla y León' },
    'babilafuente': { province: 'Salamanca', region: 'Castilla y León' },
    'villoria': { province: 'Salamanca', region: 'Castilla y León' },
    'villoruela': { province: 'Salamanca', region: 'Castilla y León' },
    'arabayona': { province: 'Salamanca', region: 'Castilla y León' },
    'arabayona de mogica': { province: 'Salamanca', region: 'Castilla y León' },
    'candelario': { province: 'Salamanca', region: 'Castilla y León' },
    'san muñoz': { province: 'Salamanca', region: 'Castilla y León' },
    'san felices': { province: 'Salamanca', region: 'Castilla y León' },
    'san felices de los gallegos': { province: 'Salamanca', region: 'Castilla y León' },
    'sequeros': { province: 'Salamanca', region: 'Castilla y León' },
    'mogarraz': { province: 'Salamanca', region: 'Castilla y León' },
    'aldeadavila': { province: 'Salamanca', region: 'Castilla y León' },
    'aldeadávila': { province: 'Salamanca', region: 'Castilla y León' },
    'aldeadávila de la ribera': { province: 'Salamanca', region: 'Castilla y León' },
    'trabanca': { province: 'Salamanca', region: 'Castilla y León' },
    'pereña': { province: 'Salamanca', region: 'Castilla y León' },
    'pereña de la ribera': { province: 'Salamanca', region: 'Castilla y León' },
    'fresno alhandiga': { province: 'Salamanca', region: 'Castilla y León' },
    'fresno alhándiga': { province: 'Salamanca', region: 'Castilla y León' },
    'la fuente de san esteban': { province: 'Salamanca', region: 'Castilla y León' },
    'fuente de san esteban': { province: 'Salamanca', region: 'Castilla y León' },
    'cabrillas': { province: 'Salamanca', region: 'Castilla y León' },
    'boada': { province: 'Salamanca', region: 'Castilla y León' },
    'villavieja': { province: 'Salamanca', region: 'Castilla y León' },
    'villavieja de yeltes': { province: 'Salamanca', region: 'Castilla y León' },
    'yecla': { province: 'Salamanca', region: 'Castilla y León' },
    'yecla de yeltes': { province: 'Salamanca', region: 'Castilla y León' },
    'ciperez': { province: 'Salamanca', region: 'Castilla y León' },
    'cipérez': { province: 'Salamanca', region: 'Castilla y León' },
    'peralejos de abajo': { province: 'Salamanca', region: 'Castilla y León' },
    'pozos de mondarrubio': { province: 'Salamanca', region: 'Castilla y León' },
    'cantalapiedra': { province: 'Salamanca', region: 'Castilla y León' },
    'valverdon': { province: 'Salamanca', region: 'Castilla y León' },
    'valverdón': { province: 'Salamanca', region: 'Castilla y León' },
    'doñinos': { province: 'Salamanca', region: 'Castilla y León' },
    'doñinos de salamanca': { province: 'Salamanca', region: 'Castilla y León' },
    'calvarrasa': { province: 'Salamanca', region: 'Castilla y León' },
    'calvarrasa de abajo': { province: 'Salamanca', region: 'Castilla y León' },
    'calvarrasa de arriba': { province: 'Salamanca', region: 'Castilla y León' },
    'pelabravo': { province: 'Salamanca', region: 'Castilla y León' },
    'arapiles': { province: 'Salamanca', region: 'Castilla y León' },
    'miranda de azan': { province: 'Salamanca', region: 'Castilla y León' },
    'miranda de azán': { province: 'Salamanca', region: 'Castilla y León' },
    'mozarbez': { province: 'Salamanca', region: 'Castilla y León' },
    'mozárbez': { province: 'Salamanca', region: 'Castilla y León' },
    'buenavista': { province: 'Salamanca', region: 'Castilla y León' },
    'martinamor': { province: 'Salamanca', region: 'Castilla y León' },
    'encinas de abajo': { province: 'Salamanca', region: 'Castilla y León' },
    'encinas de arriba': { province: 'Salamanca', region: 'Castilla y León' },
    'ejeme': { province: 'Salamanca', region: 'Castilla y León' },
    'anaya de alba': { province: 'Salamanca', region: 'Castilla y León' },
    'navales': { province: 'Salamanca', region: 'Castilla y León' },
    'valdecarros': { province: 'Salamanca', region: 'Castilla y León' },
    'larrodrigo': { province: 'Salamanca', region: 'Castilla y León' },
    'alaraz': { province: 'Salamanca', region: 'Castilla y León' },
    'santiago de la puebla': { province: 'Salamanca', region: 'Castilla y León' },
    'paradinas de san juan': { province: 'Salamanca', region: 'Castilla y León' },
    'saldeana': { province: 'Salamanca', region: 'Castilla y León' },
    'barruecopardo': { province: 'Salamanca', region: 'Castilla y León' },
    'saucelle': { province: 'Salamanca', region: 'Castilla y León' },
    'vilvestre': { province: 'Salamanca', region: 'Castilla y León' },
    'masueco': { province: 'Salamanca', region: 'Castilla y León' },
    'hinojosa de duero': { province: 'Salamanca', region: 'Castilla y León' },
    'la fregeneda': { province: 'Salamanca', region: 'Castilla y León' },
    'fregeneda': { province: 'Salamanca', region: 'Castilla y León' },
    'sobradillo': { province: 'Salamanca', region: 'Castilla y León' },
    'ahigal de los aceiteros': { province: 'Salamanca', region: 'Castilla y León' },
    'puerto de bejar': { province: 'Salamanca', region: 'Castilla y León' },
    'puerto de béjar': { province: 'Salamanca', region: 'Castilla y León' },
    'montemayor del rio': { province: 'Salamanca', region: 'Castilla y León' },
    'montemayor del río': { province: 'Salamanca', region: 'Castilla y León' },
    'horcajo de montemayor': { province: 'Salamanca', region: 'Castilla y León' },
    'sotoserrano': { province: 'Salamanca', region: 'Castilla y León' },
    'miranda del castañar': { province: 'Salamanca', region: 'Castilla y León' },
    'san martin del castañar': { province: 'Salamanca', region: 'Castilla y León' },
    'villanueva del conde': { province: 'Salamanca', region: 'Castilla y León' },
    'santibañez de la sierra': { province: 'Salamanca', region: 'Castilla y León' },
    'santibáñez de la sierra': { province: 'Salamanca', region: 'Castilla y León' },
    'valero': { province: 'Salamanca', region: 'Castilla y León' },
    'san esteban de la sierra': { province: 'Salamanca', region: 'Castilla y León' },
    'los santos': { province: 'Salamanca', region: 'Castilla y León' },
    'endrinal': { province: 'Salamanca', region: 'Castilla y León' },
    'monleon': { province: 'Salamanca', region: 'Castilla y León' },
    'linares de riofrio': { province: 'Salamanca', region: 'Castilla y León' },
    'linares de riofrío': { province: 'Salamanca', region: 'Castilla y León' },
    'escurial de la sierra': { province: 'Salamanca', region: 'Castilla y León' },
    'navarredonda de la rinconada': { province: 'Salamanca', region: 'Castilla y León' },
    'la rinconada de la sierra': { province: 'Salamanca', region: 'Castilla y León' },
    'el cabaco': { province: 'Salamanca', region: 'Castilla y León' },
    'nava de francia': { province: 'Salamanca', region: 'Castilla y León' },

    // Ávila
    'avila': { province: 'Ávila', region: 'Castilla y León', isCapital: true },
    'ávila': { province: 'Ávila', region: 'Castilla y León', isCapital: true },
    'pascualcobo': { province: 'Ávila', region: 'Castilla y León' },
    'pasqualcobo': { province: 'Ávila', region: 'Castilla y León' },
    'arevalo': { province: 'Ávila', region: 'Castilla y León' },
    'arévalo': { province: 'Ávila', region: 'Castilla y León' },
    'las navas del marques': { province: 'Ávila', region: 'Castilla y León' },
    'el tiemblo': { province: 'Ávila', region: 'Castilla y León' },
    'cebreros': { province: 'Ávila', region: 'Castilla y León' },
    'candeleda': { province: 'Ávila', region: 'Castilla y León' },
    'arenas de san pedro': { province: 'Ávila', region: 'Castilla y León' },
    'madrigal de las altas torres': { province: 'Ávila', region: 'Castilla y León' },
    'el barco de avila': { province: 'Ávila', region: 'Castilla y León' },
    'el barco de ávila': { province: 'Ávila', region: 'Castilla y León' },
    'piedrahita': { province: 'Ávila', region: 'Castilla y León' },
    'piedrahíta': { province: 'Ávila', region: 'Castilla y León' },
    'muñico': { province: 'Ávila', region: 'Castilla y León' },

    // Zamora
    'zamora': { province: 'Zamora', region: 'Castilla y León', isCapital: true },
    'toro': { province: 'Zamora', region: 'Castilla y León' },
    'benavente': { province: 'Zamora', region: 'Castilla y León' },
    'puebla de sanabria': { province: 'Zamora', region: 'Castilla y León' },
    'bermillos de sayago': { province: 'Zamora', region: 'Castilla y León' },
    'fermoselle': { province: 'Zamora', region: 'Castilla y León' },
    'fuentesauco': { province: 'Zamora', region: 'Castilla y León' },
    'fuentesaúco': { province: 'Zamora', region: 'Castilla y León' },
    'corrales del vino': { province: 'Zamora', region: 'Castilla y León' },
    'alcañices': { province: 'Zamora', region: 'Castilla y León' },

    // Valladolid
    'valladolid': { province: 'Valladolid', region: 'Castilla y León', isCapital: true },
    'medina del campo': { province: 'Valladolid', region: 'Castilla y León' },
    'tordesillas': { province: 'Valladolid', region: 'Castilla y León' },
    'laguna de duero': { province: 'Valladolid', region: 'Castilla y León' },
    'arroyo de la encomienda': { province: 'Valladolid', region: 'Castilla y León' },
    'peñafiel': { province: 'Valladolid', region: 'Castilla y León' },
    'penafiel': { province: 'Valladolid', region: 'Castilla y León' },
    'simancas': { province: 'Valladolid', region: 'Castilla y León' },

    // León, Segovia, Burgos, Palencia, Soria
    'leon': { province: 'León', region: 'Castilla y León', isCapital: true },
    'león': { province: 'León', region: 'Castilla y León', isCapital: true },
    'ponferrada': { province: 'León', region: 'Castilla y León' },
    'astorga': { province: 'León', region: 'Castilla y León' },
    'la bañeza': { province: 'León', region: 'Castilla y León' },
    'segovia': { province: 'Segovia', region: 'Castilla y León', isCapital: true },
    'cuellar': { province: 'Segovia', region: 'Castilla y León' },
    'cuéllar': { province: 'Segovia', region: 'Castilla y León' },
    'burgos': { province: 'Burgos', region: 'Castilla y León', isCapital: true },
    'aranda de duero': { province: 'Burgos', region: 'Castilla y León' },
    'palencia': { province: 'Palencia', region: 'Castilla y León', isCapital: true },
    'soria': { province: 'Soria', region: 'Castilla y León', isCapital: true },

    // Extremadura
    'caceres': { province: 'Cáceres', region: 'Extremadura', isCapital: true },
    'cáceres': { province: 'Cáceres', region: 'Extremadura', isCapital: true },
    'plasencia': { province: 'Cáceres', region: 'Extremadura' },
    'coria': { province: 'Cáceres', region: 'Extremadura' },
    'navalmoral de la mata': { province: 'Cáceres', region: 'Extremadura' },
    'trujillo': { province: 'Cáceres', region: 'Extremadura' },
    'hervas': { province: 'Cáceres', region: 'Extremadura' },
    'hervás': { province: 'Cáceres', region: 'Extremadura' },
    'jaraiz': { province: 'Cáceres', region: 'Extremadura' },
    'jaraíz': { province: 'Cáceres', region: 'Extremadura' },
    'jaraíz de la vera': { province: 'Cáceres', region: 'Extremadura' },
    'moraleja': { province: 'Cáceres', region: 'Extremadura' },
    'badajoz': { province: 'Badajoz', region: 'Extremadura', isCapital: true },
    'merida': { province: 'Badajoz', region: 'Extremadura' },
    'mérida': { province: 'Badajoz', region: 'Extremadura' },

    // Madrid
    'madrid': { province: 'Madrid', region: 'Comunidad de Madrid', isCapital: true },
    'alcala de henares': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'alcalá de henares': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'mostoles': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'móstoles': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'fuenlabrada': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'leganes': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'leganés': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'getafe': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'alcorcon': { province: 'Madrid', region: 'Comunidad de Madrid' },
    'alcorcón': { province: 'Madrid', region: 'Comunidad de Madrid' },

    // Castilla-La Mancha & Andalucía
    'toledo': { province: 'Toledo', region: 'Castilla-La Mancha', isCapital: true },
    'talavera de la reina': { province: 'Toledo', region: 'Castilla-La Mancha' },
    'guadalajara': { province: 'Guadalajara', region: 'Castilla-La Mancha', isCapital: true },
    'cuenca': { province: 'Cuenca', region: 'Castilla-La Mancha', isCapital: true },
    'ciudad real': { province: 'Ciudad Real', region: 'Castilla-La Mancha', isCapital: true },
    'albacete': { province: 'Albacete', region: 'Castilla-La Mancha', isCapital: true },
    'sevilla': { province: 'Sevilla', region: 'Andalucía', isCapital: true },
    'malaga': { province: 'Málaga', region: 'Andalucía', isCapital: true },
    'málaga': { province: 'Málaga', region: 'Andalucía', isCapital: true },
    'granada': { province: 'Granada', region: 'Andalucía', isCapital: true },
    'cordoba': { province: 'Córdoba', region: 'Andalucía', isCapital: true }
  };

  // MAPA DE REGIONES POR PROVINCIA DE ESPAÑA
  const PROVINCE_TO_REGION_MAP = {
    'Salamanca': 'Castilla y León',
    'Ávila': 'Castilla y León',
    'Zamora': 'Castilla y León',
    'Valladolid': 'Castilla y León',
    'León': 'Castilla y León',
    'Segovia': 'Castilla y León',
    'Burgos': 'Castilla y León',
    'Palencia': 'Castilla y León',
    'Soria': 'Castilla y León',
    'Cáceres': 'Extremadura',
    'Badajoz': 'Extremadura',
    'Madrid': 'Comunidad de Madrid',
    'Toledo': 'Castilla-La Mancha',
    'Guadalajara': 'Castilla-La Mancha',
    'Cuenca': 'Castilla-La Mancha',
    'Ciudad Real': 'Castilla-La Mancha',
    'Albacete': 'Castilla-La Mancha',
    'A Coruña': 'Galicia',
    'Lugo': 'Galicia',
    'Ourense': 'Galicia',
    'Pontevedra': 'Galicia',
    'Asturias': 'Principado de Asturias',
    'Cantabria': 'Cantabria',
    'Álava': 'País Vasco',
    'Guipúzcoa': 'País Vasco',
    'Vizcaya': 'País Vasco',
    'Navarra': 'Comunidad Foral de Navarra',
    'La Rioja': 'La Rioja',
    'Zaragoza': 'Aragón',
    'Huesca': 'Aragón',
    'Teruel': 'Aragón',
    'Barcelona': 'Cataluña',
    'Girona': 'Cataluña',
    'Lleida': 'Cataluña',
    'Tarragona': 'Cataluña',
    'Valencia': 'Comunidad Valenciana',
    'Alicante': 'Comunidad Valenciana',
    'Castellón': 'Comunidad Valenciana',
    'Murcia': 'Región de Murcia',
    'Sevilla': 'Andalucía',
    'Málaga': 'Andalucía',
    'Granada': 'Andalucía',
    'Córdoba': 'Andalucía',
    'Almería': 'Andalucía',
    'Jaén': 'Andalucía',
    'Huelva': 'Andalucía',
    'Cádiz': 'Andalucía',
    'Baleares': 'Islas Baleares',
    'Las Palmas': 'Canarias',
    'Santa Cruz de Tenerife': 'Canarias'
  };

  function getTownLocationInfo(townName) {
    if (!townName) return { region: 'Castilla y León', province: 'Salamanca', isCapital: false };

    const raw = String(townName).trim();
    const lower = raw.toLowerCase();
    const clean = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").trim();

    // 1. Revisar sobreescritura manual guardada por el usuario
    if (state.townLocationOverrides) {
      for (const k in state.townLocationOverrides) {
        if (k.toLowerCase() === lower || k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === clean) {
          const ov = state.townLocationOverrides[k];
          return {
            province: ov.province || 'Salamanca',
            region: ov.region || PROVINCE_TO_REGION_MAP[ov.province] || 'Castilla y León',
            isCapital: Boolean(ov.isCapital || (ov.province && ov.province.toLowerCase() === lower))
          };
        }
      }
    }

    // 2. Coincidencia exacta o directa por NFD
    let res = null;
    if (SPAIN_TOWNS_MAP[lower]) res = { ...SPAIN_TOWNS_MAP[lower] };
    else if (SPAIN_TOWNS_MAP[clean]) res = { ...SPAIN_TOWNS_MAP[clean] };

    // 3. Substring & Token matching inteligente
    if (!res) {
      const words = clean.split(/\s+/).filter(w => w.length >= 4);
      for (const key in SPAIN_TOWNS_MAP) {
        const keyClean = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (clean === keyClean || clean.includes(keyClean) || keyClean.includes(clean)) {
          res = { ...SPAIN_TOWNS_MAP[key] };
          break;
        }
        if (words.some(w => keyClean.length >= 4 && (w === keyClean || keyClean === w))) {
          res = { ...SPAIN_TOWNS_MAP[key] };
          break;
        }
      }
    }

    // 4. Detección entre paréntesis, ej: Pueblo (Ávila) o Pueblo (Cáceres)
    if (!res) {
      const match = raw.match(/(.+)\((.+)\)/);
      if (match && match[2]) {
        const provCandidate = match[2].trim();
        const provClean = provCandidate.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const pName in PROVINCE_TO_REGION_MAP) {
          if (pName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === provClean) {
            res = { region: PROVINCE_TO_REGION_MAP[pName], province: pName, isCapital: false };
            break;
          }
        }
      }
    }

    // 5. Criterio por defecto fiable para charangas locales: Salamanca (Castilla y León)
    if (!res) {
      res = { region: 'Castilla y León', province: 'Salamanca', isCapital: false };
    }

    if (lower.includes('capital') || clean.includes('capital')) {
      res.isCapital = true;
    }
    const cleanProv = (res.province || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanTown = clean.replace(/capital/gi, '').trim();
    if (cleanTown === cleanProv && cleanProv !== 'otras localidades') {
      res.isCapital = true;
    }

    return res;
  }

  // === RENDER FINANZAS Y ESTADÍSTICAS CON FILTROS ===
  function renderFinances() {
    if (!state.financesFilterYear) state.financesFilterYear = 'all';
    if (!state.financesFilterMonth) state.financesFilterMonth = 'all';

    // Rellenar select de años dinámicamente según las fechas de los bolos registrados
    const yearSelect = document.getElementById('fin-filter-year');
    if (yearSelect) {
      const yearsSet = new Set();
      state.bolos.forEach(b => {
        if (b.date) {
          const y = b.date.split('-')[0];
          if (y && y.length === 4) yearsSet.add(y);
        }
      });
      const yearsArr = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
      const currentYearStr = new Date().getFullYear().toString();
      if (yearsArr.length === 0 || !yearsArr.includes(currentYearStr)) {
        yearsArr.unshift(currentYearStr);
      }

      const selectedY = state.financesFilterYear;
      yearSelect.innerHTML = `<option value="all" ${selectedY === 'all' ? 'selected' : ''}>Todos los años</option>` +
        yearsArr.map(y => `<option value="${y}" ${selectedY === y ? 'selected' : ''}>${y}</option>`).join('');
    }

    const monthSelect = document.getElementById('fin-filter-month');
    if (monthSelect) {
      monthSelect.value = state.financesFilterMonth;
    }

    // Actualizar badge resumen visual de los filtros aplicados
    const summaryEl = document.getElementById('fin-filter-summary');
    if (summaryEl) {
      const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mText = state.financesFilterMonth !== 'all' ? monthNames[parseInt(state.financesFilterMonth, 10)] : 'Todos los meses';
      const yText = state.financesFilterYear !== 'all' ? state.financesFilterYear : 'Todos los años';
      
      summaryEl.textContent = `📊 Mostrando: ${mText} ${yText}`;
    }

    // Filtrar bolos para las estadísticas según los selectores de año y mes
    const filteredBolos = state.bolos.filter(b => {
      if (!b.date) return false;
      const parts = b.date.split('-');
      if (parts.length < 3) return false;

      const y = parts[0];
      const m = parseInt(parts[1], 10);

      if (state.financesFilterYear !== 'all' && y !== state.financesFilterYear) {
        return false;
      }
      if (state.financesFilterMonth !== 'all' && m !== parseInt(state.financesFilterMonth, 10)) {
        return false;
      }
      return true;
    });

    let paidTotal = 0;
    let paidCount = 0;
    let pendingTotal = 0;
    let totalKm = 0;
    let instCounts = {};
    let charangaCounts = {};
    let townMap = {};

    filteredBolos.forEach(b => {
      const price = parseFloat(b.price) || 0;
      const gasMoney = getBoloGasAmount(b);

      if (b.status === 'paid') {
        paidTotal += price;
        paidCount++;
      } else if (b.status === 'pending') {
        pendingTotal += price;
      }

      if (b.hasCar && b.km) {
        totalKm += parseFloat(b.km) || 0;
      }

      const instName = b.instrument || 'Caja';
      instCounts[instName] = (instCounts[instName] || 0) + 1;

      const charName = b.charanga || (state.myCharangas[0] || 'Charanga');
      charangaCounts[charName] = (charangaCounts[charName] || 0) + 1;

      // PASAPORTE DE PUEBLOS (Solo bolos ya realizados: Pendiente o Cobrado)
      if (b.status === 'pending' || b.status === 'paid') {
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
      }
    });

    state.townMap = townMap;
    const townsList = Object.values(townMap);
    const uniqueTownsCount = townsList.length;

    const paidEl = document.getElementById('fin-paid-total');
    if (paidEl) paidEl.textContent = formatCurrency(paidTotal);
    const paidCountEl = document.getElementById('fin-paid-count');
    if (paidCountEl) paidCountEl.textContent = `${paidCount} ${paidCount === 1 ? 'bolo' : 'bolos'}`;

    const kmEl = document.getElementById('fin-total-km');
    if (kmEl) kmEl.textContent = `${totalKm.toLocaleString('es-ES')} km`;
    const finTownsEl = document.getElementById('fin-towns-count');
    if (finTownsEl) finTownsEl.textContent = `${uniqueTownsCount} ${uniqueTownsCount === 1 ? 'pueblo' : 'pueblos'}`;

    // RENDERIZAR PASAPORTE DE GIRA (SELLOS DE PUEBLOS)
    const townsCountBadge = document.getElementById('towns-count');
    if (townsCountBadge) townsCountBadge.textContent = `${townsList.length} pueblos`;

    const passportGrid = document.getElementById('passport-grid');
    if (passportGrid) {
      if (townsList.length === 0) {
        passportGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">
            📍 Todavía no has registrado ningún pueblo.
          </div>
        `;
      } else {
        townsList.sort((a, b) => b.count - a.count || b.totalEarned - a.totalEarned);

        let filteredTowns = townsList;
        if (state.passportSearchQuery) {
          filteredTowns = townsList.filter(t => t.name.toLowerCase().includes(state.passportSearchQuery));
        }

        if (filteredTowns.length === 0) {
          passportGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">
              🔍 No se encontró ningún pueblo que coincida con "<strong>${escapeHtml(state.passportSearchQuery)}</strong>".
            </div>
          `;
        } else {
          // Agrupar pueblos por Comunidad Autónoma y Provincia
          const groupedMap = {};
          filteredTowns.forEach(t => {
            const loc = getTownLocationInfo(t.name);
            const reg = loc.region;
            const prov = loc.province;

            if (!groupedMap[reg]) groupedMap[reg] = {};
            if (!groupedMap[reg][prov]) groupedMap[reg][prov] = [];
            groupedMap[reg][prov].push(t);
          });

          let htmlContent = '';

          for (const regionName in groupedMap) {
            htmlContent += `
              <div class="region-classification-block">
                <div class="region-header-title">
                  🏛️ <span>${escapeHtml(regionName)}</span>
                </div>
            `;

            const provincesObj = groupedMap[regionName];
            for (const provName in provincesObj) {
              const townsArray = provincesObj[provName];

              htmlContent += `
                <div class="province-group-block">
                  <div class="province-subtitle">
                    <div class="province-left-wrapper">
                      <span>📍</span>
                      <span class="province-name-text">${escapeHtml(provName)}</span>
                    </div>
                    <span class="province-count-badge">${townsArray.length} ${townsArray.length === 1 ? 'pueblo' : 'pueblos'}</span>
                  </div>
                  <div class="passport-grid">
              `;

              htmlContent += townsArray.map(t => {
                const isVip = t.count > 1;
                const locInfo = getTownLocationInfo(t.name);
                const isCap = Boolean(locInfo && locInfo.isCapital);
                const grandTotalTown = t.totalEarned; // Omite gasolina

                return `
                  <div class="passport-stamp-card" data-town="${escapeHtml(t.name)}" onclick="openTownDetailModal('${escapeHtml(t.name)}')" style="cursor: pointer;">
                    ${isVip ? `
                      <div class="stamp-badge-star" title="${t.count} bolos en ${escapeHtml(t.name)}">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#F59E0B" stroke="#D97706" stroke-width="1.2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span class="star-count-text">${t.count}</span>
                      </div>
                    ` : ''}
                    <div class="stamp-town-name">
                      <span class="town-icon">📍</span>
                      <span class="town-text-name">${escapeHtml(t.name)}</span>
                    </div>
                    ${isCap ? `<span class="stamp-badge-capital" title="Capital de provincia">👑 Capital</span>` : ''}
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

              htmlContent += `
                  </div>
                </div>
              `;
            }

            htmlContent += `</div>`;
          }

          passportGrid.innerHTML = htmlContent;
        }
      }
    }

    // Desglose por Charanga / Grupo (Panel individual por grupo)
    const charContainer = document.getElementById('charanga-stats');
    if (charContainer) {
      const allCharangas = Array.from(new Set([
        ...state.myCharangas,
        ...filteredBolos.map(b => b.charanga || 'MenudoChaperon')
      ])).filter(Boolean);

      if (allCharangas.length === 0) {
        charContainer.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 16px; font-size: 13px;">
            🎶 No hay bolos registrados para el periodo seleccionado.
          </div>
        `;
      } else {
        charContainer.innerHTML = allCharangas.map(chName => {
          const charBolos = filteredBolos.filter(b => (b.charanga || 'MenudoChaperon') === chName);
          const totalCount = charBolos.length;
          
          let paidCount = 0;
          let paidMoney = 0;
          let pendingCount = 0;
          let pendingMoney = 0;

          charBolos.forEach(b => {
            const cachePrice = parseFloat(b.price) || 0;
            const gasMoney = getBoloGasAmount(b);
            const total = cachePrice + gasMoney;

            if (b.status === 'paid') {
              paidCount++;
              paidMoney += total;
            } else if (b.status === 'pending') {
              pendingCount++;
              pendingMoney += total;
            }
          });

          const activeCount = paidCount + pendingCount;

          return `
            <div class="charanga-panel-card">
              <div class="charanga-panel-header">
                <div class="charanga-panel-title">
                  <span>🎶</span> <span>${escapeHtml(chName)}</span>
                </div>
                <span class="charanga-badge-count" style="${charangaColorStyle(chName)}">${activeCount} ${activeCount === 1 ? 'bolo' : 'bolos'}</span>
              </div>
              
              <div class="charanga-panel-body">
                <div class="charanga-metric-box paid">
                  <div class="metric-head">
                    <span>✅ Cobrados</span>
                    <span class="metric-num">${paidCount}</span>
                  </div>
                  <div class="metric-amount">${formatCurrency(paidMoney)}</div>
                </div>

                <div class="charanga-metric-box pending">
                  <div class="metric-head">
                    <span>⏳ Pendientes</span>
                    <span class="metric-num">${pendingCount}</span>
                  </div>
                  <div class="metric-amount">${formatCurrency(pendingMoney)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
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
    if (!modal || !titleEl || !bodyEl || !townName) return;

    if (!townData || !townData.bolos) {
      if (state.townMap && state.townMap[townName]) {
        townData = state.townMap[townName];
      } else {
        const cleanTarget = townName.trim().toLowerCase();
        const townBolos = state.bolos.filter(b => b.name && b.name.trim().toLowerCase() === cleanTarget && (b.status === 'pending' || b.status === 'paid'));
        if (townBolos.length > 0) {
          townData = {
            name: townName,
            count: townBolos.length,
            bolos: townBolos,
            lastDate: townBolos.reduce((max, b) => (b.date > max ? b.date : max), townBolos[0].date),
            totalEarned: townBolos.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0),
            totalKm: townBolos.reduce((sum, b) => sum + (b.hasCar && b.km ? parseFloat(b.km) : 0), 0)
          };
        }
      }
    }

    if (!townData || !townData.bolos) return;

    titleEl.textContent = `📍 ${townName}`;

    const totalMoney = townData.totalEarned; // Omite gasolina

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(townName + ', España')}`;

    const locInfo = getTownLocationInfo(townName);

    let html = `
      <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="font-size: 13px;">
          <span style="color: var(--text-muted);">Clasificación en Pasaporte:</span><br>
          <strong style="color: var(--primary-gold);">📍 ${escapeHtml(locInfo.province)} (${escapeHtml(locInfo.region)})</strong>
          ${locInfo.isCapital ? '<span style="font-size: 11px; margin-left: 6px;">👑 Capital</span>' : ''}
        </div>
        <button type="button" class="btn-secondary" onclick="openChangeTownLocationModal('${escapeHtml(townName)}')" style="font-size: 12px; padding: 5px 10px; flex-shrink: 0;">
          ✏️ Cambiar
        </button>
      </div>

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

      <h4 style="font-family: var(--font-heading); font-size: 14px; color: var(--text-title); margin-bottom: 8px;">📅 Historial de Bolos en este pueblo:</h4>
      <div class="items-list">
    `;

    html += townData.bolos.map(b => {
      const cachePrice = parseFloat(b.price) || 0;
      const gasMoney = getBoloGasAmount(b);
      const totalBolo = cachePrice + gasMoney;
      const isPaid = b.status === 'paid';
      const timeStr = b.startTime ? `${b.startTime}${b.endTime ? ' - ' + b.endTime : ''}` : (b.time ? b.time + 'h' : '');

      return `
        <div class="item-card" data-bolo-id="${b.id}" onclick="openBoloDetail('${b.id}')" style="cursor: pointer;">
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
            <span class="pill-info pill-charanga" style="${charangaColorStyle(b.charanga)}">🎶 ${escapeHtml(b.charanga || 'Charanga')}</span>
            ${b.hasCar ? `<span class="pill-info pill-car">🚗 ${b.km} km</span>` : ''}
          </div>

          <div class="item-footer">
            <div class="footer-prices-left">
              <span class="price-cache-muted">Caché: ${formatCurrency(cachePrice)}</span>
              ${gasMoney > 0 ? `<span class="price-gas-blue">+${formatCurrency(gasMoney)}</span>` : ''}
            </div>
            <span class="price-total-highlight ${b.status}">${formatCurrency(totalBolo)}</span>
          </div>
        </div>
      `;
    }).join('');

    html += `</div>`;
    bodyEl.innerHTML = html;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function openModal(modalId) {
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function closeModal(modalId) {
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  // === CAMBIAR UBICACIÓN DE UN PUEBLO MANUALLMENTE ===
  function openChangeTownLocationModal(townName) {
    if (!townName) return;
    const targetNameEl = document.getElementById('change-location-target-name');
    const inputHiddenEl = document.getElementById('change-location-town-name');
    const selectEl = document.getElementById('change-location-province-select');

    if (targetNameEl) targetNameEl.textContent = townName;
    if (inputHiddenEl) inputHiddenEl.value = townName;

    const currentInfo = getTownLocationInfo(townName);
    if (selectEl && currentInfo && currentInfo.province) {
      selectEl.value = currentInfo.province;
    }

    openModal('modal-change-location');
  }

  function saveTownLocationOverride() {
    const inputHiddenEl = document.getElementById('change-location-town-name');
    const selectEl = document.getElementById('change-location-province-select');
    if (!inputHiddenEl || !selectEl) return;

    const townName = inputHiddenEl.value.trim();
    const province = selectEl.value.trim();
    if (!townName || !province) return;

    const region = PROVINCE_TO_REGION_MAP[province] || 'Castilla y León';
    const isCapital = province.toLowerCase() === townName.toLowerCase() || townName.toLowerCase().includes('capital');

    if (!state.townLocationOverrides) state.townLocationOverrides = {};
    state.townLocationOverrides[townName] = {
      province: province,
      region: region,
      isCapital: isCapital
    };

    saveDataToStorage();
    closeModal('modal-change-location');

    renderFinances();
    openTownDetailModal(townName);
  }

  window.openChangeTownLocationModal = openChangeTownLocationModal;
  window.saveTownLocationOverride = saveTownLocationOverride;

  // === RENDERIZADO Y LÓGICA DEL CALENDARIO ENTERO DE BOLOS ===
  let calendarCurrentDate = new Date();

  function renderCalendar() {
    const titleEl = document.getElementById('calendar-month-title');
    const gridEl = document.getElementById('calendar-days-grid');
    if (!titleEl || !gridEl) return;

    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    titleEl.textContent = `${monthNames[month]} ${year}`;

    // Agrupar bolos por fecha YYYY-MM-DD
    const bolosByDate = {};
    state.bolos.forEach(b => {
      if (b.date) {
        if (!bolosByDate[b.date]) bolosByDate[b.date] = [];
        bolosByDate[b.date].push(b);
      }
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Cálculo del primer día del mes (Lunes = 0, ..., Domingo = 6)
    const firstDayObj = new Date(year, month, 1);
    let startDayOffset = (firstDayObj.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = '';

    // 1. Celdas del mes anterior (interactivas para crear bolos)
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthIndex = month === 0 ? 11 : month - 1;

    for (let i = startDayOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDateStr = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayBolos = bolosByDate[prevDateStr] || [];

      html += `
        <div class="cal-day-cell other-month" data-date="${prevDateStr}" onclick="handleCalendarDayClick(event, '${prevDateStr}')" title="Añadir bolo el ${dayNum}/${prevMonthIndex + 1}/${prevMonthYear}">
          <div class="cal-day-number">${dayNum}</div>
          <div class="cal-day-events">
            ${dayBolos.map(b => renderCalEventTag(b)).join('')}
          </div>
        </div>
      `;
    }

    // 2. Celdas del mes actual (todas visibles y listas para añadir bolo)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayBolos = bolosByDate[dateStr] || [];

      dayBolos.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

      html += `
        <div class="cal-day-cell ${isToday ? 'is-today' : ''}" data-date="${dateStr}" onclick="handleCalendarDayClick(event, '${dateStr}')" title="Clic para añadir bolo el ${d}/${month + 1}/${year}">
          <div class="cal-day-number">${d}</div>
          <div class="cal-day-events">
            ${dayBolos.map(b => renderCalEventTag(b)).join('')}
          </div>
        </div>
      `;
    }

    // 3. Celdas del mes siguiente para completar la cuadrícula de 7 columnas
    const totalRendered = startDayOffset + daysInMonth;
    let nextMonthCellsNeeded = (7 - (totalRendered % 7)) % 7;
    if (totalRendered + nextMonthCellsNeeded < 35) {
      nextMonthCellsNeeded += 7;
    }

    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonthIndex = month === 11 ? 0 : month + 1;

    for (let nd = 1; nd <= nextMonthCellsNeeded; nd++) {
      const nextDateStr = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
      const dayBolos = bolosByDate[nextDateStr] || [];

      html += `
        <div class="cal-day-cell other-month" data-date="${nextDateStr}" onclick="handleCalendarDayClick(event, '${nextDateStr}')" title="Añadir bolo el ${nd}/${nextMonthIndex + 1}/${nextMonthYear}">
          <div class="cal-day-number">${nd}</div>
          <div class="cal-day-events">
            ${dayBolos.map(b => renderCalEventTag(b)).join('')}
          </div>
        </div>
      `;
    }

    gridEl.innerHTML = html;
  }

  function renderCalEventTag(b) {
    // Mostrar únicamente la hora de inicio del bolo (sin caer en horas/"Bolo" genérico)
    const timeStr = b.startTime || '';
    const fullInfo = `${b.type || b.name || 'Bolo'} (${b.charanga || 'Charanga'}) - ${b.startTime || ''}`;

    return `
      <div class="cal-event-tag" data-bolo-id="${b.id}" onclick="handleCalendarEventClick(event, '${b.id}')" title="${escapeHtml(fullInfo)}" style="${charangaColorStyle(b.charanga)}">
        ${escapeHtml(timeStr)}
      </div>
    `;
  }

  function handleCalendarDayClick(e, dateStr) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    openModalBolo(null, dateStr);
  }

  function handleCalendarEventClick(e, boloId) {
    if (e) {
      e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const bolo = state.bolos.find(b => String(b.id) === String(boloId));
    const sameDayBolos = bolo ? state.bolos.filter(b => b.date === bolo.date) : [];

    if (sameDayBolos.length > 1) {
      openDayEventsModal(bolo.date, sameDayBolos);
    } else {
      openBoloDetail(boloId);
    }
  }

  function openDayEventsModal(dateStr, dayBolos) {
    const modal = document.getElementById('modal-day-events');
    const body = document.getElementById('day-events-body');
    const titleEl = document.getElementById('day-events-title');
    if (!modal || !body) return;

    if (titleEl) titleEl.textContent = `🗓️ Bolos del ${formatDateStr(dateStr)}`;

    const sorted = [...dayBolos].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    body.innerHTML = sorted.map(b => {
      let statusClass = 'pending';
      let statusText = '⏳ Pendiente';
      if (b.status === 'upcoming') {
        statusClass = 'upcoming';
        statusText = '📅 Próximo';
      } else if (b.status === 'paid') {
        statusClass = 'paid';
        statusText = '✅ Cobrado';
      }
      const subParts = [];
      if (b.startTime) subParts.push(`🕐 ${escapeHtml(b.startTime)}`);
      if (b.charanga) subParts.push(`🎶 ${escapeHtml(b.charanga)}`);

      return `
        <button type="button" class="day-event-item" data-bolo-id="${b.id}">
          <div class="day-event-item-main">
            <strong>📍 ${escapeHtml(b.name || 'Bolo')}</strong>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="day-event-item-sub">${subParts.join(' · ')}</div>
        </button>
      `;
    }).join('');

    body.querySelectorAll('.day-event-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-bolo-id');
        closeModal('modal-day-events');
        openBoloDetail(id);
      });
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function handleCalendarNav(action) {
    if (action === 'prev') {
      calendarCurrentDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() - 1, 1);
    } else if (action === 'next') {
      calendarCurrentDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 1);
    } else if (action === 'today') {
      calendarCurrentDate = new Date();
    }
    renderCalendar();
  }

  window.handleCalendarDayClick = handleCalendarDayClick;
  window.handleCalendarEventClick = handleCalendarEventClick;
  window.handleCalendarNav = handleCalendarNav;

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
          } else if (targetId === 'view-calendario') {
            renderCalendar();
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

    const btnSaveLoc = document.getElementById('btn-save-town-location');
    if (btnSaveLoc) {
      btnSaveLoc.addEventListener('click', saveTownLocationOverride);
    }

    // FILTROS DE CHIPS
    document.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.currentFilter = chip.getAttribute('data-filter');
        renderBolosList();
      });
    });

    // DELEGACIÓN CLICS EN LISTA BOLOS (VER DETALLE BOLO)
    const bolosContainer = document.getElementById('bolos-list');
    if (bolosContainer) {
      bolosContainer.addEventListener('click', (e) => {
        if (e.target.closest('.status-dropdown-wrapper') || e.target.closest('.btn-maps-subtle') || e.target.closest('.status-dropdown-menu')) {
          return;
        }

        const card = e.target.closest('.item-card');
        if (card) {
          const id = card.getAttribute('data-bolo-id');
          if (id) {
            openBoloDetail(id);
          }
        }
      });
    }

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
          state.charangaColors[val] = newCharangaColorIndex;
          input.value = '';
          saveDataToStorage();
          renderAll(); // recalcula el siguiente color sugerido para el próximo grupo
        }
      });
    }

    // SELECTOR DE COLOR: NUEVO GRUPO
    const newColorSwatchBtn = document.getElementById('btn-new-charanga-color');
    const newColorMenu = document.getElementById('new-charanga-color-menu');
    if (newColorSwatchBtn && newColorMenu) {
      newColorSwatchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = newColorMenu.classList.contains('hidden');
        document.querySelectorAll('.color-picker-menu').forEach(m => m.classList.add('hidden'));
        if (isHidden) {
          renderColorPickerMenu(newColorMenu, newCharangaColorIndex, (idx) => {
            newCharangaColorIndex = idx;
            renderColorPickerButton(newColorSwatchBtn, idx);
          });
          newColorMenu.classList.remove('hidden');
        }
      });
    }

    // SELECTOR DE COLOR: EDITAR GRUPO
    const editColorSwatchBtn = document.getElementById('btn-edit-charanga-color');
    const editColorMenu = document.getElementById('edit-charanga-color-menu');
    if (editColorSwatchBtn && editColorMenu) {
      editColorSwatchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = editColorMenu.classList.contains('hidden');
        document.querySelectorAll('.color-picker-menu').forEach(m => m.classList.add('hidden'));
        if (isHidden) {
          renderColorPickerMenu(editColorMenu, editCharangaColorIndex, (idx) => {
            editCharangaColorIndex = idx;
            renderColorPickerButton(editColorSwatchBtn, idx);
          });
          editColorMenu.classList.remove('hidden');
        }
      });
    }

    // GUARDAR CAMBIOS DE NOMBRE/COLOR DE UN GRUPO EXISTENTE
    const btnSaveEditCharanga = document.getElementById('btn-save-edit-charanga');
    if (btnSaveEditCharanga) {
      btnSaveEditCharanga.addEventListener('click', () => {
        const originalName = document.getElementById('edit-charanga-original-name').value;
        const nameInput = document.getElementById('edit-charanga-name');
        const newName = nameInput ? nameInput.value.trim() : '';

        if (!newName) {
          alert('Escribe un nombre para el grupo.');
          if (nameInput) nameInput.focus();
          return;
        }
        if (newName !== originalName && state.myCharangas.includes(newName)) {
          alert('Ya existe un grupo con ese nombre.');
          return;
        }

        const idx = state.myCharangas.indexOf(originalName);
        if (idx !== -1) {
          state.myCharangas[idx] = newName;
        }

        delete state.charangaColors[originalName];
        state.charangaColors[newName] = editCharangaColorIndex;

        const gasRateInput = document.getElementById('edit-charanga-gas-rate');
        const newGasRate = gasRateInput ? parseFloat(gasRateInput.value) : NaN;

        delete state.charangaGasRates[originalName];
        state.charangaGasRates[newName] = !isNaN(newGasRate) && newGasRate >= 0 ? newGasRate : state.gasRate;

        if (newName !== originalName) {
          // Actualizar también los bolos ya creados con el nombre antiguo del grupo
          state.bolos.forEach(b => {
            if (b.charanga === originalName) b.charanga = newName;
          });
          if (state.currentFilter === originalName) {
            state.currentFilter = newName;
          }
        }

        saveDataToStorage();
        renderAll();
        closeModal('modal-edit-charanga');
      });
    }

    // CERRAR MODALES Y DESPLEGABLES (DELEGACIÓN GLOBAL + CLIC FUERA Y TECLA ESCAPE)
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.status-dropdown-wrapper')) {
        document.querySelectorAll('.status-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }

      if (!e.target.closest('.color-picker-wrapper')) {
        document.querySelectorAll('.color-picker-menu').forEach(m => m.classList.add('hidden'));
      }

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

    const btnExportData = document.getElementById('btn-export-data');
    if (btnExportData) btnExportData.addEventListener('click', exportBackup);
    const inputImportData = document.getElementById('input-import-data');
    if (inputImportData) inputImportData.addEventListener('change', importBackup);
    const btnLoadSample = document.getElementById('btn-load-sample');
    if (btnLoadSample) btnLoadSample.addEventListener('click', () => loadSampleData(true));
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) btnClearAll.addEventListener('click', clearAllData);

    // NAVEGACIÓN DE MESES EN CALENDARIO
    const btnCalPrev = document.getElementById('btn-cal-prev');
    if (btnCalPrev) {
      btnCalPrev.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        calendarCurrentDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() - 1, 1);
        renderCalendar();
      });
    }

    const btnCalToday = document.getElementById('btn-cal-today');
    if (btnCalToday) {
      btnCalToday.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        calendarCurrentDate = new Date();
        renderCalendar();
      });
    }

    const btnCalNext = document.getElementById('btn-cal-next');
    if (btnCalNext) {
      btnCalNext.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        calendarCurrentDate = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 1);
        renderCalendar();
      });
    }

    // FILTROS DE ESTADÍSTICAS (AÑO Y MES)
    const finYearSelect = document.getElementById('fin-filter-year');
    if (finYearSelect) {
      finYearSelect.addEventListener('change', (e) => {
        state.financesFilterYear = e.target.value;
        renderFinances();
      });
    }

    const finMonthSelect = document.getElementById('fin-filter-month');
    if (finMonthSelect) {
      finMonthSelect.addEventListener('change', (e) => {
        state.financesFilterMonth = e.target.value;
        renderFinances();
      });
    }

    // BUSCADOR EN PASAPORTE DE GIRA
    const passportSearchInput = document.getElementById('passport-search-input');
    const passportClearBtn = document.getElementById('btn-clear-passport-search');
    if (passportSearchInput) {
      passportSearchInput.addEventListener('input', (e) => {
        state.passportSearchQuery = e.target.value.trim().toLowerCase();
        if (passportClearBtn) {
          if (state.passportSearchQuery) passportClearBtn.classList.remove('hidden');
          else passportClearBtn.classList.add('hidden');
        }
        renderFinances();
      });
    }
    if (passportClearBtn) {
      passportClearBtn.addEventListener('click', () => {
        if (passportSearchInput) passportSearchInput.value = '';
        state.passportSearchQuery = '';
        passportClearBtn.classList.add('hidden');
        renderFinances();
      });
    }
  }

  // === MANEJO DE ESTADOS CON MENÚ DESPLEGABLE DE 2 CLICS ===
  function handleOpenStatusMenu(e, id) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const menu = document.getElementById(`status-menu-${id}`);
    const isClosed = menu ? menu.classList.contains('hidden') : true;

    document.querySelectorAll('.status-dropdown-menu').forEach(m => m.classList.add('hidden'));

    if (menu && isClosed) {
      menu.classList.remove('hidden');
    }
  }

  function handleSetStatus(e, id, newStatus) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const bolo = state.bolos.find(b => b.id === id);
    if (!bolo || !newStatus) return;

    if (newStatus === 'paid' && bolo.status !== 'paid') {
      if (!confirm('¿Seguro que este bolo ya lo has cobrado?')) {
        const menu = document.getElementById(`status-menu-${id}`);
        if (menu) menu.classList.add('hidden');
        return;
      }
    }

    bolo.status = newStatus;
    saveDataToStorage();
    if (cloudSync.user) {
      syncToCloud();
    }
    renderAll();
  }

  window.handleOpenStatusMenu = handleOpenStatusMenu;
  window.handleSetStatus = handleSetStatus;

  // === CÁLCULO DE GASOLINA EN MODAL ===
  function getSelectedCharangaInForm() {
    const checked = document.querySelector('input[name="charanga"]:checked');
    if (!checked || checked.value === 'Otra') return null;
    return checked.value;
  }

  function updateGasRateLabel() {
    const rate = getCharangaGasRate(getSelectedCharangaInForm());
    const gasDisplay = document.getElementById('gas-rate-display');
    if (gasDisplay) gasDisplay.textContent = rate.toFixed(2).replace('.', ',');
  }

  function updateGasCalc() {
    const km = parseFloat(document.getElementById('bolo-km').value) || 0;
    const rate = getCharangaGasRate(getSelectedCharangaInForm());
    const gasCalcInput = document.getElementById('bolo-gas-calc');
    if (gasCalcInput) gasCalcInput.value = Math.round(km * rate).toString();
    updateGasRateLabel();
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
      const bolo = state.bolos.find(b => String(b.id) === String(boloId));
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
      // Respetar el importe de gasolina ya guardado (pudo editarse a mano) en
      // vez de recalcularlo desde cero al abrir el bolo para editarlo.
      updateGasRateLabel();
      const gasCalcInput = document.getElementById('bolo-gas-calc');
      if (gasCalcInput) gasCalcInput.value = getBoloGasAmount(bolo).toFixed(2);
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
    modal.style.display = 'flex';

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
      const gasCalcInput = document.getElementById('bolo-gas-calc');
      const gasAmount = hasCar ? Math.round(parseFloat(gasCalcInput ? gasCalcInput.value : '') || 0) : 0;
      const notes = document.getElementById('bolo-notes').value.trim();

      if (id) {
        // Modificar existente
        const index = state.bolos.findIndex(b => b.id === id);
        if (index !== -1) {
          state.bolos[index] = {
            ...state.bolos[index],
            name, type, date, startTime, endTime, hours, time, price, status, charanga, instrument, hasCar, km, gasAmount, notes
          };
        }
      } else {
        // Crear nuevo
        const newBolo = {
          id: Date.now().toString(),
          name, type, date, startTime, endTime, hours, time, price, status, charanga, instrument, hasCar, km, gasAmount, notes
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
    if (!id) return;
    let bolo = state.bolos.find(b => String(b.id) === String(id));
    if (!bolo) {
      bolo = state.bolos.find(b => b.name && String(id).includes(b.name));
    }
    if (!bolo && state.bolos.length > 0) {
      bolo = state.bolos[0];
    }
    if (!bolo) return;

    const modal = document.getElementById('modal-bolo-detail');
    const body = document.getElementById('detail-body');
    const editBtn = document.getElementById('btn-edit-detail-bolo');
    if (!modal || !body) return;

    const gasMoney = getBoloGasAmount(bolo);
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
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
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
            <span class="detail-icon">🚗</span> <strong>Gasolina:</strong> ${bolo.km} km
          </div>
        ` : ''}

        ${bolo.notes ? `
          <div style="background-color: var(--bg-input); padding: 12px; border-radius: var(--radius-md); margin-top: 8px;">
            <strong style="font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 4px;">Notas:</strong>
            <p style="font-size: 14px; white-space: pre-wrap;">${escapeHtml(bolo.notes)}</p>
          </div>
        ` : ''}
      </div>
    `;

    const deleteBtn = document.getElementById('btn-delete-detail-bolo');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (confirm(`¿Estás seguro de que deseas eliminar el bolo "${bolo.name}"?`)) {
          state.bolos = state.bolos.filter(b => String(b.id) !== String(bolo.id));
          saveDataToStorage();
          renderAll();
          closeModal('modal-bolo-detail');
        }
      };
    }

    if (editBtn) {
      editBtn.onclick = () => {
        closeModal('modal-bolo-detail');
        openModalBolo(bolo.id);
      };
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function handleBoloCardClick(e, id) {
    if (e && e.target && (e.target.closest('.status-dropdown-wrapper') || e.target.closest('.btn-maps-subtle'))) {
      return;
    }
    openBoloDetail(id);
  }

  function exportGlobalHandlers() {
    window.openBoloDetail = openBoloDetail;
    window.openTownDetailModal = openTownDetailModal;
    window.handleBoloCardClick = handleBoloCardClick;
    window.openModalBolo = openModalBolo;
    window.closeModal = closeModal;
    window.handleOpenStatusMenu = handleOpenStatusMenu;
    window.handleSetStatus = handleSetStatus;
    window.handleFinancesFilterChange = handleFinancesFilterChange;
    window.handleCalendarNav = handleCalendarNav;
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // Solo la clase 'hidden' controla la visibilidad (display:none !important en CSS).
      // No fijar aquí un display inline: dejaría "pegado" ese valor y las funciones que
      // abren el modal solo quitando la clase (sin volver a fijar display) dejarían de
      // funcionar la próxima vez, aunque estemos en otra pantalla de la app.
      modal.classList.add('hidden');
    }
  }

  // === EXPORTACIÓN E IMPORTACIÓN BACKUP ===
  function exportBackup() {
    const data = {
      bolos: state.bolos,
      gasRate: state.gasRate,
      myCharangas: state.myCharangas,
      charangaColors: state.charangaColors,
      charangaGasRates: state.charangaGasRates,
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
          if (data.charangaColors && typeof data.charangaColors === 'object') state.charangaColors = data.charangaColors;
          if (data.charangaGasRates && typeof data.charangaGasRates === 'object') state.charangaGasRates = data.charangaGasRates;
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

  function getSampleBolosData() {
    const todayStr = new Date().toISOString().split('T')[0];
    return [
      {
        id: 'sample-1',
        name: 'Villar del Río',
        type: 'Pasacalles',
        date: todayStr,
        startTime: '18:30',
        endTime: '21:30',
        hours: 3,
        price: 120,
        status: 'upcoming',
        charanga: 'Charanga La Movida',
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
        hasCar: false,
        km: 0,
        members: ['María 🎺', 'Sara 🪘'],
        notes: 'Cobrado en mano tras finalizar.'
      }
    ];
  }

  function loadSampleData(confirmUser = true) {
    if (confirmUser && !confirm('¿Cargar datos de ejemplo? Esto añadirá bolos demostrativos.')) {
      return;
    }

    state.bolos = getSampleBolosData();
    saveDataToStorage();
    renderAll();
  }

  function clearAllData() {
    if (confirm('⚠️ ¿ATENCIÓN! ¿Quieres eliminar TODOS los bolos guardados en este dispositivo y en la nube?')) {
      state.bolos = [];
      saveDataToStorage();
      if (cloudSync.user) {
        syncToCloud();
      }
      renderAll();
      alert('🗑️ Se han borrado todos los bolos con éxito.');
    }
  }
  window.clearAllData = clearAllData;

  // === HELPERS DE FORMATO Y UTILIDADES ===
  function formatCurrency(val) {
    const roundVal = Math.round(val || 0);
    return roundVal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  }

  function formatDateStr(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayNames[dateObj.getDay()];
      
      const formattedDay = String(day).padStart(2, '0');
      const formattedMonth = String(month + 1).padStart(2, '0');
      
      return `${dayName}, ${formattedDay}/${formattedMonth}/${year}`;
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
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDWz9bNPdl9lx2T14f72eZxJ-jfpQxZl6A",
    authDomain: "bolotracker-65e60.firebaseapp.com",
    projectId: "bolotracker-65e60",
    storageBucket: "bolotracker-65e60.firebasestorage.app",
    messagingSenderId: "416155530447",
    appId: "1:416155530447:web:220726bc6dfcb18a65b3ba",
    measurementId: "G-GL3JZH29J2"
  };
  const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
  const GOOGLE_WEB_CLIENT_ID = '416155530447-1vi80dao9h33k7hsr9cvd3gtor86cssk.apps.googleusercontent.com';

  const cloudSync = {
    user: null,
    db: null,
    auth: null
  };

  // Panel de diagnóstico visible en la propia app (Ajustes > Cuenta y Sincronización),
  // para poder ver el estado real de la sincronización sin necesidad de abrir la
  // consola del navegador en el móvil.
  const cloudDebug = {};
  function setDebugInfo(key, value) {
    cloudDebug[key] = value;
    renderDebugUI();
  }
  function renderDebugUI() {
    const el = document.getElementById('cloud-debug-info');
    if (!el) return;
    let lastJsError = '';
    try { lastJsError = localStorage.getItem('bolotracker_last_js_error') || ''; } catch (e) {}

    // El panel solo se muestra cuando hay de verdad algo que reportar, para no
    // ensuciar la interfaz una vez que la sincronización funciona con normalidad.
    if (!cloudDebug.lastSyncError && !lastJsError) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }

    const localUser = cloudSync.user ? cloudSync.user.email : '(ninguna)';
    const firebaseUser = (cloudSync.auth && cloudSync.auth.currentUser) ? cloudSync.auth.currentUser.email : '(ninguna)';
    const lines = [`⚠️ Problema de sincronización — cuenta: ${localUser} · sesión Firebase: ${firebaseUser}`];
    if (cloudDebug.lastSyncError) lines.push(`Sync: ${cloudDebug.lastSyncError}`);
    if (lastJsError) lines.push(lastJsError);
    el.textContent = lines.join('\n');
    el.classList.remove('hidden');
  }

  function ensureFirebaseReady() {
    if (cloudSync.auth && cloudSync.db) return true;
    if (typeof firebase === 'undefined') {
      setDebugInfo('lastSyncError', 'SDK de Firebase no cargado (¿sin conexión?)');
      return false;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      cloudSync.auth = firebase.auth();
      cloudSync.db = firebase.firestore();
      cloudSync.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      return true;
    } catch (e) {
      console.warn('No se pudo inicializar Firebase:', e);
      setDebugInfo('lastSyncError', 'init Firebase: ' + e.message);
      return false;
    }
  }

  function applyFirebaseUser(user, opts = {}) {
    cloudSync.user = {
      uid: user.uid,
      displayName: user.displayName || 'Músico',
      email: user.email || '',
      photoURL: user.photoURL || DEFAULT_AVATAR
    };
    localStorage.setItem('bolotracker_cloud_user', JSON.stringify(cloudSync.user));
    updateCloudUI();
    syncFromCloud();
    if (opts.showAlert) {
      alert(`✅ ¡Cuenta de Google conectada (${user.email})!`);
    }
  }

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

    if (ensureFirebaseReady()) {
      cloudSync.auth.onAuthStateChanged(user => {
        setDebugInfo('authState', user ? ('user:' + user.email) : 'null');
        if (user) {
          applyFirebaseUser(user, {});
        } else if (cloudSync.user) {
          // La sesión de Firebase no está activa ahora mismo (p.ej. tras refrescar en
          // móvil/PWA), pero hay una cuenta vinculada guardada: forzamos igualmente
          // el intento de sincronización en vez de quedarnos solo con datos locales.
          syncFromCloud();
          updateCloudUI();
        } else {
          updateCloudUI();
        }
      });
    }

    initGoogleIdentityServices();
    setupCloudEventListeners();
    updateCloudUI();
  }

  // Google Identity Services: renderiza el botón oficial de Google y entrega el ID token
  // directamente en la página (sin popup ni navegación fuera de la app). En este proyecto,
  // tanto signInWithPopup como signInWithRedirect fallaban en Android al volver de Google
  // (getRedirectResult nunca encontraba la sesión); este flujo evita ese salto por completo.
  function initGoogleIdentityServices(retriesLeft = 20) {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      if (retriesLeft > 0) {
        setTimeout(() => initGoogleIdentityServices(retriesLeft - 1), 250);
      } else {
        setDebugInfo('gis', 'no cargó (¿bloqueado por el navegador o sin conexión?)');
      }
      return;
    }
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: handleGisCredentialResponse,
        auto_select: false
      });
      const container = document.getElementById('gis-button-container');
      if (container) {
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 280
        });
      }
      setDebugInfo('gis', 'listo');
    } catch (e) {
      console.error('Error inicializando Google Identity Services:', e);
      setDebugInfo('gis', 'error init: ' + e.message);
    }
  }

  function handleGisCredentialResponse(response) {
    if (!response || !response.credential) {
      showGoogleLoginError('Google no devolvió ninguna credencial. Vuelve a intentarlo.');
      return;
    }
    if (!ensureFirebaseReady()) {
      showGoogleLoginError('No se pudo conectar con el servicio de Google. Revisa tu conexión a internet e inténtalo de nuevo.');
      return;
    }
    const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
    cloudSync.auth.signInWithCredential(credential).then(result => {
      applyFirebaseUser(result.user, { showAlert: true });
    }).catch(err => {
      console.error('Error signInWithCredential:', err);
      setDebugInfo('lastSyncError', 'signInWithCredential: ' + (err && err.code ? err.code : err.message));
      showGoogleLoginError('No se pudo completar el inicio de sesión con Google: ' + (err && err.message ? err.message : 'error desconocido'));
    });
  }

  function setupCloudEventListeners() {
    const logoutBtn = document.getElementById('btn-google-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleGoogleLogout);
    }
    // Nota: btn-manual-sync ya dispara handleManualSync() vía onclick en el HTML;
    // no añadir aquí un segundo listener o la sincronización se ejecutaría por duplicado.
    // El botón de conexión con Google lo gestiona initGoogleIdentityServices().
  }

  function showGoogleLoginError(message) {
    const modal = document.getElementById('modal-google-login');
    const text = document.getElementById('google-login-error-text');
    if (text) text.textContent = message;
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    } else {
      alert('⚠️ ' + message);
    }
  }

  async function handleManualSync() {
    if (!cloudSync.user) {
      const savedUser = localStorage.getItem('bolotracker_cloud_user');
      if (savedUser) {
        try { cloudSync.user = JSON.parse(savedUser); } catch(e) {}
      }
    }

    if (!cloudSync.user) {
      alert('Debes conectar tu cuenta de Google primero.');
      return;
    }

    const upResult = await syncToCloud();
    const downResult = await syncFromCloud();

    if (upResult.ok && downResult.ok) {
      alert(`✅ ¡Sincronización completada con éxito!\nCuenta: ${cloudSync.user.email}`);
    } else {
      const failedResult = !upResult.ok ? upResult : downResult;
      const detail = failedResult.error ? failedResult.error.message : 'No se pudo conectar con la nube.';
      alert(`⚠️ La sincronización no se completó.\n${detail}\n\nTus datos siguen guardados en este dispositivo. Revisa tu conexión o inténtalo de nuevo más tarde.`);
    }
  }

  function handleGoogleLogout() {
    if (confirm('¿Quieres cerrar sesión de tu cuenta de Google? Tus bolos continuarán guardados en este dispositivo.')) {
      try {
        if (cloudSync.auth && cloudSync.auth.currentUser) {
          cloudSync.auth.signOut();
        }
      } catch (e) {}
      cloudSync.user = null;
      localStorage.removeItem('bolotracker_cloud_user');
      localStorage.removeItem('bolotracker_last_sync');
      updateCloudUI();
      alert('👋 Has cerrado sesión de Google. La app seguirá guardando tus datos en este dispositivo.');
    }
  }

  window.handleManualSync = handleManualSync;
  window.handleGoogleLogout = handleGoogleLogout;

  function updateCloudUI() {
    const unauthBox = document.getElementById('cloud-status-unauth');
    const authBox = document.getElementById('cloud-status-auth');
    const avatar = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-email');

    if (!cloudSync.user) {
      const savedUser = localStorage.getItem('bolotracker_cloud_user');
      if (savedUser) {
        try { cloudSync.user = JSON.parse(savedUser); } catch(e) {}
      }
    }

    if (cloudSync.user && cloudSync.user.email) {
      if (unauthBox) {
        unauthBox.classList.add('hidden');
        unauthBox.style.display = 'none';
      }
      if (authBox) {
        authBox.classList.remove('hidden');
        authBox.style.display = 'block';
      }

      if (avatar) avatar.src = cloudSync.user.photoURL || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
      if (nameEl) nameEl.textContent = cloudSync.user.displayName || 'Músico';
      if (emailEl) emailEl.textContent = cloudSync.user.email || '';
      updateLastSyncUI();
    } else {
      if (unauthBox) {
        unauthBox.classList.remove('hidden');
        unauthBox.style.display = 'block';
      }
      if (authBox) {
        authBox.classList.add('hidden');
        authBox.style.display = 'none';
      }
    }
    renderDebugUI();
  }

  function getCloudDocId() {
    if (!cloudSync.user) return null;
    if (cloudSync.user.email) {
      return 'user_' + cloudSync.user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    return cloudSync.user.uid;
  }

  async function syncFromCloud() {
    if (!cloudSync.user) return { ok: false, reason: 'no-user' };
    const docId = getCloudDocId();
    if (!docId) return { ok: false, reason: 'no-doc-id' };

    if (!ensureFirebaseReady()) return { ok: false, reason: 'no-db' };

    try {
      const docRef = cloudSync.db.collection('users').doc(docId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const cloudData = docSnap.data();
        if (cloudData.bolos && Array.isArray(cloudData.bolos) && cloudData.bolos.length > 0) {
          // Los bolos de ejemplo (id "sample-*") nunca deben mezclarse con datos reales de la nube
          const localMap = new Map((state.bolos || [])
            .filter(b => !String(b.id).startsWith('sample-'))
            .map(b => [String(b.id), b]));
          cloudData.bolos.forEach(b => {
            localMap.set(String(b.id), b);
          });
          state.bolos = Array.from(localMap.values());
        } else if (state.bolos && state.bolos.length > 0) {
          await syncToCloud();
        }

        if (cloudData.myCharangas && Array.isArray(cloudData.myCharangas) && cloudData.myCharangas.length > 0) {
          state.myCharangas = cloudData.myCharangas;
        }

        if (cloudData.charangaColors && typeof cloudData.charangaColors === 'object') {
          state.charangaColors = { ...cloudData.charangaColors, ...state.charangaColors };
        }

        if (cloudData.charangaGasRates && typeof cloudData.charangaGasRates === 'object') {
          state.charangaGasRates = { ...cloudData.charangaGasRates, ...state.charangaGasRates };
        }

        if (cloudData.gasRate) {
          state.gasRate = cloudData.gasRate;
        }

        if (cloudData.townLocationOverrides && typeof cloudData.townLocationOverrides === 'object') {
          state.townLocationOverrides = { ...cloudData.townLocationOverrides, ...(state.townLocationOverrides || {}) };
          localStorage.setItem('charanga_townLocationOverrides', JSON.stringify(state.townLocationOverrides));
        }

        localStorage.setItem('charanga_bolos', JSON.stringify(state.bolos));
        localStorage.setItem('charanga_gasRate', state.gasRate.toString());
        localStorage.setItem('charanga_myCharangas', JSON.stringify(state.myCharangas));
        localStorage.setItem('charanga_charangaColors', JSON.stringify(state.charangaColors));
        localStorage.setItem('charanga_charangaGasRates', JSON.stringify(state.charangaGasRates));

        renderAll();
      } else {
        await syncToCloud();
      }
      recordSyncSuccess();
      setDebugInfo('lastSyncError', '');
      return { ok: true };
    } catch (err) {
      console.warn('Error sincronizando desde la nube:', err);
      setDebugInfo('lastSyncError', 'bajada: ' + (err && err.code ? err.code : err.message));
      return { ok: false, reason: 'error', error: err };
    }
  }

  async function syncToCloud() {
    if (!cloudSync.user) return { ok: false, reason: 'no-user' };
    const docId = getCloudDocId();
    if (!docId) return { ok: false, reason: 'no-doc-id' };

    if (!ensureFirebaseReady()) return { ok: false, reason: 'no-db' };

    try {
      const docRef = cloudSync.db.collection('users').doc(docId);
      // Los bolos de ejemplo (id "sample-*") nunca deben subirse a la nube
      const bolosToSync = (state.bolos || []).filter(b => !String(b.id).startsWith('sample-'));
      await docRef.set({
        email: cloudSync.user.email || '',
        displayName: cloudSync.user.displayName || 'Músico',
        bolos: bolosToSync,
        myCharangas: state.myCharangas,
        charangaColors: state.charangaColors,
        charangaGasRates: state.charangaGasRates,
        myInstruments: state.myInstruments,
        allInstruments: state.allInstruments,
        townLocationOverrides: state.townLocationOverrides || {},
        gasRate: state.gasRate,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      recordSyncSuccess();
      setDebugInfo('lastSyncError', '');
      return { ok: true };
    } catch (err) {
      console.error('Error guardando en la nube:', err);
      setDebugInfo('lastSyncError', 'subida: ' + (err && err.code ? err.code : err.message));
      return { ok: false, reason: 'error', error: err };
    }
  }

  function recordSyncSuccess() {
    localStorage.setItem('bolotracker_last_sync', new Date().toISOString());
    updateLastSyncUI();
  }

  function updateLastSyncUI() {
    const el = document.getElementById('cloud-last-sync');
    if (!el) return;
    const iso = localStorage.getItem('bolotracker_last_sync');
    if (!iso) {
      el.textContent = '';
      return;
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      el.textContent = '';
      return;
    }
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    el.textContent = `Última sincronización: ${dateStr} ${timeStr}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      }[m];
    });
  }

  // Garantizar renderizado inmediato aunque el DOM tarde en responder
  setTimeout(() => {
    const listEl = document.getElementById('bolos-list');
    if (listEl && listEl.children.length === 0) {
      renderAll();
    }
  }, 50);
})();
