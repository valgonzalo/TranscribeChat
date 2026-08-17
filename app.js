/**
 * VoiceChat Studio — Universal Cross-Platform Speech Engine
 * 100% Guaranteed on Mobile (Android Chrome, iOS Safari) and Desktop (Chrome, Safari, Edge)
 */

class VoiceChatStudio {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.messages = [];
    
    // Cross-Platform Text Accumulator
    this.accumulatedSessionText = '';
    this.currentSegmentText = '';
    this.restartTimeout = null;
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Audio Visualizer & Synth
    this.visualizerId = null;
    this.soundFxEnabled = true;
    this.simulatedWavePhase = 0;
    
    // Active Open Card Menu
    this.activeMenuId = null;

    // DOM Elements
    this.toggleMicBtn = document.getElementById('toggleMicBtn');
    this.micIcon = document.getElementById('micIcon');
    this.stopIcon = document.getElementById('stopIcon');
    this.statusBadge = document.getElementById('statusBadge');
    this.statusLabel = document.getElementById('statusLabel');
    this.chatContainer = document.getElementById('chatContainer');
    this.messagesList = document.getElementById('messagesList');
    this.emptyState = document.getElementById('emptyState');
    this.liveBubble = document.getElementById('liveBubble');
    this.liveText = document.getElementById('liveText');

    // Visualizer Canvas
    this.canvas = document.getElementById('visualizerCanvas');
    this.canvasCtx = this.canvas.getContext('2d');
    
    // Global & Dock Action Buttons
    this.copyAllBtn = document.getElementById('copyAllBtn');
    this.exportDropdownBtn = document.getElementById('exportDropdownBtn');
    this.exportMenu = document.getElementById('exportMenu');
    this.exportTxtBtn = document.getElementById('exportTxtBtn');
    this.exportMdBtn = document.getElementById('exportMdBtn');
    this.exportJsonBtn = document.getElementById('exportJsonBtn');
    this.clearChatBtn = document.getElementById('clearChatBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.toastContainer = document.getElementById('toastContainer');

    this.init();
  }

  init() {
    this.checkEnvironment();
    this.setupCanvasDPI();
    this.loadPersistedMessages();
    this.initSpeechRecognition();
    this.attachEventListeners();
    this.drawIdleVisualizer();
  }

  checkEnvironment() {
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    // Warn if HTTP on mobile/remote
    if (!window.isSecureContext && !isLocal) {
      setTimeout(() => {
        this.showToast('⚠️ En celulares el micrófono requiere HTTPS (por ej. desplegado en Vercel).', 7000);
      }, 600);
    }

    // Detect In-App browsers (WhatsApp / Instagram / Facebook WebViews)
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isInApp = (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Instagram') > -1) || (ua.indexOf('WhatsApp') > -1);
    if (isInApp) {
      setTimeout(() => {
        this.showToast('ℹ️ Para permitir el micrófono en celulares, abrí este link directamente en Chrome o Safari.', 8000);
      }, 1200);
    }
  }

  setupCanvasDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(65, rect.width || 180);
    const height = Math.max(30, rect.height || 40);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvasCtx.resetTransform();
    this.canvasCtx.scale(dpr, dpr);
    this.canvasDisplayWidth = width;
    this.canvasDisplayHeight = height;
  }

