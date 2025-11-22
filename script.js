class Banfinator {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.splitSlider = document.getElementById('splitSlider');
        this.splitReadout = document.getElementById('splitReadout');
        this.exportBtn = document.getElementById('exportBtn');
        this.bylineInput = document.getElementById('bylineInput');
        this.swapBtn = document.getElementById('swapSides');
        this.leftInput = document.getElementById('leftFileInput');
        this.rightInput = document.getElementById('rightFileInput');
        this.zoomInputs = {
            left: document.getElementById('leftZoom'),
            right: document.getElementById('rightZoom')
        };
        this.resetButtons = {
            left: document.querySelector('[data-reset="left"]'),
            right: document.querySelector('[data-reset="right"]')
        };
        this.images = { left: null, right: null };
        this.transforms = {
            left: { scale: 1, offsetX: 0, offsetY: 0 },
            right: { scale: 1, offsetX: 0, offsetY: 0 }
        };
        this.bylineSources = { left: '', right: '' };
        this.bylineDirty = false;
        this.dragState = null;
        this.ratio = 0.5;
        this.dividerWidth = 10;
        this.canvas.width = 3840;
        this.canvas.height = 2160;
        this.bindEvents();
        this.updateReadout();
        this.updateButtonState();
        this.clearCaches();
        this.draw();
    }

    bindEvents() {
        this.splitSlider.addEventListener('input', (e) => {
            this.ratio = e.target.value / 100;
            this.updateReadout();
            this.draw();
        });

        this.exportBtn.addEventListener('click', () => this.export());
        this.swapBtn.addEventListener('click', () => this.swapSides());

        this.setupDropZone(document.querySelector('[data-side="left"]'), this.leftInput, 'left');
        this.setupDropZone(document.querySelector('[data-side="right"]'), this.rightInput, 'right');

        this.bylineInput.addEventListener('input', () => {
            this.bylineDirty = true;
            this.draw();
        });

        Object.entries(this.zoomInputs).forEach(([side, input]) => {
            input.addEventListener('input', (e) => {
                this.setZoom(side, parseFloat(e.target.value));
            });
        });

        Object.entries(this.resetButtons).forEach(([side, btn]) => {
            btn.addEventListener('click', () => this.resetView(side));
        });

        this.canvas.addEventListener('pointerdown', (e) => this.startDrag(e));
        this.canvas.addEventListener('pointermove', (e) => this.handleDrag(e));
        this.canvas.addEventListener('pointerup', (e) => this.stopDrag(e));
        this.canvas.addEventListener('pointerleave', (e) => this.stopDrag(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
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

    setupDropZone(zone, input, side) {
        const handleFiles = (files) => {
            const file = files?.[0];
            if (!file) return;

            this.loadImage(file, side, zone);
            this.loadBylineFromFile(file, side);
        };

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

    updateReadout() {
        const leftPercent = Math.round(this.ratio * 100);
        const rightPercent = 100 - leftPercent;
        this.splitReadout.textContent = `${leftPercent}% | ${rightPercent}%`;
    }

    updateButtonState() {
        this.exportBtn.disabled = !(this.images.left && this.images.right);
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.fillStyle = '#0c0e12';
        this.ctx.fillRect(0, 0, width, height);

        const dividerX = Math.round(this.ratio * (width - this.dividerWidth));
        const leftRegion = { x: 0, width: dividerX };
        const rightRegion = { x: dividerX + this.dividerWidth, width: width - dividerX - this.dividerWidth };

        this.drawImageToRegion(this.images.left, leftRegion, height, 'left');
        this.drawImageToRegion(this.images.right, rightRegion, height, 'right');

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(dividerX, 0, this.dividerWidth, height);

    }

    drawImageToRegion(img, region, canvasHeight, side) {
        if (!img) return;
        const metrics = this.computeBaseMetrics(img, region, canvasHeight, side);
        if (!metrics) return;
        const offsets = this.clampOffsetsForRegion(this.transforms[side].offsetX, this.transforms[side].offsetY, metrics, region, canvasHeight);
        this.transforms[side].offsetX = offsets.x;
        this.transforms[side].offsetY = offsets.y;
        const dx = metrics.dxBase + offsets.x;
        const dy = metrics.dyBase + offsets.y;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(region.x, 0, region.width, canvasHeight);
        this.ctx.clip();
        this.ctx.drawImage(img, dx, dy, metrics.drawWidth, metrics.drawHeight);
        this.ctx.restore();
    }

    computeBaseMetrics(img, region, canvasHeight, side, scaleOverride = null) {
        const baseScale = Math.max(region.width / img.width, canvasHeight / img.height);
        const scale = baseScale * (scaleOverride ?? this.transforms[side].scale);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dxBase = region.x + (region.width - drawWidth) / 2;
        const dyBase = (canvasHeight - drawHeight) / 2;

        return { drawWidth, drawHeight, dxBase, dyBase, scale };
    }

    clampOffsetsForRegion(offsetX, offsetY, metrics, region, canvasHeight) {
        const maxOffsetX = region.x - metrics.dxBase;
        const minOffsetX = region.x + region.width - (metrics.dxBase + metrics.drawWidth);
        const maxOffsetY = 0 - metrics.dyBase;
        const minOffsetY = canvasHeight - (metrics.dyBase + metrics.drawHeight);

        return {
            x: Math.min(maxOffsetX, Math.max(minOffsetX, offsetX)),
            y: Math.min(maxOffsetY, Math.max(minOffsetY, offsetY))
        };
    }

    export() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const byline = this.bylineInput.value.trim();

        const baseDataUrl = this.canvas.toDataURL('image/jpeg', 0.95);
        const finalDataUrl = byline ? this.injectXmpByline(baseDataUrl, byline) : baseDataUrl;

        link.download = `banfinator_${timestamp}.jpg`;
        link.href = finalDataUrl;
        link.click();
    }

    injectXmpByline(dataUrl, byline) {
        const jpegBytes = this.dataURLToUint8Array(dataUrl);
        const segments = this.splitJpegSegments(jpegBytes);

        const xmpPacket = this.buildXmpPacket(byline);
        const xmpSegment = this.buildApp1Segment(xmpPacket);
        const xmpIdentifier = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');

        const filteredSegments = segments.filter((segment) => {
            if (segment[0] !== 0xff || segment[1] !== 0xe1) return true;
            const length = (segment[2] << 8) + segment[3];
            const content = segment.slice(4, 4 + length - 2);
            return !this.startsWithArray(content, xmpIdentifier);
        });

        filteredSegments.splice(1, 0, xmpSegment);
        const merged = this.mergeSegments(filteredSegments);
        return this.uint8ArrayToDataURL(merged);
    }

    buildXmpPacket(byline) {
        const escaped = this.escapeXml(byline);
        return (
            `<?xpacket begin='\ufeff' id='W5M0MpCehiHzreSzNTczkc9d'?>\n` +
            `<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n` +
            `<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n` +
            `<rdf:Description xmlns:dc='http://purl.org/dc/elements/1.1/'>\n` +
            `<dc:creator><rdf:Seq><rdf:li>${escaped}</rdf:li></rdf:Seq></dc:creator>\n` +
            `<dc:description><rdf:Alt><rdf:li xml:lang='x-default'>${escaped}</rdf:li></rdf:Alt></dc:description>\n` +
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

    loadImage(file, side, zone) {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                this.images[side] = img;
                this.resetView(side, { silent: true });
                zone.classList.add('loaded');
                this.updateButtonState();
                this.draw();
            };
            img.src = `${reader.result}#${Date.now()}`; // ensure cache busting per load
        };
        reader.readAsDataURL(file);
    }

    async loadBylineFromFile(file, side) {
        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const xmp = this.readXmpPacket(bytes);
            const parsed = xmp ? this.extractByline(xmp) : '';
            this.bylineSources[side] = parsed || '';
            this.updateBylineField();
        } catch (err) {
            console.warn('Metadata read skipped', err);
        }
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

    extractByline(xmp) {
        const creatorMatch = xmp.match(/<dc:creator[^>]*>\s*<rdf:Seq>\s*<rdf:li[^>]*>([^<]*)<\/rdf:li>/i);
        const descriptionMatch = xmp.match(/<dc:description[^>]*>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]*)<\/rdf:li>/i);
        const raw = creatorMatch?.[1] || descriptionMatch?.[1] || '';
        return this.unescapeXml(raw.trim());
    }

    updateBylineField() {
        const combined = this.mergeBylines(this.bylineSources.left, this.bylineSources.right);
        if (!this.bylineDirty || this.bylineInput.value.trim() === '') {
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
        if (!this.images.left && !this.images.right) return;
        const point = this.getCanvasPoint(event);
        const dividerX = Math.round(this.ratio * (this.canvas.width - this.dividerWidth));
        const side = point.x < dividerX ? 'left' : (point.x > dividerX + this.dividerWidth ? 'right' : null);
        if (!side || !this.images[side]) return;

        this.dragState = {
            pointerId: event.pointerId,
            side,
            startX: point.x,
            startY: point.y,
            originX: this.transforms[side].offsetX,
            originY: this.transforms[side].offsetY
        };

        this.canvas.setPointerCapture(event.pointerId);
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
        this.canvas.releasePointerCapture(this.dragState.pointerId);
        this.dragState = null;
    }

    handleWheel(event) {
        if (!this.images.left && !this.images.right) return;
        event.preventDefault();

        const point = this.getCanvasPoint(event);
        const dividerX = Math.round(this.ratio * (this.canvas.width - this.dividerWidth));
        const side = point.x < dividerX ? 'left' : (point.x > dividerX + this.dividerWidth ? 'right' : null);
        if (!side || !this.images[side]) return;

        const delta = -event.deltaY * 0.0015;
        this.zoomAtPoint(side, delta, point);
    }

    getCanvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    setTransformOffset(side, offsetX, offsetY) {
        const img = this.images[side];
        if (!img) return;
        const region = this.getRegionForSide(side);
        const metrics = this.computeBaseMetrics(img, region, this.canvas.height, side);
        const clamped = this.clampOffsetsForRegion(offsetX, offsetY, metrics, region, this.canvas.height);
        this.transforms[side].offsetX = clamped.x;
        this.transforms[side].offsetY = clamped.y;
    }

    getRegionForSide(side) {
        const width = this.canvas.width;
        const dividerX = Math.round(this.ratio * (width - this.dividerWidth));
        if (side === 'left') {
            return { x: 0, width: dividerX };
        }
        return { x: dividerX + this.dividerWidth, width: width - dividerX - this.dividerWidth };
    }

    zoomAtPoint(side, delta, point) {
        const img = this.images[side];
        if (!img) return;

        const currentScale = this.transforms[side].scale;
        const targetScale = Math.min(3, Math.max(1, currentScale * (1 + delta)));
        if (targetScale === currentScale) return;

        const region = this.getRegionForSide(side);
        const currentMetrics = this.computeBaseMetrics(img, region, this.canvas.height, side, currentScale);
        const newMetrics = this.computeBaseMetrics(img, region, this.canvas.height, side, targetScale);

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

    mergeBylines(left, right) {
        const normalizedLeft = this.normalizeBureauSpacing((left || '').trim());
        const normalizedRight = this.normalizeBureauSpacing((right || '').trim());
        const entries = [normalizedLeft, normalizedRight].filter(Boolean);
        if (!entries.length) return '';

        const collapsed = this.collapseDuplicateBureaus(entries);
        return collapsed.join('/');
    }

    normalizeBureauSpacing(value) {
        return value.replace(/\/\s*(TT|AFP|NTB|AP)\b/gi, '/$1');
    }

    collapseDuplicateBureaus(entries) {
        if (entries.length < 2) return entries;
        const bureauRegex = /\/(TT|AFP|NTB|AP)\s*$/i;
        const leftMatch = entries[0].match(bureauRegex);
        const rightMatch = entries[1].match(bureauRegex);

        if (leftMatch && rightMatch && leftMatch[1].toUpperCase() === rightMatch[1].toUpperCase()) {
            const bureau = rightMatch[1].toUpperCase();
            entries = [...entries];
            entries[0] = entries[0].replace(bureauRegex, '');
            entries[1] = entries[1].replace(bureauRegex, `/${bureau}`);
        }

        return entries;
    }

    swapSides() {
        [this.images.left, this.images.right] = [this.images.right, this.images.left];
        [this.bylineSources.left, this.bylineSources.right] = [this.bylineSources.right, this.bylineSources.left];
        [this.transforms.left, this.transforms.right] = [this.transforms.right, this.transforms.left];

        this.setZoom('left', this.transforms.left.scale);
        this.setZoom('right', this.transforms.right.scale);
        this.updateBylineField();
        this.draw();
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
