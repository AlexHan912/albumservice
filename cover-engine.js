/* cover-engine.js - Final V95 (Positioning Logic) */

const CONFIG = {
    dpi: 300, 
    cmToInch: 2.54, 
    spineWidthCm: 1.5, 
    renderScale: 3.0,
    globalOpacity: 1.0, 
    typo: { baseTitle: 1.2, baseDetails: 0.5, baseCopy: 0.35 },
    scales: [0.5, 0.75, 1.0, 1.25, 1.5]
};

const CoverEngine = {
    canvas: null,
    
    init: function(canvasId) {
        this.canvas = new fabric.Canvas(canvasId, { backgroundColor: '#fff', selection: false, enableRetinaScaling: false });
        
        this.canvas.on('mouse:down', (e) => {
            if(e.target) {
                if(e.target.isMain || e.target.isPlaceholder) {
                    if(window.handleCanvasClick) window.handleCanvasClick(e.target.isMain ? 'mainImage' : 'placeholder');
                }
                else if (e.target.isIcon) {
                    // Используем общий хендлер для открытия новой панели
                    if(window.handleCanvasClick) window.handleCanvasClick('icon');
                }
            }
        });

        this.canvas.on('mouse:up', (e) => {
            const isMobile = window.innerWidth <= 900;
            const hitInteractive = e.target && (e.target.isMain || e.target.isPlaceholder || e.target.isIcon);
            
            if (isMobile && e.isClick && !hitInteractive) {
                setTimeout(() => {
                    if(window.openMobilePreview) window.openMobilePreview();
                }, 100);
            }
        });
    },

    loadSimpleImage: function(path, callback) {
        const img = new Image();
        img.onload = () => callback(path);
        img.onerror = () => { callback(null); };
        img.src = path;
    },

updateDimensions: function(container, state) {
        if(!container || container.clientWidth === 0) return;
        
        const isMobile = window.innerWidth < 900;
        const margin = isMobile ? 15 : 30; 
        
        // ВЫСОТА ПАНЕЛИ УПРАВЛЕНИЯ (DOCK)
        // Мы вычитаем её, чтобы обложка центрировалась в СВОБОДНОЙ зоне
        const dockHeight = 90; // 60px высота панели + 20px отступ + 10px запас

        // Доступная высота для рисования (минус панель)
        const availableHeight = container.clientHeight - dockHeight;
        const availableWidth = container.clientWidth;

        const curBookSize = parseFloat(state.bookSize);
        const curW = curBookSize * 2 + CONFIG.spineWidthCm; 
        const curH = curBookSize;

        let basePPI;
        
        if (isMobile) {
            const safeW = availableWidth - (margin * 2);
            const safeH = availableHeight - (margin * 2);
            basePPI = Math.min(safeW / curW, safeH / curH);
        } else {
            // Desktop Logic
            const MAX_REF_SIZE = 30; 
            const maxRefW = MAX_REF_SIZE * 2 + CONFIG.spineWidthCm; 
            const maxRefH = MAX_REF_SIZE;
            
            basePPI = Math.max(5, Math.min(
                (availableWidth - margin*2) / maxRefW, 
                (availableHeight - margin*2) / maxRefH
            ));
        }

        state.ppi = basePPI * CONFIG.renderScale;
        
        // Устанавливаем размер канваса на ВЕСЬ контейнер (включая зону под панелью),
        // но рисовать будем со смещением
        this.canvas.setWidth(availableWidth); 
        this.canvas.setHeight(availableHeight); // Канвас заканчивается ДО панели
        
        // CSS для канваса (позиционируем его в верхней части)
        this.canvas.wrapperEl.style.width = `${availableWidth}px`; 
        this.canvas.wrapperEl.style.height = `${availableHeight}px`;
        // Центрируем сам элемент канваса внутри workspace (если workspace flex)
        this.canvas.wrapperEl.style.marginBottom = `${dockHeight}px`; 

        // Перерисовка
        this.render(state);
    },

   render: function(state) {
        if(!this.canvas) return;
        this.canvas.clear(); 
        this.canvas.setBackgroundColor(state.coverColor);
        
        // Используем реальную высоту канваса (она уже уменьшена на dockHeight)
        const h = this.canvas.height; 
        const w = this.canvas.width;
        
        const bookSize = parseFloat(state.bookSize);
        const totalBookWidthPx = (bookSize * 2 + 1.5) * state.ppi;
        
        // Центровка по X (горизонталь)
        const startX = (w - totalBookWidthPx) / 2;
        
        // Координаты
        const x1 = startX + (bookSize * state.ppi); 
        const x2 = x1 + (1.5 * state.ppi);
        
        const c = { 
            h: h, 
            spineX: x1 + ((x2 - x1) / 2), 
            frontCenter: x2 + (bookSize * state.ppi / 2), 
            backCenter: startX + (bookSize * state.ppi) / 2, 
            bottomBase: h - (1.5 * state.ppi), // Отступ от низа КНИГИ, а не экрана
            centerY: h / 2, 
            gap: 2.0 * state.ppi 
        };

        this._drawGuides(x1, x2, h, state);
        this._renderSpine(c, state);
        this._renderBackCover(c, state);
        this._renderFrontCover(c, state);
    },

    _drawGuides: function(x1, x2, h, state) {
        const opts = { stroke: state.text.color, strokeWidth: 2, strokeDashArray: [10,10], selectable: false, evented: false, opacity: 0.3 };
        this.canvas.add(new fabric.Line([x1, 0, x1, h], opts)); 
        this.canvas.add(new fabric.Line([x2, 0, x2, h], opts));
    },

    _renderSpine: function(c, state) {
        if(state.spine.symbol && state.images.icon) {
            this._placeImage(state.images.icon, c.spineX, c.bottomBase, 1.0 * state.ppi, { originY: 'bottom', color: state.text.color, isIcon: true, hoverCursor: 'pointer' });
        }
        
        let parts = [];
        const raw = state.text.lines.map(l => l.text);
        if(state.spine.title) {
            const processed = raw.map((txt, i) => state.text.lines[i].upper ? txt.toUpperCase() : txt).filter(Boolean);
            if(processed.length > 0) parts.push(processed.join(" "));
        }
        if(state.spine.date && state.text.date) parts.push(state.text.date);
        
        if(parts.length > 0) {
            const spineStr = parts.join("  •  ");
            let yPos = c.bottomBase; 
            if(state.spine.symbol && state.images.icon) yPos -= (1.8 * state.ppi); 
            
            const fontSize = CONFIG.typo.baseDetails * state.ppi; 
            const textYPos = yPos - (0.5 * state.ppi); 
            
            this.canvas.add(new fabric.Text(spineStr, { 
                fontFamily: 'Tenor Sans', 
                fontSize: fontSize, 
                fill: state.text.color, 
                opacity: CONFIG.globalOpacity, 
                originX: 'left', 
                originY: 'center', 
                left: c.spineX, 
                top: textYPos, 
                angle: -90, 
                selectable: false, 
                letterSpacing: 100,
                objectCaching: false, 
                padding: 30 
            }));
        }
    },

    _renderBackCover: function(c, state) {
        if(state.text.copyright) {
            const fontSize = CONFIG.typo.baseCopy * state.ppi;
            this.canvas.add(new fabric.Text(state.text.copyright, { 
                left: c.backCenter, top: c.bottomBase, fontSize: fontSize, fontFamily: 'Tenor Sans', fill: state.text.color, 
                opacity: CONFIG.globalOpacity * 0.7, originX: 'center', originY: 'bottom', selectable: false, letterSpacing: 80 
            }));
        }
        if(state.qr.enabled && state.qr.url) {
            const qrObj = new QRious({ value: state.qr.url, size: 500, level: 'H', foreground: state.text.color, backgroundAlpha: 0 });
            this._placeImage(qrObj.toDataURL(), c.backCenter, c.bottomBase - (0.5 * state.ppi) - (0.35 * state.ppi) - (0.5*state.ppi), 1.2 * state.ppi, { originY: 'bottom' });
        }
    },

    _renderFrontCover: function(c, state) {
        const layout = state.layout; const x = c.frontCenter; const y = c.centerY; 
        if (layout === 'magazine') {
            const coverW = state.bookSize * state.ppi; const coverH = c.h; 
            if(state.images.main) this._placeClippedImage(state.images.main, x, y, coverW, coverH, 'rect', false, state);
            else this._renderImageSlot(x, y, state, { w: coverW, h: coverH });
            this._renderTextBlock(x, 2.0 * state.ppi, false, true, state);
        } 
        else if (layout === 'icon') { this._renderIcon(x, y, null, state); }
        else if (layout === 'text_icon') {
            const gap = c.gap; const dynGap = gap * state.text.scale; const tObj = this._createTextBlockObj(true, state);
            const iconSize = (2.0 / 1.6) * state.ppi * state.text.scale; const visualGap = dynGap * 1.5; 
            const totalH = tObj.height + visualGap + iconSize; const startY = y - (totalH / 2); 
            tObj.set({ left: x, top: startY + tObj.height/2 }); this.canvas.add(tObj);
            this._renderIcon(x, startY + tObj.height + visualGap + iconSize/2, iconSize, state);
        } 
        else if (layout === 'graphic' || layout === 'photo_text') {
            let imgY = c.centerY; 
            if(layout === 'graphic') {
                const style = getComputedStyle(document.documentElement);
                const offsetCm = parseFloat(style.getPropertyValue('--graphic-offset-y-cm')) || 2;
                imgY = c.centerY - (offsetCm * state.ppi);
                if(state.images.main) this._renderNaturalImage(x, imgY, state);
                else this._renderImageSlot(x, imgY, state);
            } else {
                const zoom = state.text.scale || 1.0;
                const w = state.slotSize.w * state.ppi * zoom; const h = state.slotSize.h * state.ppi * zoom;
                imgY = c.centerY - (2.0 * state.ppi); 
                if(state.images.main) this._placeClippedImage(state.images.main, x, imgY, w, h, state.maskType, false, state);
                else this._renderImageSlot(x, imgY, state, {w: w, h: h});
                const textY = imgY + (h / 2) + (1.5 * state.ppi);
                this._renderTextBlock(x, textY, true, false, state, 'top'); 
            }
        }
        else if (layout === 'text') { const tObj = this._createTextBlockObj(false, state); tObj.set({ left: x, top: c.centerY }); this.canvas.add(tObj); } 
    },

    _createTextBlockObj: function(compact, state) {
        const rawLines = state.text.lines.map(l => l.text); 
        const processedLines = rawLines.map((txt, i) => { return state.text.lines[i].upper ? txt.toUpperCase() : txt; });
        const hasText = rawLines.some(t => t.length > 0);
        let renderTxt = hasText ? processedLines.filter(Boolean).join("\n") : "THE VISUAL DIARY\n\n\n";
        let opacity = hasText ? CONFIG.globalOpacity : 0.3;
        const baseSize = compact ? 0.8 : CONFIG.typo.baseTitle; const finalSize = baseSize * state.ppi * state.text.scale;
        const tObj = new fabric.Text(renderTxt, { fontFamily: state.text.font, fontSize: finalSize, textAlign: 'center', lineHeight: 1.3, fill: state.text.color, opacity: opacity, selectable: false, originX: 'center', originY: 'center', hoverCursor: 'default' });
        const group = new fabric.Group([tObj], { originX: 'center', originY: 'center', hoverCursor: 'default' });
        if(state.text.date) { 
            const dateStr = state.text.date; const dateOp = CONFIG.globalOpacity; const dateSize = CONFIG.typo.baseDetails * state.ppi * state.text.scale;
            const gap = (compact ? 1.0 : 2.0) * state.ppi;
            const dObj = new fabric.Text(dateStr, { fontFamily: state.text.font, fontSize: dateSize, fill: state.text.color, opacity: dateOp, originX: 'center', originY: 'top', top: (tObj.height / 2) + gap, hoverCursor: 'default' });
            group.addWithUpdate(dObj);
        }
        return group;
    },

    _renderTextBlock: function(x, y, compact, isMag, state, verticalOrigin = 'center') {
        if(state.layout === 'graphic') return;
        if(isMag) {
            let l1 = String(state.text.lines[0].text || ""); let l2 = String(state.text.lines[1].text || ""); let l3 = String(state.text.lines[2].text || ""); 
            if(state.text.lines[0].upper) l1 = l1.toUpperCase(); if(state.text.lines[1].upper) l2 = l2.toUpperCase(); if(state.text.lines[2].upper) l3 = l3.toUpperCase();
            let txtParts = [l1, l2, l3].filter(t => t.length > 0); if (txtParts.length === 0) return;
            let txt = txtParts.join("\n");
            const shadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 4, offsetX: 0, offsetY: 0 });
            const mainTextObj = new fabric.Text(txt, { fontFamily: state.text.font, fontSize: 2.5 * state.ppi * state.text.scale, textAlign: 'center', lineHeight: 1.0, originX: 'center', originY: 'top', left: x, top: y, fill: state.text.color, selectable: false, evented: false, shadow: shadow, hoverCursor: 'default' });
            this.canvas.add(mainTextObj);
            if(state.text.date) {
                const dateObj = new fabric.Text(state.text.date, { fontFamily: state.text.font, fontSize: 0.8 * state.ppi * state.text.scale, fill: state.text.color, originX: 'center', originY: 'top', left: x, top: y + mainTextObj.height + (1.0 * state.ppi), selectable: false, evented: false, hoverCursor: 'default' });
                this.canvas.add(dateObj);
            }
            return;
        }
        const group = this._createTextBlockObj(compact, state); group.set({ left: x, top: y, originY: verticalOrigin, hoverCursor: 'default' }); this.canvas.add(group);
    },

    // --- POS: ICON ---
    _renderIcon: function(x, y, forcedSize, state) {
        let iconUrl = state.images.icon; let isGhost = false;
        if(!iconUrl) { iconUrl = 'assets/symbols/love_heart_icon.png'; isGhost = true; }
        
        let finalX = x;
        let finalY = y;
        
        // Логика позиционирования для 'icon'
        if (state.layout === 'icon') {
            const h = this.canvas.height;
            const centerY = h / 2;
            
            if (state.imgPos === 'top') {
                finalY = centerY - (3.0 * state.ppi);
            } else if (state.imgPos === 'bottom_right') {
                finalX = x + (parseFloat(state.bookSize)/2 * state.ppi) - (2.0 * state.ppi);
                finalY = h - (3.0 * state.ppi); 
            } else {
                finalY = centerY;
            }
        }

        this._placeImage(iconUrl, finalX, finalY, forcedSize || (2.0/1.6)*state.ppi*state.text.scale, { 
            color: state.text.color, 
            opacity: isGhost ? 0.3 : CONFIG.globalOpacity, 
            isIcon: true, 
            hoverCursor: 'pointer' 
        });
    },

    _renderImageSlot: function(x, y, state, customSize = null) {
        let w, h;
        if (customSize) { w = customSize.w; h = customSize.h; } 
        else { const zoom = state.text.scale || 1.0; w = state.slotSize.w * state.ppi * zoom; h = state.slotSize.h * state.ppi * zoom; }
        
        let shape;
        const commonOpts = { fill: 'transparent', stroke: '#aaaaaa', strokeWidth: 1.5, strokeDashArray: [10, 10], left: x, top: y, originX: 'center', originY: 'center', selectable: false, evented: true, hoverCursor: 'pointer', isPlaceholder: true };
        if(state.maskType === 'circle') shape = new fabric.Circle({ radius: w/2, ...commonOpts });
        else shape = new fabric.Rect({ width: w, height: h, ...commonOpts });
        this.canvas.add(shape);

        const btnRadius = 25 * (state.ppi / 30); 
        const btnShadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 10, offsetX: 0, offsetY: 4 });
        const btnCircle = new fabric.Circle({ radius: btnRadius, fill: '#ffffff', shadow: btnShadow, originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(btnCircle);

        const plusSize = btnRadius * 0.6; const plusWidth = 2 * (state.ppi / 30); 
        const vLine = new fabric.Rect({ width: plusWidth, height: plusSize, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        const hLine = new fabric.Rect({ width: plusSize, height: plusWidth, fill: '#333333', originX: 'center', originY: 'center', left: x, top: y, selectable: false, evented: false });
        this.canvas.add(vLine); this.canvas.add(hLine);
    },
    
    // --- POS: NATURAL IMAGE ---
    _renderNaturalImage: function(x, y, state) {
        if(state.images.main && state.images.main.src) {
            fabric.Image.fromURL(state.images.main.src, (img) => {
                if(!img) return;
                const slotW_px = state.slotSize.w * state.ppi; const slotH_px = state.slotSize.h * state.ppi;
                const scaleX = slotW_px / img.width; const scaleY = slotH_px / img.height;
                const baseScale = Math.min(scaleX, scaleY);
                const userZoom = state.text.scale || 1.0;
                const finalScale = baseScale * userZoom;

                let finalX = x;
                let finalY = y;

                if (state.imgPos === 'top') {
                    finalY = y - (3.0 * state.ppi);
                } else if (state.imgPos === 'bottom_right') {
                    const bookW = parseFloat(state.bookSize) * state.ppi;
                    const bookH = this.canvas.height;
                    finalX = x + (bookW / 2) - (2.0 * state.ppi);
                    finalY = bookH - (3.0 * state.ppi); 
                    img.scale(finalScale * 0.6); 
                } else {
                    img.scale(finalScale); 
                }

                if (state.imgPos !== 'bottom_right') img.set({ scaleX: finalScale, scaleY: finalScale });
                
                img.set({ 
                    left: finalX, top: finalY, 
                    originX: state.imgPos === 'bottom_right' ? 'right' : 'center', 
                    originY: state.imgPos === 'bottom_right' ? 'bottom' : 'center', 
                    opacity: CONFIG.globalOpacity, selectable: false, evented: true, hoverCursor: 'pointer', isMain: true 
                });
                
                const filter = new fabric.Image.filters.BlendColor({ color: state.text.color, mode: 'tint', alpha: 1 }); 
                img.filters.push(filter); img.applyFilters();
                this.canvas.add(img);
            });
        }
    },

    _placeImage: function(url, x, y, width, opts = {}) {
        fabric.Image.fromURL(url, (img) => {
            if(!img) return;
            img.scaleToWidth(width);
            img.set({ left: x, top: y, originX: 'center', originY: 'center', selectable: false, opacity: CONFIG.globalOpacity, ...opts });
            if(opts.color) { img.filters.push(new fabric.Image.filters.BlendColor({ color: opts.color, mode: 'tint', alpha: 1 })); img.applyFilters(); }
            this.canvas.add(img); if(opts.sendBack) this.canvas.sendToBack(img);
        });
    },

    _placeClippedImage: function(imgData, x, y, w, h, maskType, isBack, state) {
        if(!imgData || !imgData.src) return;
        fabric.Image.fromURL(imgData.src, (img) => {
            const info = imgData.cropInfo; const scaleFactor = w / info.slotPixelSize;
            if(isBack) {
                const coverW = w; const scale = Math.max(coverW / img.width, h / img.height);
                img.set({ scaleX: scale, scaleY: scale, left: x, top: h/2, originX: 'center', originY: 'center', selectable: false, evented: true, hoverCursor: 'pointer', isMain: true });
                img.clipPath = new fabric.Rect({ width: coverW/scale, height: h/scale, left: -coverW/2/scale, top: -h/2/scale });
                this.canvas.add(img); this.canvas.sendToBack(img);
            } else {
                let clip; const absoluteOpts = { left: x, top: y, originX: 'center', originY: 'center', absolutePositioned: true };
                if(maskType === 'circle') { clip = new fabric.Circle({ radius: w/2, ...absoluteOpts }); } 
                else { clip = new fabric.Rect({ width: w, height: h, ...absoluteOpts }); }
                const imgLeft = x + (info.left * scaleFactor); const imgTop = y + (info.top * scaleFactor);
                const totalScale = info.scale * scaleFactor;
                img.set({ left: imgLeft, top: imgTop, scaleX: totalScale, scaleY: totalScale, angle: info.angle || 0, originX: 'center', originY: 'center', selectable: false, evented: true, hoverCursor: 'pointer', isMain: true, clipPath: clip });
                this.canvas.add(img); img.sendToBack(); 
            }
        });
    },
    
    download: function(state) {
        const mult = (CONFIG.dpi / CONFIG.cmToInch) / state.ppi;
        this.canvas.getObjects('line').forEach(o => o.opacity = 0);
        const data = this.canvas.toDataURL({ format: 'png', multiplier: mult, quality: 1 });
        this.canvas.getObjects('line').forEach(o => o.opacity = 0.3);
        const a = document.createElement('a'); a.download = `malevich_cover_${state.bookSize}.png`; a.href = data; a.click();
    }
};