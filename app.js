/* app.js - FIXED: Cropper Added & Zoom Center */

// Глобальные переменные
let state = {
    format: '30x30',
    layout: 'text_icon', 
    ppi: 10, 
    slotSize: { w: 6, h: 6 }, 
    maskType: 'rect',
    text: {
        lines: [ { text: "THE VISUAL DIARY", upper: true }, { text: "", upper: false }, { text: "", upper: false } ],
        date: "", copyright: "", font: "Tenor Sans", color: "#1a1a1a", scale: 1.0
    },
    coverColor: "#FFFFFF", images: { icon: null, main: null },
    spine: { symbol: true, title: true, date: true },
    qr: { enabled: false, url: "" },
    imgPos: 'center'
};

let userModifiedText = false;
let workspacePanzoom = null;

// =========================================================
// 1. ГЛАВНЫЙ ЗАПУСК
// =========================================================
window.onload = function() {
    console.log("MALEVICH Configurator Starting...");

    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }, 1000);

    if (typeof CoverEngine === 'undefined') {
        alert("Critical Error: CoverEngine not loaded.");
        return;
    }

    CoverEngine.init('c');

    const urlParams = new URLSearchParams(window.location.search);
    const currentYear = new Date().getFullYear().toString();
    state.text.date = currentYear;

    const dateInput = document.getElementById('dateLine');
    if (dateInput) dateInput.value = currentYear;

    const nameFromUrl = urlParams.get('name');
    if (nameFromUrl) {
        state.text.lines[0].text = nameFromUrl.toUpperCase();
        const inp = document.getElementById('inputLine1');
        if (inp) inp.value = nameFromUrl.toUpperCase();
    }

    loadDefaultAssets();
    initColors();
    initListeners();

    setTimeout(() => {
        refresh();
        initWorkspaceZoom();
        updateActionButtons();
    }, 500);
};

window.addEventListener('resize', () => {
    if (document.activeElement.tagName === 'INPUT') return;
    setTimeout(() => {
        refresh();
        if(workspacePanzoom) {
            // При ресайзе сбрасываем и центрируем
            zoomCanvas('reset');
        }
    }, 100);
});

function refresh() {
    if (typeof CoverEngine !== 'undefined') {
        const workspace = document.getElementById('workspace');
        if(workspace) CoverEngine.updateDimensions(workspace, state);
    }
}

// =========================================================
// 2. ЛОГИКА ЗУМА (ИСПРАВЛЕНО)
// =========================================================
function initWorkspaceZoom() {
    const workspaceEl = document.getElementById('workspace');
    const canvasContainer = workspaceEl.querySelector('.canvas-container');
    
    if (canvasContainer && window.Panzoom) {
        if (workspacePanzoom) workspacePanzoom.destroy();

        // Центрируем контейнер перед инициализацией
        canvasContainer.style.transformOrigin = 'center center';
        
        workspacePanzoom = Panzoom(canvasContainer, {
            maxScale: 3, 
            minScale: 0.1, // Разрешаем уменьшать сильно, чтобы увидеть всё
            startScale: 0.9, // Чуть меньше 100%, чтобы были видны поля
            contain: null, 
            canvas: false 
        });
        
        workspaceEl.addEventListener('wheel', workspacePanzoom.zoomWithWheel);
        
        // Принудительное центрирование при старте
        setTimeout(() => {
            zoomCanvas('reset');
        }, 100);

        canvasContainer.addEventListener('panzoomchange', (e) => {
            const scale = e.detail.scale;
            const btn100 = document.getElementById('btnZoomReset');
            if(btn100) {
                if (scale >= 0.95 && scale <= 1.05) btn100.classList.add('active');
                else btn100.classList.remove('active');
            }
        });
    }
}

