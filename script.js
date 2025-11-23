class Banfinator {
    constructor() {
        this.previewCanvas = document.getElementById('imageCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d', { colorSpace: 'srgb' }) || this.previewCanvas.getContext('2d');
        this.renderCanvas = this.createRenderSurface();
        this.renderCtx = this.renderCanvas.getContext('2d', { colorSpace: 'srgb' }) || this.renderCanvas.getContext('2d');
        this.version = '2.5.2';
        this.splitSlider = document.getElementById('splitSlider');
        this.splitReadout = document.getElementById('splitReadout');
        this.exportBtn = document.getElementById('exportBtn');
        this.bylineInput = document.getElementById('bylineInput');
        this.suffixInfoBox = document.getElementById('suffixInfo');
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
        this.bureauRegex = /\/(TT|AFP|NTB|AP)\s*$/i;
        this.bureauSuffixes = { left: '', right: '' };
        this.transforms = {
            left: { scale: 1, offsetX: 0, offsetY: 0 },
            right: { scale: 1, offsetX: 0, offsetY: 0 }
        };
        this.bylineSources = { left: '', right: '' };
        this.colorProfiles = { left: '', right: '' };
        this.bylineDirty = false;
        this.dragState = null;
        this.ratio = 0.5;
        this.dividerWidth = 10;
        this.renderCanvas.width = 3840;
        this.renderCanvas.height = 2160;
        this.previewCanvas.width = 3840;
        this.previewCanvas.height = 2160;
        this.profilePromise = this.loadColorProfiles();
        this.bindEvents();
        this.resetMetadataInputs();
        this.updateReadout();
        this.updateButtonState();
        this.clearCaches();
        this.draw();
    }

    createRenderSurface() {
        return typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(3840, 2160)
            : Object.assign(document.createElement('canvas'), { width: 3840, height: 2160 });
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
        this.setupCanvasDropTarget();

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
        this.bylineSources = { left: '', right: '' };
        this.bureauSuffixes = { left: '', right: '' };
        this.updateSuffixInfo();
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
            const dividerX = Math.round(this.ratio * (this.renderCanvas.width - this.dividerWidth));
            if (point.x < dividerX) return 'left';
            if (point.x > dividerX + this.dividerWidth) return 'right';
            return null;
        };

        const clearState = () => {
            this.previewCanvas.classList.remove('dragover-left', 'dragover-right');
            frame?.classList.remove('dragover', 'dragover-left', 'dragover-right');
        };

        this.previewCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            const side = getSideFromEvent(e);
            this.previewCanvas.classList.remove('dragover-left', 'dragover-right');
            frame?.classList.remove('dragover-left', 'dragover-right');
            frame?.classList.add('dragover');
            if (side) {
                this.previewCanvas.classList.add(`dragover-${side}`);
                frame?.classList.add(`dragover-${side}`);
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
        const leftPercent = Math.round(this.ratio * 100);
        const rightPercent = 100 - leftPercent;
        if (this.splitReadout) {
            this.splitReadout.textContent = `${leftPercent}% | ${rightPercent}%`;
        }
    }

    updateButtonState() {
        this.exportBtn.disabled = !(this.images.left && this.images.right);
    }

    draw() {
        this.renderComposite();
        this.presentPreview();
    }

    renderComposite() {
        if (!this.renderCtx) return;
        this.paintComposite(this.renderCtx, this.renderCanvas.width, this.renderCanvas.height);
    }

    presentPreview() {
        if (!this.previewCtx || !this.renderCanvas) return;
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(
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
    }

    paintComposite(ctx, width, height) {
        ctx.fillStyle = '#0c0e12';
        ctx.fillRect(0, 0, width, height);

        const dividerX = Math.round(this.ratio * (width - this.dividerWidth));
        const leftRegion = { x: 0, width: dividerX };
        const rightRegion = { x: dividerX + this.dividerWidth, width: width - dividerX - this.dividerWidth };

        this.drawImageToRegion(ctx, this.images.left, leftRegion, height, 'left');
        this.drawImageToRegion(ctx, this.images.right, rightRegion, height, 'right');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dividerX, 0, this.dividerWidth, height);

    }

    drawImageToRegion(ctx, img, region, canvasHeight, side) {
        if (!img) return;
        const metrics = this.computeBaseMetrics(img, region, canvasHeight, side);
        if (!metrics) return;
        const offsets = this.clampOffsetsForRegion(this.transforms[side].offsetX, this.transforms[side].offsetY, metrics, region, canvasHeight);
        this.transforms[side].offsetX = offsets.x;
        this.transforms[side].offsetY = offsets.y;
        const dx = metrics.dxBase + offsets.x;
        const dy = metrics.dyBase + offsets.y;

        ctx.save();
        ctx.beginPath();
        ctx.rect(region.x, 0, region.width, canvasHeight);
        ctx.clip();
        ctx.drawImage(img, dx, dy, metrics.drawWidth, metrics.drawHeight);
        ctx.restore();
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

    async export() {
        await this.ensureProfilesLoaded();
        const link = document.createElement('a');
        const timestamp = this.formatTimestamp(new Date());
        const byline = this.sanitizeBylineValue(this.bylineInput.value);
        const exportedAt = new Date();
        const srgbProfile = await this.getSrgbProfileBytes();

        this.renderComposite();

        const baseDataUrl = await this.canvasToSrgbDataUrl(this.renderCanvas);
        const finalDataUrl = this.injectMetadata(baseDataUrl, byline, exportedAt, srgbProfile);

        link.download = `TheBanfinator_${timestamp}.jpg`;
        link.href = finalDataUrl;
        link.click();
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
        const combined = this.mergeBylines(this.bylineSources.left, this.bylineSources.right);
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
        if (!this.images.left && !this.images.right) return;
        const point = this.getCanvasPoint(event);
        const dividerX = Math.round(this.ratio * (this.renderCanvas.width - this.dividerWidth));
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
        if (!this.images.left && !this.images.right) return;
        event.preventDefault();

        const point = this.getCanvasPoint(event);
        const dividerX = Math.round(this.ratio * (this.renderCanvas.width - this.dividerWidth));
        const side = point.x < dividerX ? 'left' : (point.x > dividerX + this.dividerWidth ? 'right' : null);
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
        const metrics = this.computeBaseMetrics(img, region, this.renderCanvas.height, side);
        const clamped = this.clampOffsetsForRegion(offsetX, offsetY, metrics, region, this.renderCanvas.height);
        this.transforms[side].offsetX = clamped.x;
        this.transforms[side].offsetY = clamped.y;
    }

    getRegionForSide(side) {
        const width = this.renderCanvas.width;
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
        const currentMetrics = this.computeBaseMetrics(img, region, this.renderCanvas.height, side, currentScale);
        const newMetrics = this.computeBaseMetrics(img, region, this.renderCanvas.height, side, targetScale);

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
        const normalizedLeft = this.normalizeBureauSpacing(this.sanitizeBylineValue(left));
        const normalizedRight = this.normalizeBureauSpacing(this.sanitizeBylineValue(right));
        const entries = [normalizedLeft, normalizedRight].filter(Boolean);
        if (!entries.length) return '';

        const collapsed = this.collapseDuplicateBureaus(entries);
        return this.sanitizeBylineValue(collapsed.join('/'));
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

    swapSides() {
        [this.images.left, this.images.right] = [this.images.right, this.images.left];
        [this.bylineSources.left, this.bylineSources.right] = [this.bylineSources.right, this.bylineSources.left];
        [this.transforms.left, this.transforms.right] = [this.transforms.right, this.transforms.left];
        [this.bureauSuffixes.left, this.bureauSuffixes.right] = [this.bureauSuffixes.right, this.bureauSuffixes.left];
        [this.colorProfiles.left, this.colorProfiles.right] = [this.colorProfiles.right, this.colorProfiles.left];

        this.setZoom('left', this.transforms.left.scale);
        this.setZoom('right', this.transforms.right.scale);
        this.updateBylineField();
        this.updateSuffixInfo();
        this.draw();
    }

    setBureauSuffix(side, byline, credit = '') {
        const bylineSuffix = this.extractBureauSuffix(byline);
        const creditSuffix = this.extractCreditBureau(credit);
        this.bureauSuffixes[side] = bylineSuffix || creditSuffix || '';
        this.updateSuffixInfo();
    }

    updateSuffixInfo() {
        if (!this.suffixInfoBox) return;
        const left = this.bureauSuffixes.left;
        const right = this.bureauSuffixes.right;
        const duplicateSuffix = left && right && left === right;

        if (duplicateSuffix) {
            this.suffixInfoBox.textContent = `Båda bilderna är ${left}`;
            this.suffixInfoBox.hidden = false;
        } else {
            this.suffixInfoBox.hidden = true;
        }
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
