// The four image slots. `left`, `center` and `right` are historic names kept so
// the DOM ids, data-side attributes and saved state stay put — treat all four as
// plain identifiers. Position comes from LAYOUTS below, never from the name.
const SLOTS = ['left', 'center', 'right', 'fourth'];

// Every layout is a grid: `cols` columns by `rows` rows, filled in reading order
// from `slots`. `cuts` names the adjustable divider positions, as percentages —
// 'v' entries split columns, 'h' entries split rows.
const LAYOUTS = {
    two:   { slots: ['left', 'right'],                     cols: 2, rows: 1, cuts: { v: [50] } },
    three: { slots: ['left', 'center', 'right'],           cols: 3, rows: 1, cuts: { v: [33, 67] } },
    four:  { slots: ['left', 'center', 'right', 'fourth'], cols: 4, rows: 1, cuts: { v: [25, 50, 75] } },
    quad:  { slots: ['left', 'center', 'right', 'fourth'], cols: 2, rows: 2, cuts: { v: [50], h: [50] } }
};

const perSlot = (value) => Object.fromEntries(SLOTS.map((s) => [s, typeof value === 'function' ? value() : value]));

class Banfinator {
    constructor() {
        this.previewCanvas = document.getElementById('imageCanvas');
        this.canvasFrame = document.querySelector('.canvas-frame');
        this.previewCtx = this.previewCanvas.getContext('2d', { colorSpace: 'srgb' }) || this.previewCanvas.getContext('2d');
        this.renderCanvas = this.createRenderSurface();
        this.renderCtx = this.renderCanvas.getContext('2d', { colorSpace: 'srgb' }) || this.renderCanvas.getContext('2d');
        this.version = '4.1';
        this.splitSlider = document.getElementById('splitSlider');
        this.splitReadout = document.getElementById('splitReadout');
        this.exportBtn = document.getElementById('exportBtn');
        this.bylineInput = document.getElementById('bylineInput');
        this.suffixInfoBox = document.getElementById('suffixInfo');
        this.layoutToggleButtons = document.querySelectorAll('[data-layout-mode]');
        this.swapButton = document.getElementById('swapButton');
        this.resetLayoutButton = document.getElementById('resetLayoutBtn');
        SLOTS.forEach((side) => { this[`${side}Input`] = document.getElementById(`${side}FileInput`); });
        this.labelTargets = perSlot();
        this.zoomInputs = perSlot();
        this.resetButtons = perSlot();
        SLOTS.forEach((side) => {
            // Several elements carry a slot's letter — the drop zone, the tune
            // card and the reorder row — so collect all of them, not the first.
            this.labelTargets[side] = [...document.querySelectorAll(`[data-label-target="${side}"]`)];
            this.zoomInputs[side] = document.getElementById(`${side}Zoom`);
            this.resetButtons[side] = document.querySelector(`[data-reset="${side}"]`);
        });
        this.images = perSlot(null);
        this.bureauRegex = /\/(TT|AFP|NTB|AP)\s*$/i;
        this.bureauSuffixes = perSlot('');
        this.labelPool = ['A', 'B', 'C', 'D'];
        this.overlayLabels = {};
        this.transforms = perSlot(() => ({ scale: 1, offsetX: 0, offsetY: 0 }));
        this.bylineSources = perSlot('');
        this.colorProfiles = perSlot('');
        this.bylineDirty = false;
        this.dragState = null;
        this.ratio = 0.5;
        this.layoutMode = 'two';
        // Divider positions per mode, as percentages, so switching modes and
        // coming back does not lose an adjustment.
        this.cuts = Object.fromEntries(Object.entries(LAYOUTS).map(
            ([mode, def]) => [mode, { v: [...(def.cuts.v || [])], h: [...(def.cuts.h || [])] }]
        ));
        this.hoverSide = null;
        this.dividerWidth = 10;
        this.renderCanvas.width = 3840;
        this.renderCanvas.height = 2160;
        this.previewCanvas.width = 3840;
        this.previewCanvas.height = 2160;
        this.profilePromise = this.loadColorProfiles();
        this.labelOverlay = this.createLabelOverlay();
        this.bindEvents();
        this.applyLayoutMode(this.layoutMode);
        this.resetMetadataInputs();
        this.updateReadout();
        this.updateButtonState();
        this.updateLabelPills();
        this.clearCaches();
        this.draw();
    }

    createRenderSurface() {
        return typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(3840, 2160)
            : Object.assign(document.createElement('canvas'), { width: 3840, height: 2160 });
    }

    createLabelOverlay() {
        if (!this.canvasFrame) return null;
        const overlay = this.canvasFrame.querySelector('.label-overlay') || document.createElement('div');
        overlay.classList.add('label-overlay');
        if (!overlay.parentElement) {
            this.canvasFrame.appendChild(overlay);
        }

        SLOTS.forEach((side, idx) => {
            const badge = this.createLabelBadge(this.labelPool[idx]);
            overlay.appendChild(badge);
            this.overlayLabels[side] = badge;
        });

        return overlay;
    }

    createLabelBadge(text) {
        const badge = document.createElement('div');
        badge.className = 'label-badge';
        badge.textContent = text;
        return badge;
    }