window.zoomCanvas = (action) => {
    if (!workspacePanzoom) return;
    
    if (action === 'in') workspacePanzoom.zoomIn();
    else if (action === 'out') workspacePanzoom.zoomOut();
    else if (action === 'reset') {
        // Сброс и центровка
        workspacePanzoom.reset();
        setTimeout(() => {
             const canvasContainer = document.querySelector('.canvas-container');
             if(canvasContainer) {
                 // Сброс трансформации CSS для идеального центра flexbox
                 canvasContainer.style.transform = 'scale(0.9) translate(0px, 0px)'; 
                 // Сообщаем Panzoom о сбросе
                 workspacePanzoom.zoom(0.9, { animate: true });
                 workspacePanzoom.pan(0, 0);
             }
        }, 10);
    }
};

window.setImgPos = (pos) => {
    state.imgPos = pos;
    document.querySelectorAll('#posGroup .dock-mini-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`dockPos_${pos}`);
    if(btn) btn.classList.add('active');
    refresh();
};

window.updateActionButtons = function() {
    const btnGallery = document.getElementById('btnDockGallery');
    const btnUpload = document.getElementById('btnDockUpload');
    const posGroup = document.getElementById('posGroup');
    if (!btnGallery) return;
    
    btnGallery.classList.add('hidden');
    btnUpload.classList.add('hidden');
    if(posGroup) posGroup.classList.add('hidden');
    
    if (state.layout === 'graphic') {
        btnGallery.classList.remove('hidden');
        btnGallery.querySelector('span').innerText = "Галерея";
        if(posGroup) posGroup.classList.remove('hidden'); 
    } 
    else if (state.layout === 'photo_text' || state.layout === 'magazine') {
        btnUpload.classList.remove('hidden');
        if(state.layout === 'photo_text' && posGroup) posGroup.classList.remove('hidden');
    }
    else if (state.layout === 'icon' || state.layout === 'text_icon') {
        btnGallery.classList.remove('hidden');
        btnGallery.querySelector('span').innerText = "Символ";
        if(state.layout === 'icon' && posGroup) posGroup.classList.remove('hidden');
    }
};

window.handleCanvasClick = () => {}; 

// =========================================================
// 3. TELEGRAM (300 DPI)
// =========================================================
window.sendToTelegram = function() {
    const btn = document.getElementById('sendTgBtn');
    const originalText = btn.innerText;
    
    // Проверка: работает ли с локального файла
    if (window.location.protocol === 'file:') {
        alert("⚠️ Ошибка: Отправка в Telegram не работает при запуске из файла.\nПожалуйста, загрузите проект на Vercel или используйте локальный сервер.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderData = {
        orderId: urlParams.get('order_id') || 'Без номера',
        clientName: urlParams.get('name') || 'Не указано',
        clientPhone: urlParams.get('phone') || 'Не указан'
    };

    btn.innerText = "ГЕНЕРАЦИЯ PRINT FILE...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    setTimeout(() => {
        try {
            if (typeof CoverEngine === 'undefined' || !CoverEngine.canvas) throw new Error("Canvas Error");

            // Проверка PPI
            if (!CoverEngine.canvas.state_ppi) {
                // Если вдруг PPI не задан, берем дефолт, чтобы не делить на 0
                CoverEngine.canvas.state_ppi = 5; 
            }

            const targetPxPerMm = 300 / 25.4; 
            const multiplier = CoverEngine.getPrintMultiplier(targetPxPerMm);

            console.log(`Generating 300 DPI. Multiplier: ${multiplier.toFixed(2)}`);

            // JPEG 0.85 Quality to save size
            const dataUrl = CoverEngine.canvas.toDataURL({ 
                format: 'jpeg', 
                quality: 0.85,       
                multiplier: multiplier 
            });
            
            const base64Clean = dataUrl.replace(/^data:image\/\w+;base64,/, "");

            btn.innerText = "ОТПРАВКА...";

            fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64Clean,
                    orderId: orderData.orderId,
                    clientName: orderData.clientName,
                    clientPhone: orderData.clientPhone
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) alert(`✅ Файл для печати (300 DPI) отправлен!`);
                else alert("Ошибка отправки: " + (data.error || "Error"));
            })
            .catch(err => {
                console.error(err);
                alert("Ошибка сети. Проверьте CORS или лимиты Vercel.");
            })
            .finally(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = "1";
            });

        } catch(e) {
            console.error(e);
            alert("Ошибка генерации: " + e.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }, 100);
};