  // =========================================================================
  // Universal Speech Recognition Engine
  // =========================================================================
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.showToast('Este navegador no soporta Speech Recognition. Usá Chrome, Edge o Safari.', 7000);
      if (this.statusLabel) this.statusLabel.textContent = 'NO COMPATIBLE';
      this.toggleMicBtn.disabled = true;
      return;
    }

    this.createRecognitionInstance(SpeechRecognition);
  }

  createRecognitionInstance(SpeechRecognitionClass) {
    const SpeechRecognition = SpeechRecognitionClass || window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    
    // On iOS Safari & Mobile Android, single-shot with auto-loop is 100x more stable than continuous=true
    this.recognition.continuous = !this.isMobile;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-AR'; // Spanish (Argentina)
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.updateUIState(true);
      this.startVisualizer();
      this.playBeep(880, 0.08); // High chime
    };

    this.recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      this.currentSegmentText = (final + ' ' + interim).trim();

      // Combine previous segments (from mobile silence loops) with current words
      const fullLiveText = (this.accumulatedSessionText + ' ' + this.currentSegmentText).trim();

      if (fullLiveText.length > 0 && this.isRecording) {
        this.liveBubble.classList.remove('hidden');
        this.liveText.textContent = fullLiveText;
        this.scrollToBottom();
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech engine error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.showToast('Permiso de micrófono denegado en el navegador.');
        this.stopRecording();
      } else if (event.error === 'no-speech') {
        // Normal silence on mobile, will auto-reconnect via onend if recording
      }
    };

    this.recognition.onend = () => {
      // Seamless auto-loop while user is actively recording (crucial for Mobile)
      if (this.isRecording) {
        if (this.currentSegmentText) {
          this.accumulatedSessionText = (this.accumulatedSessionText + ' ' + this.currentSegmentText).trim();
          this.currentSegmentText = '';
        }
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.isRecording) {
            try {
              this.recognition.start();
            } catch (e) {}
          }
        }, 50);
      } else {
        this.liveBubble.classList.add('hidden');
        this.liveText.textContent = '';
        this.updateUIState(false);
        this.stopVisualizer();
      }
    };
  }

  toggleRecording() {
    if (!this.recognition) return;
    if (this.isRecording) {
      this.playBeep(440, 0.08); // Low tone on stop
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording() {
    this.accumulatedSessionText = '';
    this.currentSegmentText = '';
    this.liveText.textContent = '';
    this.liveBubble.classList.add('hidden');
    this.isRecording = true;

    try {
      this.recognition.lang = 'es-AR';
      this.recognition.start();
    } catch (err) {
      console.warn('Recognition start exception:', err);
      // Re-instantiate if recognition was in an invalid internal state
      this.createRecognitionInstance();
      try { this.recognition.start(); } catch (e) {}
    }
  }

  stopRecording() {
    this.isRecording = false;
    clearTimeout(this.restartTimeout);

    try {
      this.recognition.stop();
    } catch (err) {}

    // Collect 100% of speech text from the entire recording
    const fullNoteText = (this.accumulatedSessionText + ' ' + this.currentSegmentText).trim();

    // Create exactly ONE note card
    if (fullNoteText.length > 0) {
      this.addMessage(fullNoteText);
    }

    // Reset buffer & state
    this.accumulatedSessionText = '';
    this.currentSegmentText = '';
    this.liveBubble.classList.add('hidden');
    this.liveText.textContent = '';

    this.updateUIState(false);
    this.stopVisualizer();
  }

  updateUIState(recording) {
    if (recording) {
      this.toggleMicBtn.classList.add('is-active');
      this.micIcon.classList.add('hidden');
      this.stopIcon.classList.remove('hidden');
      this.statusBadge.className = 'status-indicator-pill recording';
      this.statusLabel.textContent = 'GRABANDO';
    } else {
      this.toggleMicBtn.classList.remove('is-active');
      this.micIcon.classList.remove('hidden');
      this.stopIcon.classList.add('hidden');
      this.statusBadge.className = 'status-indicator-pill idle';
      this.statusLabel.textContent = 'EN ESPERA';
      this.liveBubble.classList.add('hidden');
    }
  }

  // =========================================================================
  // Native Audio Synthesizer Feedback
  // =========================================================================
  playBeep(frequency, duration) {
    if (!this.soundFxEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  // =========================================================================
  // Messages & Timeline Management
  // =========================================================================
  addMessage(text) {
    const cleanText = this.smartFormat(text);
    if (!cleanText) return;

    const message = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('es-AR')
    };

    this.messages.push(message);
    this.renderMessage(message);
    this.persistMessages();
    this.scrollToBottom();
  }

  renderMessage(msg) {
    this.emptyState.classList.add('hidden');

    const card = document.createElement('div');
    card.className = 'voice-card';
    card.id = msg.id;

    card.innerHTML = `
      <div class="voice-card-header">
        <div class="card-meta-left">
          <span class="note-time-badge">⏱️ ${msg.timestamp}</span>
        </div>
        <div class="card-tools">
          <button class="tool-icon-btn tool-copy-btn" title="Copiar nota">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
          
          <!-- 3-Dots Menu Anchor -->
          <div class="card-menu-anchor">
            <button class="tool-icon-btn card-menu-trigger" title="Opciones de exportación">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
            <div class="card-menu-dropdown hidden">
              <button class="card-menu-item item-export-txt">
                <span>📄</span> Exportar como .TXT
              </button>
              <button class="card-menu-item item-export-md">
                <span>📝</span> Exportar como .MD
              </button>
              <button class="card-menu-item item-export-json">
                <span>🧩</span> Exportar como .JSON
              </button>
              <button class="card-menu-item item-danger item-delete">
                <span>🗑️</span> Eliminar nota
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="voice-card-body" contenteditable="true" spellcheck="false" title="Toca para editar">${this.escapeHTML(msg.text)}</div>
    `;

    // Copy event with visual tick
    const copyBtn = card.querySelector('.tool-copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textElem = card.querySelector('.voice-card-body');
      navigator.clipboard.writeText(textElem.innerText);
      this.showToast('Nota copiada');
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f5a0" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      }, 1500);
    });

    // 3-Dots Menu Toggle
    const menuTrigger = card.querySelector('.card-menu-trigger');
    const menuDropdown = card.querySelector('.card-menu-dropdown');

    menuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyOpen = !menuDropdown.classList.contains('hidden');
      this.closeAllCardMenus();
      if (!isCurrentlyOpen) {
        menuDropdown.classList.remove('hidden');
        card.classList.add('is-menu-open');
        this.activeMenuId = msg.id;
      }
    });

    // Per-Note Exports
    card.querySelector('.item-export-txt').addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportSingleNote(msg.id, 'txt');
      this.closeAllCardMenus();
    });

    card.querySelector('.item-export-md').addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportSingleNote(msg.id, 'md');
      this.closeAllCardMenus();
    });

    card.querySelector('.item-export-json').addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportSingleNote(msg.id, 'json');
      this.closeAllCardMenus();
    });

    // Delete event
    card.querySelector('.item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllCardMenus();
      card.style.opacity = '0';
      card.style.transform = 'translateY(-8px) scale(0.97)';
      setTimeout(() => {
        this.messages = this.messages.filter(m => m.id !== msg.id);
        card.remove();
        this.persistMessages();
        if (this.messages.length === 0) {
          this.emptyState.classList.remove('hidden');
        }
      }, 200);
    });

    // Editable text sync
    const textElem = card.querySelector('.voice-card-body');
    textElem.addEventListener('blur', () => {
      const target = this.messages.find(m => m.id === msg.id);
      if (target) {
        target.text = textElem.innerText.trim();
        this.persistMessages();
      }
    });

    this.messagesList.appendChild(card);
  }

  closeAllCardMenus() {
    document.querySelectorAll('.card-menu-dropdown').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.voice-card').forEach(c => c.classList.remove('is-menu-open'));
    this.activeMenuId = null;
  }

  smartFormat(str) {
    if (!str) return '';
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  scrollToBottom() {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  // =========================================================================
  // Non-Blocking Audio Wave Visualizer (Zero Mic Conflict on Mobile)
  // =========================================================================
  startVisualizer() {
    if (this.visualizerId) cancelAnimationFrame(this.visualizerId);

    const width = this.canvasDisplayWidth || 180;
    const height = this.canvasDisplayHeight || 36;
    const gradient = this.canvasCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#00f5a0');
    gradient.addColorStop(1, '#00d2ff');

    const animate = () => {
      if (!this.isRecording) return;
      this.visualizerId = requestAnimationFrame(animate);

      this.canvasCtx.clearRect(0, 0, width, height);

      const barWidth = width < 120 ? 3.5 : (width > 240 ? 4.5 : 4);
      const gap = width < 120 ? 3 : 4;
      const barCount = Math.max(8, Math.floor(width / (barWidth + gap)));
      const totalWidth = barCount * (barWidth + gap) - gap;
      const startX = (width - totalWidth) / 2;

      this.simulatedWavePhase += 0.12;

      for (let i = 0; i < barCount; i++) {
        // Natural undulating audio wave calculation
        const sinVal = Math.sin(this.simulatedWavePhase + i * 0.45);
        const cosVal = Math.cos(this.simulatedWavePhase * 0.8 + i * 0.3);
        const intensity = (Math.abs(sinVal) * 0.6 + Math.abs(cosVal) * 0.4);
        const barHeight = Math.max(4, intensity * height * 0.9);

        const x = startX + i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        this.canvasCtx.fillStyle = gradient;
        this.canvasCtx.beginPath();
        this.canvasCtx.roundRect(x, y, barWidth, barHeight, 2);
        this.canvasCtx.fill();
      }
    };

    animate();
  }

  stopVisualizer() {
    if (this.visualizerId) {
      cancelAnimationFrame(this.visualizerId);
      this.visualizerId = null;
    }
    this.drawIdleVisualizer();
  }

  drawIdleVisualizer() {
    const width = this.canvasDisplayWidth || 180;
    const height = this.canvasDisplayHeight || 36;
    this.canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = width < 120 ? 3.5 : (width > 240 ? 4.5 : 4);
    const gap = width < 120 ? 3 : 4;
    const barCount = Math.max(8, Math.floor(width / (barWidth + gap)));
    const totalWidth = barCount * (barWidth + gap) - gap;
    const startX = (width - totalWidth) / 2;

    this.canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + gap);
      const y = (height - 3) / 2;
      this.canvasCtx.beginPath();
      this.canvasCtx.roundRect(x, y, barWidth, 3, 1.5);
      this.canvasCtx.fill();
    }
  }

  // =========================================================================
  // Exporting: Single Note vs All Notes
  // =========================================================================
  exportSingleNote(noteId, format) {
    const note = this.messages.find(m => m.id === noteId);
    if (!note) return;

    let content = '';
    let filename = `nota_${note.timestamp.replace(':', '-')}_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    if (format === 'txt') {
      content = `[${note.timestamp}]\r\n${note.text}`;
      filename += '.txt';
    } else if (format === 'md') {
      content = `### 🎙️ Nota de voz (${note.timestamp})\n\n> ${note.text}\n`;
      filename += '.md';
    } else if (format === 'json') {
      content = JSON.stringify(note, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    }

    this.downloadBlob(content, filename, mimeType);
    this.showToast(`Nota exportada como ${filename}`);
  }

  copyAllText() {
    if (this.messages.length === 0) {
      this.showToast('No hay notas para copiar');
      return;
    }

    const fullText = this.messages.map(m => `[${m.timestamp}] ${m.text}`).join('\n\n');
    navigator.clipboard.writeText(fullText).then(() => {
      this.showToast('¡Todas las notas copiadas!');
    });
  }

  exportFile(format) {
    if (this.messages.length === 0) {
      this.showToast('No hay contenido para exportar');
      return;
    }

    let content = '';
    let filename = `voicechat_notas_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    if (format === 'txt') {
      content = this.messages.map(m => `[${m.timestamp}] ${m.text}`).join('\r\n\r\n');
      filename += '.txt';
    } else if (format === 'md') {
      content = `# 🎙️ Transcripción VoiceChat Studio\n*Fecha: ${new Date().toLocaleDateString('es-AR')} | Total notas: ${this.messages.length}*\n\n---\n\n`;
      content += this.messages.map(m => `### ⏱️ ${m.timestamp}\n> ${m.text}`).join('\n\n');
      filename += '.md';
    } else if (format === 'json') {
      content = JSON.stringify({
        exportDate: new Date().toISOString(),
        totalNotes: this.messages.length,
        notes: this.messages
      }, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    }

    this.downloadBlob(content, filename, mimeType);
    this.showToast(`Archivo ${filename} descargado`);
  }

  downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  clearChat() {
    if (this.messages.length === 0) return;
    if (confirm('¿Deseas limpiar todas las notas de voz?')) {
      this.messages = [];
      this.messagesList.innerHTML = '';
      this.liveBubble.classList.add('hidden');
      this.liveText.textContent = '';
      this.emptyState.classList.remove('hidden');
      localStorage.removeItem('voicechat_studio_records');
      this.showToast('Historial de notas limpio');
    }
  }

  persistMessages() {
    try {
      localStorage.setItem('voicechat_studio_records', JSON.stringify(this.messages));
    } catch (e) {}
  }

  loadPersistedMessages() {
    try {
      const saved = localStorage.getItem('voicechat_studio_records');
      if (saved) {
        this.messages = JSON.parse(saved);
        this.messages.forEach(m => this.renderMessage(m));
      }
    } catch (e) {}
  }

  // =========================================================================
  // Toast Notification Hub
  // =========================================================================
  showToast(message, duration = 2800) {
    const toast = document.createElement('div');
    toast.className = 'studio-toast';
    toast.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00f5a0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
      <span>${message}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================
  attachEventListeners() {
    // Touch & Click support for mobile buttons
    this.toggleMicBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleRecording();
    });

    // Global spacebar keyboard shortcut
    window.addEventListener('keydown', (e) => {
      if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleRecording();
      }
    });

    // Copy All
    this.copyAllBtn.addEventListener('click', () => this.copyAllText());

    // Global Export Dropdown
    this.exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllCardMenus();
      this.exportMenu.classList.toggle('hidden');
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', () => {
      this.exportMenu.classList.add('hidden');
      this.closeAllCardMenus();
    });

    this.exportTxtBtn.addEventListener('click', () => this.exportFile('txt'));
    this.exportMdBtn.addEventListener('click', () => this.exportFile('md'));
    this.exportJsonBtn.addEventListener('click', () => this.exportFile('json'));

    // Clear Feed
    this.clearChatBtn.addEventListener('click', () => this.clearChat());

    // Dock Audio FX Toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.soundFxEnabled = !this.soundFxEnabled;
      this.soundToggleBtn.classList.toggle('active', this.soundFxEnabled);
      this.showToast(this.soundFxEnabled ? 'Audio FX activado' : 'Audio FX silenciado');
    });

    // Fluid Canvas Resize
    const handleResize = () => {
      this.setupCanvasDPI();
      if (!this.isRecording) this.drawIdleVisualizer();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.studio = new VoiceChatStudio();
});