    bindEvents() {
        this.splitSlider?.addEventListener('input', (e) => {
            this.ratio = e.target.value / 100;
            this.updateReadout();
            this.draw();
        });

        // Divider sliders for three / four / quad. Each carries the mode it
        // belongs to, the axis it cuts and its index within that axis.
        document.querySelectorAll('[data-cut]').forEach((input) => {
            input.addEventListener('input', (e) => {
                const [mode, axis, index] = input.dataset.cut.split(':');
                this.setCut(mode, axis, Number(index), parseFloat(e.target.value));
            });
        });

        this.layoutToggleButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.setLayoutMode(btn.dataset.layoutMode));
        });
        this.swapButton?.addEventListener('click', () => this.swapTwoImages());
        this.exportBtn.addEventListener('click', () => this.export());
        this.resetLayoutButton?.addEventListener('click', () => this.clearAllImages());

        SLOTS.forEach((side) => {
            const zone = document.querySelector(`.drop-zone[data-side="${side}"]`);
            if (zone && this[`${side}Input`]) this.setupDropZone(zone, this[`${side}Input`], side);
        });
        this.setupCanvasDropTarget();

        this.bylineInput.addEventListener('input', () => {
            this.bylineDirty = true;
            this.draw();
        });

        Object.entries(this.zoomInputs).forEach(([side, input]) => {
            input?.addEventListener('input', (e) => {
                this.setZoom(side, parseFloat(e.target.value));
            });
        });

        Object.entries(this.resetButtons).forEach(([side, btn]) => {
            btn?.addEventListener('click', () => this.resetView(side));
        });

        window.addEventListener('resize', () => this.updateLabelOverlayPositions());

        // The preview's empty state and drop outline are drawn from CSS tokens,
        // so both the toggle and an OS-level switch have to trigger a repaint.
        new MutationObserver(() => this.draw())
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', () => this.draw());

        this.setupOrderStrip();

        this.previewCanvas.addEventListener('pointerdown', (e) => this.startDrag(e));
        this.previewCanvas.addEventListener('pointermove', (e) => this.handleDrag(e));
        this.previewCanvas.addEventListener('pointerup', (e) => this.stopDrag(e));
        this.previewCanvas.addEventListener('pointerleave', (e) => this.stopDrag(e));
        this.previewCanvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    }

    clearCaches() {
        try {
            if ('caches' in window) {
                caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
            }
            // Bust any lingering cached data URLs for the current session
            sessionStorage.clear();
        } catch (err) {
            console.warn('Cache clearing skipped', err);
        }
    }

    resetMetadataInputs() {
        if (this.bylineInput) {
            this.bylineInput.value = '';
        }
        this.bylineDirty = false;
        this.bylineSources = perSlot('');
        this.bureauSuffixes = perSlot('');
        this.updateSuffixInfo();
    }

    clearAllImages() {
        Object.keys(this.images).forEach((side) => {
            this.images[side]?.close?.();
            this.images[side] = null;
            this.transforms[side] = { scale: 1, offsetX: 0, offsetY: 0 };
            this.bylineSources[side] = '';
            this.bureauSuffixes[side] = '';
            this.colorProfiles[side] = '';
            const dropZone = document.querySelector(`.drop-zone[data-side="${side}"]`);
            dropZone?.classList.remove('loaded');
            const input = this[`${side}Input`];
            if (input) input.value = '';
        });

        Object.keys(this.zoomInputs).forEach((side) => {
            if (this.zoomInputs[side]) {
                this.zoomInputs[side].value = 1;
            }
        });

        this.resetMetadataInputs();
        this.bylineDirty = false;
        this.updateLabelPills();
        this.updateButtonState();
        this.draw();
    }

    setupDropZone(zone, input, side) {
        const handleFiles = async (files) => this.processFilesForSide(files, side, zone);

        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => handleFiles(e.target.files));

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    setupCanvasDropTarget() {
        if (!this.previewCanvas) return;
        const frame = this.previewCanvas.closest('.canvas-frame');

        const getSideFromEvent = (event) => {
            const point = this.getCanvasPoint(event);
            return this.getSideForPoint(point.x, point.y);
        };

        // The old per-side inset shadows only ever described a left/right split.
        // With four slots and a 2x2 the target is outlined on the canvas itself,
        // which works for any grid and points at the exact region.
        const clearState = () => {
            frame?.classList.remove('dragover');
            if (this.hoverSide !== null) {
                this.hoverSide = null;
                this.presentPreview();
            }
        };

        this.previewCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            const side = getSideFromEvent(e);
            frame?.classList.add('dragover');
            if (side !== this.hoverSide) {
                this.hoverSide = side;
                this.presentPreview();
            }
        });

        this.previewCanvas.addEventListener('dragleave', () => clearState());

        this.previewCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const side = getSideFromEvent(e);
            clearState();
            if (!side) return;
            const zone = document.querySelector(`.drop-zone[data-side="${side}"]`);
            this.processFilesForSide(e.dataTransfer.files, side, zone);
        });
    }

    async processFilesForSide(files, side, zone) {
        const file = files?.[0];
        if (!file) return;

        this.bylineDirty = false;
        this.setBureauSuffix(side, '');
        await this.handleFileUpload(file, side, zone);
    }

    updateReadout() {
        if (!this.splitReadout) return;
        const mode = this.layoutMode;

        if (mode === 'two') {
            const leftPercent = Math.round(this.ratio * 100);
            this.splitReadout.textContent = `${leftPercent}% | ${100 - leftPercent}%`;
            return;
        }

        if (mode === 'quad') {
            const [colA] = this.getBandPercents(this.cuts.quad.v);
            const [rowA] = this.getBandPercents(this.cuts.quad.h);
            this.splitReadout.textContent = `${colA}/${100 - colA}% × ${rowA}/${100 - rowA}%`;
            return;
        }

        this.splitReadout.textContent = this.getBandPercents(this.cuts[mode].v)
            .map((p) => `${p}%`)
            .join(' | ');
    }

    setLayoutMode(mode) {
        if (!LAYOUTS[mode]) return;
        if (this.layoutMode === mode) return;
        this.layoutMode = mode;
        this.applyLayoutMode(this.layoutMode);
        this.updateReadout();
        this.updateButtonState();
        this.draw();
    }

    applyLayoutMode(mode) {
        const active = new Set(LAYOUTS[mode].slots);

        // Visibility is driven by the `hidden` attribute, not a display rule, so a
        // shown element keeps whatever display its own class gives it. A
        // `display: block` override here silently un-centres the flex drop zones.
        document.querySelectorAll('[data-layout-show]').forEach((el) => {
            el.hidden = !el.dataset.layoutShow.split(' ').includes(mode);
        });
        document.querySelectorAll('[data-side]').forEach((el) => {
            if (el.matches('[data-layout-show]')) return;
            el.hidden = !active.has(el.dataset.side);
        });

        document.body.classList.remove(...Object.keys(LAYOUTS).map((m) => `layout-${m}`));
        document.body.classList.add(`layout-${mode}`);

        this.layoutToggleButtons.forEach((btn) => {
            const isActive = btn.dataset.layoutMode === mode;
            btn.classList.toggle('is-active', isActive);
            btn.classList.toggle('is-muted', !isActive);
            btn.setAttribute('aria-pressed', isActive);
        });

        this.splitReadout?.setAttribute('aria-live', 'polite');
        if (mode === 'two' && this.splitSlider) this.splitSlider.value = this.ratio * 100;
        this.syncCutInputs();
        // Letters are positional, so a mode change re-letters every slot.
        this.updateLabelPills();
        this.updateBylineField();
        this.updateSuffixInfo();
    }

    getActiveSides() {
        // A copy: callers reorder and splice this, and LAYOUTS is shared state.
        return [...LAYOUTS[this.layoutMode].slots];
    }

    /**
     * Move one divider, keeping the cuts on that axis sorted and at least
     * MIN_GAP apart. Neighbours are pushed rather than swapped, so dragging a
     * middle divider to an end collapses the bands evenly instead of reordering
     * the images.
     */
    setCut(mode, axis, index, value) {
        const MIN_GAP = 10;
        const list = this.cuts[mode]?.[axis];
        if (!list || index >= list.length) return;

        const lower = index === 0 ? 0 : list[index - 1] + MIN_GAP;
        const upper = index === list.length - 1 ? 100 : list[index + 1] - MIN_GAP;
        list[index] = Math.min(Math.max(value, lower), upper);

        this.syncCutInputs();
        this.updateReadout();
        this.draw();
    }

    syncCutInputs() {
        document.querySelectorAll('[data-cut]').forEach((input) => {
            const [mode, axis, index] = input.dataset.cut.split(':');
            const list = this.cuts[mode]?.[axis];
            if (list) input.value = list[Number(index)];
        });
    }

    /** Band sizes along one axis, in whole percent, summing to 100. */
    getBandPercents(cuts) {
        const edges = [0, ...cuts, 100];
        const sizes = edges.slice(1).map((edge, i) => Math.round(edge - edges[i]));
        // Push rounding error into the last band so the readout always totals 100.
        sizes[sizes.length - 1] = 100 - sizes.slice(0, -1).reduce((a, b) => a + b, 0);
        return sizes;
    }

    updateButtonState() {
        const ready = this.getActiveSides().every((side) => this.images[side]);
        this.exportBtn.disabled = !ready;
    }

    /**
     * The order strip: one thumbnail per slot, in layout order, showing the
     * actual image rather than a bare letter. Reordering is direct — drag a
     * thumbnail where you want it — with arrow keys as the keyboard equivalent.
     * The old control was a stacked row per slot with a pair of arrows each,
     * which cost three or four full-width rows and never said what it reordered.
     */
    setupOrderStrip() {
        this.orderStrip = document.querySelector('.order-strip');
        if (!this.orderStrip) return;

        this.orderChips = {};
        this.orderThumbs = {};
        let dragging = null;

        SLOTS.forEach((side) => {
            const chip = this.orderStrip.querySelector(`.order-chip[data-side="${side}"]`);
            if (!chip) return;
            this.orderChips[side] = chip;
            this.orderThumbs[side] = chip.querySelector(`[data-thumb="${side}"]`);

            chip.addEventListener('dragstart', (e) => {
                dragging = side;
                chip.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Firefox will not start a drag without payload.
                e.dataTransfer.setData('text/plain', side);
            });

            chip.addEventListener('dragend', () => {
                dragging = null;
                chip.classList.remove('is-dragging');
                this.orderStrip.querySelectorAll('.order-chip').forEach((c) => c.classList.remove('is-drop-target'));
            });

            chip.addEventListener('dragover', (e) => {
                if (!dragging || dragging === side) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                chip.classList.add('is-drop-target');
            });

            chip.addEventListener('dragleave', () => chip.classList.remove('is-drop-target'));

            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                chip.classList.remove('is-drop-target');
                if (dragging && dragging !== side) this.moveImageTo(dragging, side);
            });

            chip.querySelector('[data-order-grip]')?.addEventListener('keydown', (e) => {
                const dir = { ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
                if (!dir) return;
                e.preventDefault();
                this.shiftImage(side, dir);
                // Follow the image to its new slot so repeated presses keep moving it.
                const order = this.getActiveSides();
                const target = order[(order.indexOf(side) + (dir === 'left' ? -1 : 1) + order.length) % order.length];
                this.orderChips[target]?.querySelector('[data-order-grip]')?.focus();
            });
        });
    }

    /** Move the image in `from` to position `to`, sliding the rest along. */
    moveImageTo(from, to) {
        const order = this.getActiveSides();
        const fromIndex = order.indexOf(from);
        const toIndex = order.indexOf(to);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        const reorder = (map) => {
            const sequence = order.map((slot) => map[slot]);
            const [moved] = sequence.splice(fromIndex, 1);
            sequence.splice(toIndex, 0, moved);
            order.forEach((slot, i) => { map[slot] = sequence[i]; });
        };
        ['images', 'bylineSources', 'transforms', 'bureauSuffixes', 'colorProfiles'].forEach((key) => reorder(this[key]));

        order.forEach((slot) => {
            if (this.zoomInputs[slot]) this.zoomInputs[slot].value = this.transforms[slot].scale;
        });
        this.updateBylineField();
        this.updateSuffixInfo();
        this.updateLabelPills();
        this.draw();
    }

    /** Repaint each chip's thumbnail from the image currently in that slot. */
    updateOrderThumbs() {
        if (!this.orderStrip) return;
        const active = new Set(this.getActiveSides());

        SLOTS.forEach((side) => {
            const chip = this.orderChips?.[side];
            const canvas = this.orderThumbs?.[side];
            if (!chip || !canvas) return;

            chip.hidden = !active.has(side);
            chip.classList.toggle('is-empty', !this.images[side]);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const img = this.images[side];
            if (!img) return;

            // Cover-fit, matching how the slot itself crops.
            const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        });
    }

    /**
     * A slot's letter is its position in the *current* layout, not its index in
     * SLOTS — otherwise two-image mode labels its pair A and C, because `right`
     * is the third slot globally.
     */
    labelFor(side) {
        const index = this.getActiveSides().indexOf(side);
        return index === -1 ? '' : this.labelPool[index];
    }

    updateLabelPills() {
        Object.entries(this.labelTargets).forEach(([side, els]) => {
            const letter = this.labelFor(side) || '–';
            els.forEach((el) => { el.textContent = letter; });
        });
        this.updateOrderThumbs();
        this.updateLabelOverlayPositions();
    }

    updateLabelOverlayPositions() {
        if (!this.labelOverlay || !this.previewCanvas || !this.canvasFrame) return;

        const showLabels = this.getActiveSides().length > 2;
        this.labelOverlay.classList.toggle('is-visible', showLabels);
        if (!showLabels) return;

        const { regions } = this.getLayoutRegions();
        const frameRect = this.canvasFrame.getBoundingClientRect();
        const canvasRect = this.previewCanvas.getBoundingClientRect();
        const scale = canvasRect.width / this.renderCanvas.width;
        const offsetX = canvasRect.left - frameRect.left;
        const offsetY = canvasRect.top - frameRect.top;

        SLOTS.forEach((side, idx) => {
            const badge = this.overlayLabels[side];
            if (!badge) return;
            const region = regions[side];
            // A slot the current layout does not use has no badge to place.
            badge.hidden = !region;
            if (!region) return;

            badge.textContent = this.labelFor(side);
            badge.style.left = `${offsetX + (region.x + region.width / 2) * scale}px`;
            // Sit inside the region's top edge. In a single row that reads as
            // sitting above the canvas, as before; in a 2x2 the bottom pair need
            // their own badges inside the frame.
            badge.style.top = region.y === 0
                ? `${Math.max(6, offsetY - 8)}px`
                : `${offsetY + region.y * scale + 8}px`;
        });
    }

    /** Nudge one slot's image one position, wrapping around the strip. */
    shiftImage(side, direction) {
        const order = this.getActiveSides();
        if (order.length < 2) return;
        const from = order.indexOf(side);
        if (from === -1) return;
        const to = (from + (direction === 'left' ? -1 : 1) + order.length) % order.length;
        this.moveImageTo(side, order[to]);
    }

    swapTwoImages() {
        if (this.layoutMode !== 'two') return;
        ['images', 'bylineSources', 'transforms', 'bureauSuffixes', 'colorProfiles'].forEach((key) => {
            [this[key].left, this[key].right] = [this[key].right, this[key].left];
        });
        this.setZoom('left', this.transforms.left.scale);
        this.setZoom('right', this.transforms.right.scale);
        this.updateBylineField();
        this.updateSuffixInfo();
        this.updateLabelPills();
        this.draw();
    }

    draw() {
        this.renderComposite();
        this.presentPreview();
        this.updateLabelOverlayPositions();
    }

    /**
     * Paint the offscreen surface. The preview is a straight copy of it, so the
     * palette has to be chosen here: themed while editing, fixed neutral when
     * export() repaints it on the way to a file.
     */
    renderComposite({ forExport = false } = {}) {
        if (!this.renderCtx) return;
        this.paintComposite(this.renderCtx, this.renderCanvas.width, this.renderCanvas.height, { forExport });
    }

    presentPreview() {
        if (!this.previewCtx || !this.renderCanvas) return;
        const ctx = this.previewCtx;
        ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        ctx.drawImage(
            this.renderCanvas,
            0,
            0,
            this.renderCanvas.width,
            this.renderCanvas.height,
            0,
            0,
            this.previewCanvas.width,
            this.previewCanvas.height
        );
        this.drawDropTarget(ctx);
    }

    /** Outline the region a dragged file would land in. Preview only. */
    drawDropTarget(ctx) {
        if (!this.hoverSide) return;
        const region = this.getLayoutRegions(this.previewCanvas.width, this.previewCanvas.height)
            .regions[this.hoverSide];
        if (!region) return;

        const accent = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-focus').trim() || '#0098DA';
        const inset = 12;

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 16;
        ctx.strokeRect(
            region.x + inset,
            region.y + inset,
            region.width - inset * 2,
            region.height - inset * 2
        );
        ctx.restore();
    }

    /**
     * Colours for the empty state. The export keeps the fixed neutral so a saved
     * collage never depends on what theme the page happened to be in; the preview
     * follows the page tokens so an empty slot does not sit as a black hole in a
     * cream layout.
     */
    getCanvasPalette(forExport) {
        if (forExport) return { ground: '#1c1c1c', hatch: 'rgba(255, 255, 255, 0.05)', divider: '#ffffff' };

        const css = getComputedStyle(document.documentElement);
        const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        return {
            ground: token('--color-background-tertiary', '#F4EBE2'),
            hatch: token('--color-border-primary', '#E5E2E1'),
            divider: token('--color-surface-raised', '#ffffff')
        };
    }

    paintComposite(ctx, width, height, { forExport = false } = {}) {
        const palette = this.getCanvasPalette(forExport);

        ctx.fillStyle = palette.ground;
        ctx.fillRect(0, 0, width, height);

        const { regions, dividers } = this.getLayoutRegions(width, height);
        Object.entries(regions).forEach(([side, region]) => {
            if (this.images[side]) {
                this.drawImageToRegion(ctx, this.images[side], region, side);
            } else {
                this.drawEmptyPattern(ctx, region, palette.hatch);
            }
        });

        ctx.fillStyle = palette.divider;
        dividers.forEach((d) => ctx.fillRect(d.x, d.y, d.width, d.height));
    }

    drawEmptyPattern(ctx, region, stroke) {
        const { x, y, width: w, height: h } = region;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 6;
        const gap = 64;
        for (let i = -h; i < w + h; i += gap) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + h, y + h);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawImageToRegion(ctx, img, region, side) {
        if (!img) return;
        const metrics = this.computeBaseMetrics(img, region, side);
        if (!metrics) return;
        const offsets = this.clampOffsetsForRegion(this.transforms[side].offsetX, this.transforms[side].offsetY, metrics, region);
        this.transforms[side].offsetX = offsets.x;
        this.transforms[side].offsetY = offsets.y;
        const dx = metrics.dxBase + offsets.x;
        const dy = metrics.dyBase + offsets.y;

        ctx.save();
        ctx.beginPath();
        ctx.rect(region.x, region.y, region.width, region.height);
        ctx.clip();
        ctx.drawImage(img, dx, dy, metrics.drawWidth, metrics.drawHeight);
        ctx.restore();
    }

    computeBaseMetrics(img, region, side, scaleOverride = null) {
        const baseScale = Math.max(region.width / img.width, region.height / img.height);
        const scale = baseScale * (scaleOverride ?? this.transforms[side].scale);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dxBase = region.x + (region.width - drawWidth) / 2;
        const dyBase = region.y + (region.height - drawHeight) / 2;

        return { drawWidth, drawHeight, dxBase, dyBase, scale };
    }

    clampOffsetsForRegion(offsetX, offsetY, metrics, region) {
        const maxOffsetX = region.x - metrics.dxBase;
        const minOffsetX = region.x + region.width - (metrics.dxBase + metrics.drawWidth);
        const maxOffsetY = region.y - metrics.dyBase;
        const minOffsetY = region.y + region.height - (metrics.dyBase + metrics.drawHeight);

        return {
            x: Math.min(maxOffsetX, Math.max(minOffsetX, offsetX)),
            y: Math.min(maxOffsetY, Math.max(minOffsetY, offsetY))
        };
    }

    /**
     * Slice one axis at the given cut percentages, leaving a divider-width gap at
     * each cut. Returns the bands in order plus the divider positions.
     */
    sliceAxis(total, cuts) {
        const gaps = cuts.length;
        const usable = total - this.dividerWidth * gaps;
        const bands = [];
        const dividers = [];
        let prevPercent = 0;
        let pos = 0;

        cuts.forEach((cut) => {
            const size = Math.round(((cut - prevPercent) / 100) * usable);
            bands.push({ start: pos, size });
            dividers.push(pos + size);
            pos += size + this.dividerWidth;
            prevPercent = cut;
        });
        // The last band takes the remainder, so rounding never leaves a seam.
        bands.push({ start: pos, size: total - pos });

        return { bands, dividers };
    }

    getLayoutRegions(width = this.renderCanvas.width, height = this.renderCanvas.height) {
        const def = LAYOUTS[this.layoutMode];
        const cuts = this.cuts[this.layoutMode];

        // 'two' keeps its own single ratio so the existing slider stays authoritative.
        const vCuts = this.layoutMode === 'two' ? [this.ratio * 100] : cuts.v;
        const cols = this.sliceAxis(width, vCuts);
        const rows = this.sliceAxis(height, cuts.h || []);

        const regions = {};
        def.slots.forEach((side, i) => {
            const col = cols.bands[i % def.cols];
            const row = rows.bands[Math.floor(i / def.cols)];
            regions[side] = { x: col.start, y: row.start, width: col.size, height: row.size };
        });

        // Dividers as rects so a 2x2 can draw both axes.
        const dividers = [
            ...cols.dividers.map((x) => ({ x, y: 0, width: this.dividerWidth, height })),
            ...rows.dividers.map((y) => ({ x: 0, y, width, height: this.dividerWidth }))
        ];

        return { regions, dividers };
    }

    getSideForPoint(x, y) {
        const { regions } = this.getLayoutRegions();
        for (const [side, region] of Object.entries(regions)) {
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) return side;
        }
        // In a divider gap — no slot owns the point.
        return null;
    }

    async export() {
        await this.ensureProfilesLoaded();
        const link = document.createElement('a');
        const timestamp = this.formatTimestamp(new Date());
        const byline = this.sanitizeBylineValue(this.bylineInput.value);
        const exportedAt = new Date();
        const srgbProfile = await this.getSrgbProfileBytes();

        // Repaint with the fixed neutral so a saved collage never carries the
        // page's current theme into the file, then restore the themed preview.
        this.renderComposite({ forExport: true });

        const baseDataUrl = await this.canvasToSrgbDataUrl(this.renderCanvas);
        const finalDataUrl = this.injectMetadata(baseDataUrl, byline, exportedAt, srgbProfile);

        link.download = `TheBanfinator_${timestamp}.jpg`;
        link.href = finalDataUrl;
        link.click();

        this.draw();
    }

    formatTimestamp(date) {
        const pad = (num) => num.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    }

    injectMetadata(dataUrl, byline, exportedAt, srgbProfile) {
        const jpegBytes = this.dataURLToUint8Array(dataUrl);
        const segments = this.splitJpegSegments(jpegBytes);

        const xmpPacket = this.buildXmpPacket(byline, exportedAt);
        const xmpSegment = this.buildApp1Segment(xmpPacket);
        const iptcSegment = this.buildApp13Segment(byline);
        const exifSegment = this.buildExifSegment();
        const iccSegment = this.buildICCProfileSegment(srgbProfile);
        const xmpIdentifier = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
        const exifIdentifier = new TextEncoder().encode('Exif\0\0');

        const filteredSegments = segments.filter((segment) => {
            if (segment[0] === 0xff && segment[1] === 0xe1) {
                const length = (segment[2] << 8) + segment[3];
                const content = segment.slice(4, 4 + length - 2);
                if (this.startsWithArray(content, xmpIdentifier)) return false;
                if (this.startsWithArray(content, exifIdentifier)) return false;
            }

            if (this.isIptcSegment(segment)) return false;
            if (this.isIccSegment(segment)) return false;
            return true;
        });

        const injected = [exifSegment, iccSegment, iptcSegment, xmpSegment].filter(Boolean);
        filteredSegments.splice(1, 0, ...injected);
        const merged = this.mergeSegments(filteredSegments);
        return this.uint8ArrayToDataURL(merged);
    }

    buildXmpPacket(byline, exportedAt) {
        const escaped = this.escapeXml(byline);
        const softwareAgent = this.escapeXml(`The Banfinator ${this.version}`);
        const when = this.escapeXml(exportedAt.toISOString());
        return (
            `<?xpacket begin='\ufeff' id='W5M0MpCehiHzreSzNTczkc9d'?>\n` +
            `<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n` +
            `<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:photoshop='http://ns.adobe.com/photoshop/1.0/' xmlns:xmpMM='http://ns.adobe.com/xap/1.0/mm/' xmlns:stEvt='http://ns.adobe.com/xap/1.0/sType/ResourceEvent#' xmlns:exif='http://ns.adobe.com/exif/1.0/'>\n` +
            `<rdf:Description>\n` +
            `<dc:creator><rdf:Seq><rdf:li>${escaped}</rdf:li></rdf:Seq></dc:creator>\n` +
            `<photoshop:AuthorsPosition>${escaped}</photoshop:AuthorsPosition>\n` +
            `<exif:ColorSpace>1</exif:ColorSpace>\n` +
            `<xmpMM:History><rdf:Seq><rdf:li rdf:parseType='Resource'><stEvt:action>saved</stEvt:action><stEvt:softwareAgent>${softwareAgent}</stEvt:softwareAgent><stEvt:when>${when}</stEvt:when></rdf:li></rdf:Seq></xmpMM:History>\n` +
            `</rdf:Description>\n` +
            `</rdf:RDF>\n` +
            `</x:xmpmeta>\n` +
            `<?xpacket end='w'?>`
        );
    }

    buildApp1Segment(xmpPacket) {
        const encoder = new TextEncoder();
        const identifier = encoder.encode('http://ns.adobe.com/xap/1.0/\0');
        const xmpData = encoder.encode(xmpPacket);
        const contentLength = identifier.length + xmpData.length;
        const totalLength = contentLength + 2; // length bytes count themselves

        const segment = new Uint8Array(4 + contentLength);
        segment[0] = 0xff; segment[1] = 0xe1;
        segment[2] = (totalLength >> 8) & 0xff;
        segment[3] = totalLength & 0xff;
        segment.set(identifier, 4);
        segment.set(xmpData, 4 + identifier.length);
        return segment;
    }

    buildExifSegment() {
        const encoder = new TextEncoder();
        const header = encoder.encode('Exif\0\0');
        const totalLength = 50; // 6 Exif header + 44 byte TIFF payload
        const buffer = new ArrayBuffer(totalLength);
        const view = new DataView(buffer);
        let offset = 0;
        header.forEach((byte) => view.setUint8(offset++, byte));

        // TIFF header (little endian)
        view.setUint8(offset++, 0x49);
        view.setUint8(offset++, 0x49);
        view.setUint16(offset, 42, true); offset += 2;
        view.setUint32(offset, 8, true); offset += 4; // IFD0 offset

        const ifd0Start = offset;
        view.setUint16(offset, 1, true); offset += 2; // entry count

        // ExifIFD pointer (Tag 0x8769)
        view.setUint16(offset, 0x8769, true); offset += 2;
        view.setUint16(offset, 4, true); offset += 2; // type LONG
        view.setUint32(offset, 1, true); offset += 4; // count
        view.setUint32(offset, 0x1a, true); offset += 4; // offset to ExifIFD relative to TIFF start

        view.setUint32(offset, 0, true); offset += 4; // next IFD pointer

        const exifIfdStart = ifd0Start + 2 + 12 + 4; // 0x1a
        view.setUint16(exifIfdStart, 1, true);
        let exifOffset = exifIfdStart + 2;
        view.setUint16(exifOffset, 0xa001, true); exifOffset += 2; // ColorSpace tag
        view.setUint16(exifOffset, 3, true); exifOffset += 2; // SHORT
        view.setUint32(exifOffset, 1, true); exifOffset += 4; // count
        view.setUint16(exifOffset, 1, true); // sRGB
        // value already fits into 2 bytes; upper two bytes remain 0

        view.setUint32(exifIfdStart + 2 + 12, 0, true); // next IFD pointer for ExifIFD

        const contentLength = buffer.byteLength;
        const segment = new Uint8Array(4 + contentLength);
        segment[0] = 0xff; segment[1] = 0xe1;
        const declaredLength = contentLength + 2;
        segment[2] = (declaredLength >> 8) & 0xff;
        segment[3] = declaredLength & 0xff;
        segment.set(new Uint8Array(buffer), 4);
        return segment;
    }

    buildICCProfileSegment(profileBytes) {
        if (!profileBytes) return null;
        const identifier = new TextEncoder().encode('ICC_PROFILE\0');
        const headerLength = identifier.length + 2; // sequence + count
        const contentLength = headerLength + profileBytes.length;
        const segment = new Uint8Array(4 + contentLength);
        segment[0] = 0xff; segment[1] = 0xe2;
        const declaredLength = contentLength + 2;
        segment[2] = (declaredLength >> 8) & 0xff;
        segment[3] = declaredLength & 0xff;
        segment.set(identifier, 4);
        segment[4 + identifier.length] = 1; // sequence number
        segment[5 + identifier.length] = 1; // total sequences
        segment.set(profileBytes, 4 + headerLength);
        return segment;
    }

    async handleFileUpload(file, side, zone) {
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const profile = await this.detectColorProfile(bytes);
            this.colorProfiles[side] = profile || '';
            const srgbBlob = await this.convertBufferToSrgbBlob(bytes, file.type);

            await this.loadImageFromBlob(srgbBlob, side, zone);
            await this.loadBylineFromBytes(bytes, side);
            this.updateSuffixInfo();
        } catch (err) {
            console.error('File processing failed', err);
        }
    }

    async loadImageFromBlob(blob, side, zone) {
        const bitmap = await this.decodeBitmap(blob);
        this.images[side]?.close?.();
        this.images[side] = bitmap;
        this.resetView(side, { silent: true });
        if (zone) {
            zone.classList.add('loaded');
        }
        this.updateButtonState();
        this.updateLabelPills();
        this.draw();
    }

    async loadBylineFromBytes(bytes, side) {
        try {
            const iptc = this.readIptcFields(bytes);
            const xmp = iptc.byline ? null : this.readXmpPacket(bytes);
            const parsedByline = iptc.byline || (xmp ? this.extractBylineFromXmp(xmp) : '');
            const parsedCredit = iptc.credit || (xmp ? this.extractCreditFromXmp(xmp) : '');
            const bylineWithSuffix = this.applyCreditBureauSuffix(parsedByline, parsedCredit);
            this.bylineSources[side] = this.sanitizeBylineValue(bylineWithSuffix || '');
            this.setBureauSuffix(side, this.bylineSources[side], parsedCredit);
            this.updateBylineField();
            this.updateSuffixInfo();
        } catch (err) {
            console.warn('Metadata read skipped', err);
        }
    }

    async loadColorProfiles() {
        const profileMap = {
            sRGB: 'colorprofiles/sRGB2014.icc',
            AdobeRGB: 'colorprofiles/ARGB.icc',
            DCI: 'colorprofiles/DCI.icc'
        };

        const entries = await Promise.all(
            Object.entries(profileMap).map(async ([key, path]) => {
                const response = await fetch(path);
                const buffer = await response.arrayBuffer();
                return [key, new Uint8Array(buffer)];
            })
        );

        this.iccProfiles = Object.fromEntries(entries);
    }

    async ensureProfilesLoaded() {
        if (!this.profilePromise) return;
        try {
            await this.profilePromise;
            this.profilePromise = null;
        } catch (err) {
            console.warn('ICC-profiler kunde inte laddas', err);
            this.iccProfiles = this.iccProfiles || {};
            this.profilePromise = null;
        }
    }

    async getSrgbProfileBytes() {
        await this.ensureProfilesLoaded();
        if (this.iccProfiles?.sRGB) return this.iccProfiles.sRGB;

        try {
            const response = await fetch('colorprofiles/sRGB2014.icc');
            const buffer = await response.arrayBuffer();
            const profile = new Uint8Array(buffer);
            this.iccProfiles = { ...(this.iccProfiles || {}), sRGB: profile };
            return profile;
        } catch (err) {
            console.warn('sRGB profile unavailable', err);
            return null;
        }
    }

    async convertBufferToSrgbBlob(bytes, mimeType = 'image/jpeg') {
        await this.ensureProfilesLoaded();
        const blob = new Blob([bytes], { type: mimeType });
        try {
            const bitmap = await this.decodeToSrgbBitmap(blob, mimeType);
            const canvas = typeof OffscreenCanvas !== 'undefined'
                ? new OffscreenCanvas(bitmap.width, bitmap.height)
                : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });

            if (!canvas.width || !canvas.height) {
                return blob;
            }

            const ctx = canvas.getContext('2d', { colorSpace: 'srgb' }) || canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);

            const outputBlob = canvas.convertToBlob
                ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 1, colorSpace: 'srgb' })
                : await new Promise((resolve, reject) => {
                    canvas.toBlob((result) => {
                        if (result) resolve(result);
                        else reject(new Error('Canvas toBlob failed'));
                    }, 'image/jpeg', 1);
                });

            return outputBlob;
        } catch (err) {
            console.warn('Color-managed decode failed, falling back to original data', err);
            return blob;
        }
    }

    async decodeToSrgbBitmap(blob, mimeType) {
        if (typeof ImageDecoder !== 'undefined') {
            try {
                const decoder = new ImageDecoder({ data: blob, type: mimeType, colorSpaceConversion: 'none' });
                const { image } = await decoder.decode({ completeFramesOnly: true });
                return image;
            } catch (err) {
                console.warn('ImageDecoder fallback to createImageBitmap', err);
            }
        }

        return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    }

    async decodeBitmap(blob) {
        try {
            return await this.decodeToSrgbBitmap(blob, blob.type || 'image/jpeg');
        } catch (err) {
            console.warn('Bitmap decode failed', err);
            throw err;
        }
    }

    async canvasToSrgbDataUrl(sourceCanvas = this.renderCanvas) {
        if (sourceCanvas.convertToBlob) {
            try {
                const blob = await sourceCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.95, colorSpace: 'srgb' });
                return await this.blobToDataUrl(blob);
            } catch (err) {
                console.warn('convertToBlob with color space failed, falling back to toDataURL', err);
            }
        }

        if (typeof sourceCanvas.toDataURL === 'function') {
            return sourceCanvas.toDataURL('image/jpeg', 0.95);
        }

        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = sourceCanvas.width;
        fallbackCanvas.height = sourceCanvas.height;
        const fallbackCtx = fallbackCanvas.getContext('2d', { colorSpace: 'srgb' }) || fallbackCanvas.getContext('2d');
        fallbackCtx.drawImage(sourceCanvas, 0, 0);
        return fallbackCanvas.toDataURL('image/jpeg', 0.95);
    }

    async blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async detectColorProfile(bytes) {
        await this.ensureProfilesLoaded();
        const embedded = this.extractIccProfile(bytes);
        if (!embedded) return 'Unknown';
        if (this.iccProfiles?.sRGB && this.buffersEqual(embedded, this.iccProfiles.sRGB)) return 'sRGB 2014';
        if (this.iccProfiles?.AdobeRGB && this.buffersEqual(embedded, this.iccProfiles.AdobeRGB)) return 'Adobe RGB 1998';
        if (this.iccProfiles?.DCI && this.buffersEqual(embedded, this.iccProfiles.DCI)) return 'DCI-P3';
        return 'Embedded ICC';
    }

    extractIccProfile(bytes) {
        const iccSegments = [];
        let offset = 2;
        while (offset + 4 < bytes.length) {
            if (bytes[offset] !== 0xff) break;
            const marker = bytes[offset + 1];
            if (marker === 0xda) break;
            const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
            const start = offset + 4;
            const end = offset + 2 + length;
            if (marker === 0xe2) {
                const header = new TextEncoder().encode('ICC_PROFILE\0');
                if (this.startsWithArray(bytes.slice(start, start + header.length), header)) {
                    const sequenceNumber = bytes[start + header.length];
                    const totalSegments = bytes[start + header.length + 1];
                    const payload = bytes.slice(start + header.length + 2, end);
                    iccSegments.push({ sequenceNumber, totalSegments, payload });
                }
            }
            offset = end;
        }

        if (!iccSegments.length) return null;
        const total = iccSegments[0].totalSegments || 1;
        const ordered = iccSegments
            .filter((seg) => seg.sequenceNumber <= total)
            .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        const totalLength = ordered.reduce((sum, seg) => sum + seg.payload.length, 0);
        const merged = new Uint8Array(totalLength);
        let writeOffset = 0;
        ordered.forEach((seg) => {
            merged.set(seg.payload, writeOffset);
            writeOffset += seg.payload.length;
        });
        return merged;
    }

    readXmpPacket(bytes) {
        let segments;
        try {
            segments = this.splitJpegSegments(bytes);
        } catch (err) {
            return null;
        }

        const identifier = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
        for (const segment of segments) {
            if (segment[0] !== 0xff || segment[1] !== 0xe1) continue;
            const length = (segment[2] << 8) + segment[3];
            const content = segment.slice(4, 4 + length - 2);
            if (!this.startsWithArray(content, identifier)) continue;
            const payload = content.slice(identifier.length);
            return new TextDecoder().decode(payload);
        }
        return null;
    }

    readIptcFields(bytes) {
        let segments;
        try {
            segments = this.splitJpegSegments(bytes);
        } catch (err) {
            return { byline: '', credit: '' };
        }

        const result = { byline: '', credit: '' };

        for (const segment of segments) {
            if (!this.isIptcSegment(segment)) continue;
            const length = (segment[2] << 8) + segment[3];
            const content = segment.slice(4, 4 + length - 2);
            const photoshopHeader = new TextEncoder().encode('Photoshop 3.0\0');
            let offset = photoshopHeader.length;

            while (offset + 8 <= content.length) {
                if (!this.startsWithArray(content.slice(offset, offset + 4), new TextEncoder().encode('8BIM'))) break;
                const resourceId = (content[offset + 4] << 8) + content[offset + 5];
                const nameLength = content[offset + 6];
                offset += 7 + nameLength;
                if ((nameLength + 1) % 2 === 1) offset += 1;
                if (offset + 4 > content.length) break;

                const dataSize = (content[offset] << 24) + (content[offset + 1] << 16) + (content[offset + 2] << 8) + content[offset + 3];
                offset += 4;
                if (offset + dataSize > content.length) break;
                if (resourceId === 0x0404) {
                    const iptc = content.slice(offset, offset + dataSize);
                    const parsed = this.extractIptcFieldsFromBlock(iptc);
                    result.byline = result.byline || parsed.byline;
                    result.credit = result.credit || parsed.credit;
                    if (result.byline && result.credit) return result;
                }
                offset += dataSize;
                if (dataSize % 2 === 1) offset += 1;
            }
        }
        return result;
    }

    extractIptcFieldsFromBlock(iptc) {
        const parsed = { byline: '', credit: '' };
        let offset = 0;
        while (offset + 5 <= iptc.length) {
            if (iptc[offset] !== 0x1c) break;
            const record = iptc[offset + 1];
            const dataset = iptc[offset + 2];
            const length = (iptc[offset + 3] << 8) + iptc[offset + 4];
            offset += 5;
            if (offset + length > iptc.length) break;
            if (record === 0x02) {
                const valueBytes = iptc.slice(offset, offset + length);
                const decoded = new TextDecoder('utf-8', { fatal: false }).decode(valueBytes).trim();
                if (dataset === 0x50 && !parsed.byline) parsed.byline = decoded;
                if (dataset === 0x6e && !parsed.credit) parsed.credit = decoded;
            }
            offset += length;
        }
        return parsed;
    }

    extractBylineFromXmp(xmp) {
        const bylineMatch = xmp.match(/<photoshop:AuthorsPosition[^>]*>([^<]*)<\/photoshop:AuthorsPosition>/i);
        const creatorMatch = xmp.match(/<dc:creator[^>]*>\s*<rdf:Seq>\s*<rdf:li[^>]*>([^<]*)<\/rdf:li>/i);
        const descriptionMatch = xmp.match(/<dc:description[^>]*>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]*)<\/rdf:li>/i);
        const raw = bylineMatch?.[1] || creatorMatch?.[1] || descriptionMatch?.[1] || '';
        return this.unescapeXml(raw.trim());
    }

    extractCreditFromXmp(xmp) {
        const creditMatch = xmp.match(/<photoshop:Credit[^>]*>([^<]*)<\/photoshop:Credit>/i);
        return this.unescapeXml((creditMatch?.[1] || '').trim());
    }

    updateBylineField() {
        const combined = this.buildCombinedByline();
        const cleanCurrent = this.sanitizeBylineValue(this.bylineInput.value);
        if (!this.bylineDirty || cleanCurrent === '') {
            this.bylineInput.value = combined;
        }
    }

    setZoom(side, value) {
        const clamped = Math.min(3, Math.max(1, value));
        this.transforms[side].scale = clamped;
        this.setTransformOffset(side, this.transforms[side].offsetX, this.transforms[side].offsetY);
        if (this.zoomInputs[side]) {
            this.zoomInputs[side].value = clamped;
        }
        this.draw();
    }

    resetView(side, { silent = false } = {}) {
        this.transforms[side] = { scale: 1, offsetX: 0, offsetY: 0 };
        if (this.zoomInputs[side]) {
            this.zoomInputs[side].value = 1;
        }
        if (!silent) {
            this.draw();
        }
    }

    startDrag(event) {
        if (!this.getActiveSides().some((side) => this.images[side])) return;
        const point = this.getCanvasPoint(event);
        const side = this.getSideForPoint(point.x, point.y);
        if (!side || !this.images[side]) return;

        this.dragState = {
            pointerId: event.pointerId,
            side,
            startX: point.x,
            startY: point.y,
            originX: this.transforms[side].offsetX,
            originY: this.transforms[side].offsetY
        };

        this.previewCanvas.setPointerCapture(event.pointerId);
    }

    handleDrag(event) {
        if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
        const point = this.getCanvasPoint(event);
        const dx = point.x - this.dragState.startX;
        const dy = point.y - this.dragState.startY;
        const side = this.dragState.side;

        this.setTransformOffset(side, this.dragState.originX + dx, this.dragState.originY + dy);
        this.draw();
    }

    stopDrag(event) {
        if (!this.dragState) return;
        if (event && event.pointerId !== this.dragState.pointerId) return;
        this.previewCanvas.releasePointerCapture(this.dragState.pointerId);
        this.dragState = null;
    }

    handleWheel(event) {
        if (!this.getActiveSides().some((side) => this.images[side])) return;
        event.preventDefault();

        const point = this.getCanvasPoint(event);
        const side = this.getSideForPoint(point.x, point.y);
        if (!side || !this.images[side]) return;

        const delta = -event.deltaY * 0.0015;
        this.zoomAtPoint(side, delta, point);
    }

    getCanvasPoint(event) {
        const rect = this.previewCanvas.getBoundingClientRect();
        const scaleX = this.previewCanvas.width / rect.width;
        const scaleY = this.previewCanvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    setTransformOffset(side, offsetX, offsetY) {
        const img = this.images[side];
        if (!img) return;
        const region = this.getRegionForSide(side);
        const metrics = this.computeBaseMetrics(img, region, side);
        const clamped = this.clampOffsetsForRegion(offsetX, offsetY, metrics, region);
        this.transforms[side].offsetX = clamped.x;
        this.transforms[side].offsetY = clamped.y;
    }

    getRegionForSide(side) {
        const { regions } = this.getLayoutRegions();
        return regions[side];
    }

    zoomAtPoint(side, delta, point) {
        const img = this.images[side];
        if (!img) return;

        const currentScale = this.transforms[side].scale;
        const targetScale = Math.min(3, Math.max(1, currentScale * (1 + delta)));
        if (targetScale === currentScale) return;

        const region = this.getRegionForSide(side);
        const currentMetrics = this.computeBaseMetrics(img, region, side, currentScale);
        const newMetrics = this.computeBaseMetrics(img, region, side, targetScale);

        const imageX = (point.x - (currentMetrics.dxBase + this.transforms[side].offsetX)) / currentMetrics.scale;
        const imageY = (point.y - (currentMetrics.dyBase + this.transforms[side].offsetY)) / currentMetrics.scale;

        const newOffsetX = point.x - (imageX * newMetrics.scale) - newMetrics.dxBase;
        const newOffsetY = point.y - (imageY * newMetrics.scale) - newMetrics.dyBase;

        this.transforms[side].scale = targetScale;
        this.setTransformOffset(side, newOffsetX, newOffsetY);
        if (this.zoomInputs[side]) {
            this.zoomInputs[side].value = targetScale;
        }
        this.draw();
    }

    buildCombinedByline() {
        const sides = this.getActiveSides();
        const bylines = sides.map((side) => this.bylineSources[side]);
        if (this.shouldMergeSuffixes()) {
            const suffix = this.bureauSuffixes[sides[0]];
            const stripped = bylines.map((entry) => this.stripMatchingSuffix(entry, suffix));
            const merged = this.mergeBylines(stripped);
            return merged ? `${merged}/${suffix}` : suffix;
        }

        return this.mergeBylines(bylines);
    }

    stripMatchingSuffix(entry, suffix) {
        if (!entry) return '';
        if (!suffix) return this.sanitizeBylineValue(entry);
        const pattern = new RegExp(`\s*\/\s*${suffix}\s*$`, 'i');
        return this.sanitizeBylineValue(entry.replace(pattern, ''));
    }

    shouldMergeSuffixes() {
        const sides = this.getActiveSides();
        const suffixes = sides.map((side) => this.bureauSuffixes[side]).filter(Boolean);
        if (suffixes.length < sides.length) return false;
        return suffixes.every((suffix) => suffix.toUpperCase() === suffixes[0].toUpperCase());
    }

    mergeBylines(bylines) {
        const list = Array.isArray(bylines) ? bylines : [bylines];
        const entries = list
            .map((item) => this.normalizeBureauSpacing(this.sanitizeBylineValue(item)))
            .filter(Boolean);
        if (!entries.length) return '';
        const unique = [];
        entries.forEach((entry) => {
            if (!unique.includes(entry)) unique.push(entry);
        });
        return this.sanitizeBylineValue(unique.join('/'));
    }

    applyCreditBureauSuffix(byline, credit) {
        const sanitized = this.sanitizeBylineValue(byline);
        const existingBureau = this.extractBureauSuffix(sanitized);
        const creditBureau = this.extractCreditBureau(credit);
        if (existingBureau || !creditBureau) return sanitized;
        return sanitized ? `${sanitized}/${creditBureau}` : creditBureau;
    }

    sanitizeBylineValue(value) {
        const trimmed = (value || '').trim();
        if (!trimmed) return '';
        const compactedSlashes = trimmed.replace(/\s*\/\s*/g, '/');
        const collapsedSpaces = compactedSlashes.replace(/\s{2,}/g, ' ');
        return collapsedSpaces.trim();
    }

    normalizeBureauSpacing(value) {
        if (!value) return '';
        return value.replace(/\s*\/(TT|AFP|NTB|AP)\b/gi, '/$1');
    }

    collapseDuplicateBureaus(entries) {
        if (entries.length < 2) return entries;
        const leftMatch = entries[0].match(this.bureauRegex);
        const rightMatch = entries[1].match(this.bureauRegex);

        if (leftMatch && rightMatch && leftMatch[1].toUpperCase() === rightMatch[1].toUpperCase()) {
            const bureau = rightMatch[1].toUpperCase();
            entries = [...entries];
            entries[0] = entries[0].replace(this.bureauRegex, '');
            entries[1] = entries[1].replace(this.bureauRegex, `/${bureau}`);
        }

        return entries;
    }

    extractBureauSuffix(byline) {
        if (!byline) return '';
        const match = this.normalizeBureauSpacing(this.sanitizeBylineValue(byline)).match(this.bureauRegex);
        return match ? match[1].toUpperCase() : '';
    }

    extractCreditBureau(credit) {
        if (!credit) return '';
        const match = credit.match(/\b(AP|AFP|NTB)\b/i);
        return match ? match[1].toUpperCase() : '';
    }

    setBureauSuffix(side, byline, credit = '') {
        const bylineSuffix = this.extractBureauSuffix(byline);
        const creditSuffix = this.extractCreditBureau(credit);
        this.bureauSuffixes[side] = bylineSuffix || creditSuffix || '';
        this.updateSuffixInfo();
    }

    updateSuffixInfo() {
        if (!this.suffixInfoBox) return;
        if (!this.shouldMergeSuffixes()) {
            this.suffixInfoBox.hidden = true;
            return;
        }

        const activeSides = this.getActiveSides();
        const suffix = this.bureauSuffixes[activeSides[0]];
        const subject = activeSides.length === 2
            ? 'Båda bilderna'
            : `Alla ${{ 3: 'tre', 4: 'fyra' }[activeSides.length] || activeSides.length} bilder`;
        this.suffixInfoBox.textContent = `${subject} är ${suffix} – suffix slås ihop automatiskt.`;
        this.suffixInfoBox.hidden = false;
    }

    splitJpegSegments(bytes) {
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
            throw new Error('Invalid JPEG data');
        }

        const segments = [bytes.slice(0, 2)];
        let offset = 2;

        while (offset < bytes.length) {
            if (bytes[offset] !== 0xff) break;
            const marker = bytes[offset + 1];
            if (marker === 0xda) { // SOS
                segments.push(bytes.slice(offset));
                break;
            }

            const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
            const end = offset + 2 + length;
            segments.push(bytes.slice(offset, end));
            offset = end;
        }

        return segments;
    }

    mergeSegments(segments) {
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        segments.forEach((seg) => {
            merged.set(seg, offset);
            offset += seg.length;
        });
        return merged;
    }

    dataURLToUint8Array(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    uint8ArrayToDataURL(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return `data:image/jpeg;base64,${base64}`;
    }

    startsWithArray(buffer, prefix) {
        if (buffer.length < prefix.length) return false;
        for (let i = 0; i < prefix.length; i++) {
            if (buffer[i] !== prefix[i]) return false;
        }
        return true;
    }

    buffersEqual(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    buildApp13Segment(byline) {
        if (!byline) return null;
        const encoder = new TextEncoder();
        const photoshopHeader = encoder.encode('Photoshop 3.0\0');
        const signature = encoder.encode('8BIM');
        const resourceId = new Uint8Array([0x04, 0x04]);
        const nameBlock = new Uint8Array(2); // empty name, padded to even

        const iptcData = this.buildIptcData(byline);
        const dataSize = new Uint8Array(4);
        dataSize[0] = (iptcData.length >> 24) & 0xff;
        dataSize[1] = (iptcData.length >> 16) & 0xff;
        dataSize[2] = (iptcData.length >> 8) & 0xff;
        dataSize[3] = iptcData.length & 0xff;

        const dataPad = iptcData.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array(0);
        const content = this.concatUint8Arrays(photoshopHeader, signature, resourceId, nameBlock, dataSize, iptcData, dataPad);

        const totalLength = content.length + 2;
        const segment = new Uint8Array(4 + content.length);
        segment[0] = 0xff; segment[1] = 0xed;
        segment[2] = (totalLength >> 8) & 0xff;
        segment[3] = totalLength & 0xff;
        segment.set(content, 4);

        return segment;
    }

    buildIptcData(byline) {
        const encoder = new TextEncoder();
        const valueBytes = encoder.encode(byline);
        const block = new Uint8Array(5 + valueBytes.length);
        block[0] = 0x1c; // IPTC marker
        block[1] = 0x02; // Application record
        block[2] = 0x50; // By-line dataset
        block[3] = (valueBytes.length >> 8) & 0xff;
        block[4] = valueBytes.length & 0xff;
        block.set(valueBytes, 5);
        return block;
    }

    isIptcSegment(segment) {
        if (segment[0] !== 0xff || segment[1] !== 0xed) return false;
        const length = (segment[2] << 8) + segment[3];
        const content = segment.slice(4, 4 + length - 2);
        const photoshopHeader = new TextEncoder().encode('Photoshop 3.0\0');
        if (!this.startsWithArray(content, photoshopHeader)) return false;

        let offset = photoshopHeader.length;
        const signature = new TextEncoder().encode('8BIM');
        while (offset + 8 <= content.length) {
            if (!this.startsWithArray(content.slice(offset, offset + 4), signature)) break;
            const resourceId = (content[offset + 4] << 8) + content[offset + 5];
            const nameLength = content[offset + 6];
            offset += 7 + nameLength;
            if ((nameLength + 1) % 2 === 1) offset += 1;
            if (offset + 4 > content.length) break;

            const dataSize = (content[offset] << 24) + (content[offset + 1] << 16) + (content[offset + 2] << 8) + content[offset + 3];
            offset += 4 + dataSize;
            if (dataSize % 2 === 1) offset += 1;

            if (resourceId === 0x0404) return true;
        }
        return false;
    }

    isIccSegment(segment) {
        if (segment[0] !== 0xff || segment[1] !== 0xe2) return false;
        const length = (segment[2] << 8) + segment[3];
        const content = segment.slice(4, 4 + length - 2);
        const identifier = new TextEncoder().encode('ICC_PROFILE\0');
        return this.startsWithArray(content, identifier);
    }

    concatUint8Arrays(...arrays) {
        const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        arrays.forEach((arr) => {
            merged.set(arr, offset);
            offset += arr.length;
        });
        return merged;
    }

    escapeXml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    unescapeXml(value) {
        return value
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Banfinator();
});