// =========================================================
// 4. ИНИЦИАЛИЗАЦИЯ
// =========================================================

function loadDefaultAssets() {
    const defaultPath = 'assets/symbols/love_heart.png';
    const defaultPreview = 'assets/symbols/love_heart_icon.png';
    if(typeof CoverEngine !== 'undefined') {
        CoverEngine.loadSimpleImage(defaultPath, (url) => {
            const final = url || defaultPreview;
            if (final) {
                CoverEngine.loadSimpleImage(final, (valid) => {
                    if (valid) state.images.icon = valid;
                    finishInit();
                });
            } else { finishInit(); }
        });
    } else { finishInit(); }
}

function finishInit() {
    updateSymbolUI();
    const defCard = document.querySelector('.layout-card[title="Текст+Символ"]') || document.querySelector('.layout-card');
    if (defCard) setLayout('text_icon', defCard);
    refresh();
}

function initColors() {
    const collectionName = 'Kinfolk - Cinema';
    const selector = document.getElementById('paletteSelector');
    if (selector) selector.value = collectionName;
    if (window.DESIGNER_PALETTES && window.DESIGNER_PALETTES[collectionName]) {
        changeCollection(collectionName);
        const palette = window.DESIGNER_PALETTES[collectionName];
        const randomIdx = Math.floor(Math.random() * palette.length);
        setTimeout(() => {
            const btns = document.querySelectorAll('#pairsGrid .pair-btn');
            if (btns[randomIdx]) btns[randomIdx].click();
        }, 100);
    }
    const bgPicker = document.getElementById('customCoverPicker');
    const textPicker = document.getElementById('customTextPicker');
    if (bgPicker) bgPicker.oninput = (e) => { state.coverColor = e.target.value; refresh(); };
    if (textPicker) textPicker.oninput = (e) => { state.text.color = e.target.value; updateSymbolUI(); refresh(); };
}

window.changeCollection = function(name) {
    const grid = document.getElementById('pairsGrid');
    const custom = document.getElementById('customPickers');
    if (!grid) return;
    grid.innerHTML = '';
    if (name === 'Custom') {
        grid.classList.add('hidden'); custom.classList.remove('hidden'); return;
    }
    grid.classList.remove('hidden'); custom.classList.add('hidden');
    const palette = (window.DESIGNER_PALETTES && window.DESIGNER_PALETTES[name]) || [];
    palette.forEach(pair => {
        const btn = document.createElement('div');
        btn.className = 'pair-btn';
        btn.style.backgroundColor = pair.bg;
        if (pair.bg.toLowerCase() === '#ffffff') btn.style.border = '1px solid #ccc';
        const h = document.createElement('div');
        h.className = 'pair-heart'; h.innerText = '❤'; h.style.color = pair.text;
        btn.appendChild(h);
        btn.onclick = () => {
            state.coverColor = pair.bg; state.text.color = pair.text;
            document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active'); updateSymbolUI();
            const qrBtn = document.getElementById('qrBtn');
            if (qrBtn) { qrBtn.style.color = pair.text; qrBtn.style.borderColor = pair.text; }
            refresh();
        };
        grid.appendChild(btn);
    });
    if (palette.length > 0 && grid.firstChild) grid.firstChild.click();
};

window.openGallery = function(type, target) {
    document.getElementById('galleryModal').classList.remove('hidden');
    const upBtn = document.getElementById('galUploadBtn');
    const galTitle = document.getElementById('galleryTitle');
    const DB = window.ASSETS_DB || {};
    let dbSection = (type === 'symbols') ? DB.symbols : DB.graphics;
    if (type === 'symbols') {
        galTitle.innerText = "Галерея символов"; upBtn.innerText = "Загрузить свой символ";
        upBtn.onclick = () => document.getElementById('iconLoader').click();
    } else {
        galTitle.innerText = "Галерея графики"; upBtn.innerText = "Загрузить свою графику";
        upBtn.onclick = () => document.getElementById('imageLoader').click();
    }
    const tabs = document.getElementById('galleryTabs'); tabs.innerHTML = '';
    if (!dbSection) return;
    Object.keys(dbSection).forEach((cat, i) => {
        const t = document.createElement('div'); t.className = `gallery-tab ${i === 0 ? 'active' : ''}`; t.innerText = cat;
        t.onclick = () => {
            document.querySelectorAll('.gallery-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active'); loadGal(type, cat, target);
        };
        tabs.appendChild(t);
    });
    if (Object.keys(dbSection).length > 0) loadGal(type, Object.keys(dbSection)[0], target);
};

function loadGal(type, cat, target) {
    const grid = document.getElementById('galleryGrid'); grid.innerHTML = '';
    const DB = window.ASSETS_DB || {};
    let files = (type === 'symbols' ? DB.symbols[cat] : DB.graphics[cat]) || [];
    const folder = (type === 'symbols') ? 'symbols' : 'graphics';
    files.forEach(f => {
        const item = document.createElement('div'); item.className = 'gallery-item';
        const img = document.createElement('img');
        const previewName = f.includes('_icon') ? f : f.replace('.png', '_icon.png');
        const previewUrl = `assets/${folder}/${previewName}`;
        const printUrl = `assets/${folder}/${f}`;
        img.src = previewUrl; img.onerror = () => { img.src = printUrl; };
        item.appendChild(img);
        item.onclick = () => {
            if (typeof CoverEngine !== 'undefined') {
                CoverEngine.loadSimpleImage(printUrl, (final) => {
                    final = final || previewUrl;
                    document.getElementById('galleryModal').classList.add('hidden');
                    if (target === 'global') {
                        state.images.icon = final; updateSymbolUI(); refresh();
                    } else if (type === 'graphics') {
                        state.images.main = { src: final, natural: true };
                        refresh(); updateActionButtons();
                    }
                });
            }
        };
        grid.appendChild(item);
    });
}

window.closeGallery = () => document.getElementById('galleryModal').classList.add('hidden');
window.openQRModal = () => document.getElementById('qrModal').classList.remove('hidden');
window.applyQR = () => {
    state.qr.enabled = true; state.qr.url = document.getElementById('qrLinkInput').value;
    document.getElementById('qrModal').classList.add('hidden'); refresh();
};
window.removeQR = () => {
    state.qr.enabled = false; document.getElementById('qrModal').classList.add('hidden'); refresh();
};

function initListeners() {
    ['inputLine1', 'inputLine2', 'inputLine3', 'dateLine', 'copyrightInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.oninput = () => {
                userModifiedText = true;
                if (id === 'inputLine1') state.text.lines[0].text = el.value;
                if (id === 'inputLine2') state.text.lines[1].text = el.value;
                if (id === 'inputLine3') state.text.lines[2].text = el.value;
                if (id === 'dateLine') state.text.date = el.value;
                if (id === 'copyrightInput') state.text.copyright = el.value;
                refresh();
            };
        }
    });
    const fontSel = document.getElementById('fontSelector');
    if (fontSel) fontSel.addEventListener('change', (e) => { state.text.font = e.target.value; refresh(); });
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = () => { if (typeof CoverEngine !== 'undefined') CoverEngine.download(state); };
    const iconLoader = document.getElementById('iconLoader');
    if (iconLoader) iconLoader.onchange = (e) => {
        if (e.target.files[0]) processAndResizeImage(e.target.files[0], 500, 'image/png', (url) => {
            state.images.icon = url; updateSymbolUI(); refresh(); document.getElementById('galleryModal').classList.add('hidden');
        });
    };
    const imageLoader = document.getElementById('imageLoader');
    if (imageLoader) imageLoader.onchange = (e) => {
        if (e.target.files[0]) {
            let limit = 2500; let type = 'image/jpeg';
            if (state.layout === 'graphic') { limit = 1417; type = 'image/png'; }
            processAndResizeImage(e.target.files[0], limit, type, (url) => {
                document.getElementById('galleryModal').classList.add('hidden');
                if (state.layout === 'graphic') {
                    state.images.main = { src: url, natural: true };
                    refresh(); updateActionButtons();
                } else {
                    document.getElementById('cropperModal').classList.remove('hidden');
                    updateCropperUI();
                    if (state.layout === 'photo_text') state.slotSize = { w: 6, h: 6 };
                    if (state.layout === 'magazine') CropperTool.start(url, 1, 1, 'rect');
                    else CropperTool.start(url, state.slotSize.w, state.slotSize.h, state.maskType);
                }
            });
        }
        e.target.value = '';
    };
    window.setCropMask = (w, h) => {
        if (w === 'circle') { state.slotSize = { w: 6, h: 6 }; state.maskType = 'circle'; }
        else { state.slotSize = { w: w, h: h }; state.maskType = 'rect'; }
        CropperTool.maskType = state.maskType;
        CropperTool.drawOverlay(state.slotSize.w, state.slotSize.h);
    };
    const applyCrop = document.getElementById('applyCropBtn');
    if (applyCrop) applyCrop.onclick = () => {
        state.images.main = CropperTool.apply();
        refresh(); document.getElementById('cropperModal').classList.add('hidden'); updateActionButtons();
    };
    const rotBtn = document.getElementById('rotateBtn');
    if (rotBtn) rotBtn.onclick = () => CropperTool.rotate();
    const cancelCrop = document.getElementById('cancelCropBtn');
    if (cancelCrop) cancelCrop.onclick = () => document.getElementById('cropperModal').classList.add('hidden');
}

function processAndResizeImage(file, maxSize, outputType, callback) {
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        if (window.heic2any) {
            heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 }).then((res) => {
                const blob = Array.isArray(res) ? res[0] : res;
                const newFile = new File([blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
                processAndResizeImage(newFile, maxSize, outputType, callback);
            }).catch(e => alert("HEIC Error"));
            return;
        }
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL(outputType, 0.9));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function updateSymbolUI() {
    const btn = document.getElementById('globalSymbolBtn');
    if (state.images.icon) {
        btn.style.backgroundImage = `url(${state.images.icon})`;
        btn.classList.add('active'); btn.style.borderColor = state.text.color;
    } else {
        btn.style.backgroundImage = 'none'; btn.classList.remove('active'); btn.style.borderColor = '#444';
    }
}

function updateCropperUI() {
    const controls = document.querySelector('.crop-controls');
    if (state.layout === 'magazine') controls.style.display = 'none'; else controls.style.display = 'flex';
}

window.toggleCase = (i) => {
    state.text.lines[i - 1].upper = !state.text.lines[i - 1].upper;
    document.getElementById(`btnTt${i}`).classList.toggle('active'); refresh();
};
window.addSmartRow = () => {
    const row2 = document.getElementById('row2'); const row3 = document.getElementById('row3');
    if (row2.classList.contains('hidden')) row2.classList.remove('hidden');
    else if (row3.classList.contains('hidden')) row3.classList.remove('hidden');
};
window.hideRow = (i) => {
    document.getElementById(`row${i}`).classList.add('hidden');
    const inp = document.getElementById(`inputLine${i}`); if (inp) inp.value = '';
    state.text.lines[i - 1].text = ''; refresh();
};
window.toggleSpinePart = (part) => {
    state.spine[part] = !state.spine[part];
    const btnId = 'btnSpine' + part.charAt(0).toUpperCase() + part.slice(1);
    document.getElementById(btnId).classList.toggle('active', state.spine[part]); refresh();
};
window.setLayout = (l, btn) => {
    const isSame = state.layout === l; state.layout = l;
    document.querySelectorAll('.layout-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (!isSame) state.images.main = null;
    if (l === 'magazine') state.maskType = 'rect';
    else if (l === 'graphic') { state.maskType = 'rect'; state.slotSize = { w: 12, h: 12 }; }
    else { state.maskType = 'rect'; state.slotSize = { w: 6, h: 6 }; }
    refresh(); updateActionButtons();
};
window.handleCanvasClick = (objType) => {
    // OLD
};
// NEW: setBookSize now takes format string
window.setBookSize = (formatKey, btn) => {
    state.format = formatKey;
    document.querySelectorAll('.format-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refresh();
};
window.updateScaleFromSlider = (v) => { state.text.scale = CONFIG.scales[v - 1]; refresh(); };
window.setScale = (s) => {
    const idx = CONFIG.scales.indexOf(s);
    if (idx > -1) {
        document.getElementById('textScale').value = idx + 1;
        window.updateScaleFromSlider(idx + 1);
    }
};
window.triggerAssetLoader = () => {};

// =========================================================
// 5. CROPPER TOOL (ДОБАВЛЕНО!)
// =========================================================
const CropperTool = {
    canvas: null,
    ctx: null,
    image: null,
    scale: 1,
    offsetX: 0, offsetY: 0,
    isDragging: false,
    startX: 0, startY: 0,
    maskW: 0, maskH: 0,
    maskType: 'rect',
    canvasSize: 300, // Размер области предпросмотра

    start: function(imageUrl, wRatio, hRatio, type) {
        this.canvas = document.getElementById('cropCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.maskType = type;
        
        // Устанавливаем размер канваса кроппера
        this.canvas.width = this.canvasSize;
        this.canvas.height = this.canvasSize;

        const img = new Image();
        img.onload = () => {
            this.image = img;
            // Сброс позиционирования
            this.scale = Math.min(this.canvasSize / img.width, this.canvasSize / img.height); 
            // Центрируем
            this.offsetX = (this.canvasSize - (img.width * this.scale)) / 2;
            this.offsetY = (this.canvasSize - (img.height * this.scale)) / 2;
            
            this.drawOverlay(wRatio, hRatio);
            this.setupEvents();
        };
        img.src = imageUrl;
    },

    drawOverlay: function(w, h) {
        if (!this.ctx || !this.image) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем картинку
        this.ctx.drawImage(
            this.image, 
            this.offsetX, this.offsetY, 
            this.image.width * this.scale, 
            this.image.height * this.scale
        );

        // Затемняем всё
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Вычисляем размер маски относительно канваса (макс 80% от размера канваса)
        const maxSize = this.canvasSize * 0.8;
        let maskPixelW, maskPixelH;

        if (w >= h) {
            maskPixelW = maxSize;
            maskPixelH = maxSize * (h / w);
        } else {
            maskPixelH = maxSize;
            maskPixelW = maxSize * (w / h);
        }

        this.maskW = maskPixelW;
        this.maskH = maskPixelH;

        const maskX = (this.canvasSize - maskPixelW) / 2;
        const maskY = (this.canvasSize - maskPixelH) / 2;

        this.ctx.save();
        this.ctx.beginPath();
        if (this.maskType === 'circle') {
            this.ctx.arc(this.canvasSize/2, this.canvasSize/2, maskPixelW/2, 0, Math.PI*2);
        } else {
            this.ctx.rect(maskX, maskY, maskPixelW, maskPixelH);
        }
        this.ctx.clip();

        // Рисуем "чистую" картинку внутри маски
        this.ctx.drawImage(
            this.image, 
            this.offsetX, this.offsetY, 
            this.image.width * this.scale, 
            this.image.height * this.scale
        );
        this.ctx.restore();

        // Рамка
        this.ctx.strokeStyle = '#D4AF37';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    },

    setupEvents: function() {
        const slider = document.getElementById('zoomSlider');
        slider.value = 1;
        slider.oninput = (e) => {
            const zoom = parseFloat(e.target.value);
            // Базовый масштаб * зум слайдера
            const baseScale = Math.min(this.canvasSize / this.image.width, this.canvasSize / this.image.height);
            // Сохраняем центр при зуме (упрощенно)
            const oldScale = this.scale;
            this.scale = baseScale * zoom;
            
            // Корректировка смещения, чтобы зумить в центр
            const ratio = this.scale / oldScale;
            this.offsetX = this.canvasSize/2 - (this.canvasSize/2 - this.offsetX) * ratio;
            this.offsetY = this.canvasSize/2 - (this.canvasSize/2 - this.offsetY) * ratio;

            this.drawOverlay(state.slotSize.w, state.slotSize.h);
        };

        // Мышь / Тач
        let lastX, lastY;
        
        const startDrag = (x, y) => {
            this.isDragging = true;
            lastX = x;
            lastY = y;
        };
        const moveDrag = (x, y) => {
            if (this.isDragging) {
                this.offsetX += x - lastX;
                this.offsetY += y - lastY;
                lastX = x;
                lastY = y;
                this.drawOverlay(state.slotSize.w, state.slotSize.h);
            }
        };
        const endDrag = () => { this.isDragging = false; };

        this.canvas.onmousedown = (e) => startDrag(e.clientX, e.clientY);
        window.onmousemove = (e) => moveDrag(e.clientX, e.clientY);
        window.onmouseup = endDrag;

        this.canvas.ontouchstart = (e) => { startDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); };
        window.ontouchmove = (e) => { moveDrag(e.touches[0].clientX, e.touches[0].clientY); };
        window.ontouchend = endDrag;
    },

    rotate: function() {
        if (!this.image) return;
        // Создаем временный канвас для поворота
        const c = document.createElement('canvas');
        c.width = this.image.height;
        c.height = this.image.width;
        const ctx = c.getContext('2d');
        ctx.translate(c.width/2, c.height/2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.drawImage(this.image, -this.image.width/2, -this.image.height/2);
        
        // Обновляем картинку
        const newImg = new Image();
        newImg.onload = () => {
            this.image = newImg;
            this.drawOverlay(state.slotSize.w, state.slotSize.h);
        };
        newImg.src = c.toDataURL();
    },

    apply: function() {
        // Возвращаем объект с данными для CoverEngine
        // Нам нужно знать, какая часть изображения (в % или пикселях) попала в маску
        
        // Центр маски на канвасе
        const maskCX = this.canvasSize / 2;
        const maskCY = this.canvasSize / 2;
        
        // Положение картинки на канвасе: this.offsetX, this.offsetY
        // Размер картинки на канвасе: this.image.width * this.scale
        
        // Нам нужно смещение центра картинки относительно центра маски
        // Image Center
        const imgCX = this.offsetX + (this.image.width * this.scale / 2);
        const imgCY = this.offsetY + (this.image.height * this.scale / 2);
        
        // Delta (насколько картинка сдвинута от центра маски)
        const deltaX = imgCX - maskCX;
        const deltaY = imgCY - maskCY;
        
        // Теперь переводим это в координаты для оригинального изображения
        // Если scale = 0.5, то 1 пиксель на экране = 2 пикселя оригинала
        const realDeltaX = deltaX / this.scale;
        const realDeltaY = deltaY / this.scale;
        
        // Вычисляем, какой кусок оригинала вырезать. 
        // В CoverEngine мы просто сдвигаем картинку внутри маски
        
        // Передаем параметры для Fabric.js
        return {
            src: this.image.src,
            cropInfo: {
                // Смещение центра изображения относительно центра слота
                left: realDeltaX, 
                top: realDeltaY,
                // Масштаб относительно "вписанного" состояния
                // Если image.width * scale == maskW, это 100%
                // Мы передаем просто scale, а CoverEngine пересчитает
                // Но лучше передать соотношение маски к картинке
                scale: this.scale, // Текущий масштаб на экране
                slotPixelSize: this.maskW // Размер маски на экране в пикселях
            }
        };
    }
};